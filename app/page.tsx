"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { TAX_PRESETS, DEFAULT_TAX_PRESET, computeTaxes, formatRate } from "@/lib/tax";
import { FREE_LIMIT, monthKey, countForThisMonth, resolvePro, isValidSubscriptionId, legacyProActive, migrateLegacyPlan } from "@/lib/plan";
import { CheckoutConsent, LegalFooterLinks } from "@/components/LegalLinks";
import { ManageSubscription } from "@/components/LegalClient";
import { TEMPLATES } from "@/lib/templates";
import { translations, type Lang } from "@/lib/i18n";
import { BackupPanel, downloadBackup } from "@/components/BackupPanel";
import { BACKUP_SNOOZE_KEY, FREE_HISTORY_VISIBLE, LAST_EXPORT_KEY, MAX_HISTORY, exportReminderDue, type ImportPlan } from "@/lib/backup";

/* ───────────────────────── Types ───────────────────────── */
interface LineItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface SavedInvoice {
  id: string;
  number: string;
  clientName: string;
  total: number;
  date: string;
  createdAt: string;
}

type Plan = "free" | "pro";
type Currency = "CAD" | "USD" | "EUR";
type View = "app" | "pricing" | "history";
const EMPTY_COMPANY = { name: "", address: "", city: "", email: "", phone: "", bn: "", gst: "", qst: "", interac: "" };

/* ───────────────────────── Tax presets (Canada) ───────────────────────── */

/* ───────────────────────── Component ───────────────────────── */
export default function Home() {
  const [view, setView] = useState<View>("app");
  const [plan, setPlan] = useState<Plan>("free");
  const [legacyPro, setLegacyPro] = useState(false);
  const [lang, setLang] = useState<Lang>("fr");
  const [currency, setCurrency] = useState<Currency>("CAD");
  const [invoicesThisMonth, setInvoicesThisMonth] = useState(0);
  const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>([]);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [taxPreset, setTaxPreset] = useState(DEFAULT_TAX_PRESET);
  const [customTaxRate, setCustomTaxRate] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const t = translations[lang];

  const [company, setCompany] = useState(EMPTY_COMPANY);
  const [lastExport, setLastExport] = useState<number | null>(null);
  const [reminder, setReminder] = useState(false);

  const [client, setClient] = useState({
    name: "",
    address: "",
    city: "",
    email: "",
  });

  const [invoiceMeta, setInvoiceMeta] = useState({
    number: `FAC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    date: new Date().toISOString().split("T")[0],
    dueDate: "",
    notes: "Paiement à 30 jours. Merci de votre confiance.",
  });

  const [items, setItems] = useState<LineItem[]>([
    { id: 1, description: "", quantity: 1, unitPrice: 0 },
  ]);

  /* ─── Persist ─── */
  useEffect(() => {
    try {
      const sc = countForThisMonth(localStorage.getItem("fp_count_month"), localStorage.getItem("fp_count"));
      const si = localStorage.getItem("fp_invoices");
      const sco = localStorage.getItem("fp_company");
      const sl = localStorage.getItem("fp_lang") as Lang | null;
      const scu = localStorage.getItem("fp_currency") as Currency | null;
      setInvoicesThisMonth(sc);
      if (si) setSavedInvoices(JSON.parse(si));
      if (sco) setCompany((prev) => ({ ...prev, ...JSON.parse(sco) }));
      // Old versions saved "en" for every visitor; only honour a language the user explicitly picked.
      if (localStorage.getItem("fp_lang_choice") === "1" && sl && ["en", "fr", "es"].includes(sl)) setLang(sl);
      if (scu && ["CAD", "USD", "EUR"].includes(scu)) setCurrency(scu);
      const qv = new URLSearchParams(window.location.search).get("view");
      if (qv === "pricing" || qv === "history") setView(qv);
      const le = parseInt(localStorage.getItem(LAST_EXPORT_KEY) || "", 10);
      if (le > 0) setLastExport(le);
      setReminder(exportReminderDue({ lastExport: localStorage.getItem(LAST_EXPORT_KEY), snoozedAt: localStorage.getItem(BACKUP_SNOOZE_KEY), invoices: si ? JSON.parse(si) : [] }));
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  /* Pro is confirmed server-side with Stripe on every load (localStorage "fp_plan" is ignored). */
  const checkSubscription = useCallback(async (subId: string) => {
    let serverPro: boolean | null = null;
    try {
      const r = await fetch("/api/subscription-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: subId }),
      });
      const d = await r.json();
      serverPro = typeof d.pro === "boolean" ? d.pro : null;
    } catch {
      serverPro = null;
    }
    const last = parseInt(localStorage.getItem("fp_pro_confirmed_at") || "", 10) || null;
    const pro = resolvePro(serverPro, last);
    if (serverPro === true) localStorage.setItem("fp_pro_confirmed_at", String(Date.now()));
    if (serverPro === false) {
      localStorage.removeItem("fp_sub");
      localStorage.removeItem("fp_pro_confirmed_at");
    }
    setPlan(pro || legacyProActive(localStorage.getItem("fp_legacy_pro")) ? "pro" : "free");
    if (pro) localStorage.removeItem("fp_legacy_pro");
  }, []);

  useEffect(() => {
    try {
      // Restore link sent by email: /?restore=sub_…
      const restore = new URLSearchParams(window.location.search).get("restore");
      if (isValidSubscriptionId(restore)) {
        localStorage.setItem("fp_sub", restore);
        window.history.replaceState({}, "", window.location.pathname);
      }
      // One-time migration of the old browser-only Pro flag (kept until LEGACY_PRO_UNTIL).
      if (migrateLegacyPlan(localStorage.getItem("fp_plan"), localStorage.getItem("fp_sub")) === "legacy") {
        localStorage.setItem("fp_legacy_pro", "1");
      }
      localStorage.removeItem("fp_plan");
      const sub = localStorage.getItem("fp_sub");
      if (isValidSubscriptionId(sub)) {
        checkSubscription(sub);
      } else if (legacyProActive(localStorage.getItem("fp_legacy_pro"))) {
        setLegacyPro(true);
        setPlan("pro");
      }
    } catch {
      /* ignore */
    }
  }, [checkSubscription]);

  useEffect(() => {
    try {
      localStorage.setItem("fp_count", String(invoicesThisMonth));
      localStorage.setItem("fp_count_month", monthKey());
      localStorage.setItem("fp_invoices", JSON.stringify(savedInvoices));
      localStorage.setItem("fp_company", JSON.stringify(company));
      localStorage.setItem("fp_lang", lang);
      localStorage.setItem("fp_currency", currency);
    } catch {
      /* ignore */
    }
  }, [invoicesThisMonth, savedInvoices, company, lang, currency]);

  /* Success return from Stripe — unlock only after verify-session */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") !== "true") return;
    const sessionId = params.get("session_id");
    const clear = () => window.history.replaceState({}, "", window.location.pathname);
    if (!sessionId || !sessionId.startsWith("cs_")) {
      clear();
      return;
    }
    (async () => {
      try {
        const r = await fetch("/api/verify-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const d = await r.json();
        if (d.valid) {
          if (isValidSubscriptionId(d.subscription)) {
            localStorage.setItem("fp_sub", d.subscription);
            localStorage.setItem("fp_pro_confirmed_at", String(Date.now()));
          }
          setPlan("pro");
          setShowUpgrade(false);
        }
      } catch {
        /* ignore */
      } finally {
        clear();
      }
    })();
  }, []);

  /* Default notes by language */
  useEffect(() => {
    const defaults: Record<Lang, string> = {
      en: "Payment due within 30 days. Thank you for your business.",
      fr: "Paiement à 30 jours. Merci de votre confiance.",
      es: "Pago a 30 días. Gracias por su confianza.",
    };
    setInvoiceMeta((prev) => ({ ...prev, notes: defaults[lang] }));
  }, [lang]);

  const isLimitReached = plan === "free" && invoicesThisMonth >= FREE_LIMIT;

  const currencyLocale =
    currency === "CAD"
      ? lang === "fr" ? "fr-CA" : "en-CA"
      : currency === "USD" ? "en-US" : "fr-FR";

  const formatCurrency = useCallback(
    (amount: number) =>
      new Intl.NumberFormat(currencyLocale, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
      })
        .format(amount)
        .replace(/[\u202f\u00a0]/g, " "), // jsPDF core fonts can't render narrow no-break spaces (fr-CA)
    [currency, currencyLocale]
  );

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [items]
  );
  const discountAmount = subtotal * (discountPct / 100);
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxResult = useMemo(
    () => computeTaxes(taxable, taxPreset, lang, customTaxRate),
    [taxable, taxPreset, lang, customTaxRate]
  );
  const total = taxResult.total;

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now(), description: "", quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeItem = (id: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  };

  const updateItem = (id: number, field: keyof LineItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const applyTemplate = (templateId: string) => {
    const tpl = TEMPLATES.find((x) => x.id === templateId);
    if (!tpl) return;
    setItems(
      tpl.items.map((it, idx) => ({
        id: Date.now() + idx,
        description: typeof it.description === "string" ? it.description : it.description[lang],
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      }))
    );
  };

  /* ─── PDF Generation ─── */
  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const primary: [number, number, number] = [37, 99, 235];

    const labels = {
      en: { inv: "INVOICE", from: "FROM", to: "BILL TO", sub: "Subtotal", tot: "Total", due: "Balance Due", terms: "Terms" },
      fr: { inv: "FACTURE", from: "DE", to: "FACTURER À", sub: "Sous-total", tot: "Total", due: "Solde dû", terms: "Conditions" },
      es: { inv: "FACTURA", from: "DE", to: "FACTURAR A", sub: "Subtotal", tot: "Total", due: "Saldo", terms: "Condiciones" },
    }[lang];

    // Header band
    doc.setFillColor(...primary);
    doc.rect(0, 0, pageWidth, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(labels.inv, 14, 18);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`# ${invoiceMeta.number}`, pageWidth - 14, 12, { align: "right" });
    doc.text(invoiceMeta.date, pageWidth - 14, 18, { align: "right" });
    if (invoiceMeta.dueDate) {
      doc.text(`${t.dueDate}: ${invoiceMeta.dueDate}`, pageWidth - 14, 24, { align: "right" });
    }

    // From / To
    let y = 40;
    doc.setTextColor(100);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(labels.from, 14, y);
    doc.text(labels.to, pageWidth / 2 + 4, y);

    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(company.name || (lang === "fr" ? "Votre entreprise" : "Your Business"), 14, y);
    doc.text(client.name || "Client", pageWidth / 2 + 4, y);

    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(70);
    const leftLines = [
      company.address,
      company.city,
      company.email,
      company.phone,
      company.bn ? `${lang === "fr" ? "NEQ/NE" : "BN"} : ${company.bn}` : "",
      company.gst ? `${lang === "fr" ? "N° TPS/TVH" : "GST/HST #"} : ${company.gst}` : "",
      company.qst ? `${lang === "fr" ? "N° TVQ" : "QST #"} : ${company.qst}` : "",
    ].filter(Boolean);
    const rightLines = [client.address, client.city, client.email].filter(Boolean);

    leftLines.forEach((line, i) => doc.text(line, 14, y + i * 4.5));
    rightLines.forEach((line, i) => doc.text(line, pageWidth / 2 + 4, y + i * 4.5));

    const tableStart = Math.max(y + leftLines.length * 4.5, y + rightLines.length * 4.5) + 10;

    const tableData = items.map((item) => [
      item.description || "—",
      String(item.quantity),
      formatCurrency(item.unitPrice),
      formatCurrency(item.quantity * item.unitPrice),
    ]);

    autoTable(doc, {
      startY: tableStart,
      head: [[t.description, t.qty, t.unitPrice, t.totalHT]],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: primary,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 88 },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 35, halign: "right" },
        3: { cellWidth: 35, halign: "right" },
      },
      margin: { left: 14, right: 14 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Totals
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.setFont("helvetica", "normal");
    let ty = finalY;
    doc.text(labels.sub, pageWidth - 70, ty);
    doc.text(formatCurrency(subtotal), pageWidth - 14, ty, { align: "right" });
    ty += 6;
    if (discountPct > 0) {
      doc.text(`${lang === "fr" ? "Remise" : lang === "es" ? "Descuento" : "Discount"} (${discountPct}%)`, pageWidth - 70, ty);
      doc.text(`-${formatCurrency(discountAmount)}`, pageWidth - 14, ty, { align: "right" });
      ty += 6;
    }
    taxResult.lines.forEach((line) => {
      doc.text(`${line.label} (${formatRate(line.rate, lang)})`, pageWidth - 70, ty);
      doc.text(formatCurrency(line.amount), pageWidth - 14, ty, { align: "right" });
      ty += 6;
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...primary);
    doc.text(labels.tot, pageWidth - 70, ty);
    doc.text(formatCurrency(total), pageWidth - 14, ty, { align: "right" });

    // Interac
    let notesY = ty + 12;
    if (company.interac) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30);
      doc.text("Interac e-Transfer:", 14, notesY);
      doc.setFont("helvetica", "normal");
      doc.text(company.interac, 50, notesY);
      notesY += 8;
    }

    if (invoiceMeta.notes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(labels.terms, 14, notesY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60);
      const split = doc.splitTextToSize(invoiceMeta.notes, pageWidth - 28);
      doc.text(split, 14, notesY + 5);
    }

    // Watermark free
    if (plan === "free") {
      doc.setFontSize(36);
      doc.setTextColor(220, 220, 220);
      doc.setFont("helvetica", "bold");
      doc.text(lang === "fr" ? "FACTUREPRO GRATUIT" : "FACTUREPRO FREE", pageWidth / 2, 155, {
        align: "center",
        angle: 28,
      });
    }

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.setFont("helvetica", "normal");
    const footer =
      plan === "pro"
        ? lang === "fr" ? "Généré avec FacturePro Pro" : "Generated with FacturePro Pro"
        : lang === "fr"
          ? "Généré avec FacturePro Gratuit – facturepro.faitle.net"
          : "Generated with FacturePro Free – Upgrade to remove watermark";
    doc.text(footer, pageWidth / 2, 287, { align: "center" });

    doc.save(`${lang === "fr" ? "facture" : "invoice"}-${invoiceMeta.number}.pdf`);
  };

  const handleGenerate = () => {
    if (isLimitReached) {
      setShowUpgrade(true);
      return;
    }
    generatePDF();
    setToast(lang === "fr" ? "PDF téléchargé ✓" : lang === "es" ? "PDF descargado ✓" : "PDF downloaded ✓");
    setTimeout(() => setToast(null), 2500);
    const newCount = invoicesThisMonth + 1;
    setInvoicesThisMonth(newCount);
    setSavedInvoices((prev) =>
      [
        {
          id: Date.now().toString(),
          number: invoiceMeta.number,
          clientName: client.name || "Client",
          total,
          date: invoiceMeta.date,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, MAX_HISTORY)
    );
    setInvoiceMeta((prev) => ({
      ...prev,
      number: `${lang === "fr" ? "FAC" : "INV"}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    }));
  };

  /* ─── Local backup (export / import) ─── */
  const flash = (msg: string, ms = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  };
  const exportData = () => {
    try {
      setLastExport(downloadBackup(lang));
      setReminder(false);
      flash(t.backupExported);
    } catch {
      flash(t.errRead);
    }
  };
  const snoozeReminder = () => {
    try { localStorage.setItem(BACKUP_SNOOZE_KEY, String(Date.now())); } catch { /* ignore */ }
    setReminder(false);
  };
  const onImported = (p: ImportPlan, summary: string) => {
    setSavedInvoices(p.invoices);
    setCompany({ ...EMPTY_COMPANY, ...p.company });
    setInvoicesThisMonth(p.count);
    if (p.lang) setLang(p.lang);
    if (p.currency) setCurrency(p.currency);
    if (p.subChanged) {
      const sub = localStorage.getItem("fp_sub");
      if (isValidSubscriptionId(sub)) {
        setLegacyPro(false);
        checkSubscription(sub);
      }
    }
    flash(summary, 4000);
  };
  const visibleInvoices = plan === "pro" ? savedInvoices : savedInvoices.slice(0, FREE_HISTORY_VISIBLE);
  const hiddenInvoices = savedInvoices.length - visibleInvoices.length;

  const handleUpgrade = async (selected: "monthly" | "yearly") => {
    setLoadingCheckout(true);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selected }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Checkout error. Check Stripe configuration.");
        setLoadingCheckout(false);
      }
    } catch {
      alert("Network error. Please try again.");
      setLoadingCheckout(false);
    }
  };

  /* ───────────────────────── Render ───────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div
            className="flex items-center gap-2.5 cursor-pointer shrink-0"
            onClick={() => setView("app")}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-base text-slate-900 leading-tight">{t.brand}</h1>
              <p className="text-[10px] text-slate-500">
                {plan === "pro" ? (
                  <span className="text-emerald-600 font-semibold">{t.proBadge}</span>
                ) : (
                  t.free
                )}
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-0.5">
            {(["app", "history", "pricing"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  view === v
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {v === "app" ? t.create : v === "history" ? t.history : t.pricing}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <select
              value={lang}
              onChange={(e) => {
                try { localStorage.setItem("fp_lang_choice", "1"); } catch { /* ignore */ }
                setLang(e.target.value as Lang);
              }}
              className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white"
              aria-label={t.language}
            >
              <option value="en">EN</option>
              <option value="fr">FR</option>
              <option value="es">ES</option>
            </select>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white"
              aria-label={t.currency}
            >
              <option value="CAD">CAD $</option>
              <option value="USD">USD $</option>
              <option value="EUR">EUR €</option>
            </select>

            {plan === "free" && (
              <span className="hidden lg:inline text-xs text-slate-500">
                {invoicesThisMonth}/{FREE_LIMIT}
              </span>
            )}

            {plan === "free" ? (
              <button
                onClick={() => setView("pricing")}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition"
              >
                {t.upgrade}
              </button>
            ) : (
              <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-100">
                {t.proAccount}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Upgrade modal */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-2">{t.limitReachedTitle}</h3>
            <p className="text-slate-600 text-sm mb-6">
              {t.limitReachedText.replace("{limit}", String(FREE_LIMIT))}
            </p>
            <div className="space-y-3">
              <button
                disabled={loadingCheckout}
                onClick={() => handleUpgrade("monthly")}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold"
              >
                {loadingCheckout ? "…" : t.monthly}
              </button>
              <button
                disabled={loadingCheckout}
                onClick={() => handleUpgrade("yearly")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold"
              >
                {loadingCheckout ? "…" : t.yearly}{" "}
                <span className="text-indigo-200 text-sm">{t.yearlyBonus}</span>
              </button>
              <button
                onClick={() => setShowUpgrade(false)}
                className="w-full text-slate-500 py-2 text-sm hover:text-slate-700"
              >
                {t.continueFree}
              </button>
              <CheckoutConsent lang={lang} className="text-center" />
            </div>
          </div>
        </div>
      )}
      {legacyPro && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-4 py-2 text-center">
          {lang === "fr"
            ? "Votre accès Pro est conservé jusqu'au 31 décembre 2026. Pour le lier à votre abonnement Stripe, écrivez à "
            : "Your Pro access is kept until December 31, 2026. To link it to your Stripe subscription, email "}
          <a href="mailto:lgxpowerna@gmail.com" className="underline">lgxpowerna@gmail.com</a>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* ───── PRICING ───── */}
        {view === "pricing" && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">{t.pricingTitle}</h2>
              <p className="text-slate-600">{t.pricingSub}</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  {t.freePlan}
                </div>
                <div className="text-4xl font-bold text-slate-900 mb-1">{t.freePrice}</div>
                <p className="text-slate-500 text-sm mb-6">{t.freeDesc}</p>
                <ul className="space-y-2.5 text-sm text-slate-700 mb-8">
                  {[t.feature5, t.featureTax, t.featurePdf, t.featureInterac].map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-emerald-500">✓</span> {f}
                    </li>
                  ))}
                  {[t.featureWatermark, t.featureLogo].map((f) => (
                    <li key={f} className="flex gap-2 text-slate-400">
                      <span>✗</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setView("app")}
                  className="w-full border border-slate-300 text-slate-700 py-2.5 rounded-xl font-medium hover:bg-slate-50"
                >
                  {t.continueFree}
                </button>
              </div>

              <div className="bg-gradient-to-b from-blue-600 to-indigo-700 rounded-2xl p-6 shadow-xl text-white relative">
                <div className="absolute top-4 right-4 bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
                  {t.popular}
                </div>
                <div className="text-sm font-semibold text-blue-100 uppercase tracking-wide mb-1">
                  {t.proPlan}
                </div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-bold">{t.proPrice}</span>
                  <span className="text-blue-200 mb-1">{t.perMonth}</span>
                </div>
                <p className="text-blue-100 text-sm mb-1">{t.orYearly}</p>
                <p className="text-blue-200 text-xs mb-6">{t.cancelAnytime}</p>
                <ul className="space-y-2.5 text-sm mb-8">
                  {[
                    t.featureUnlimited,
                    t.featureNoWatermark,
                    t.featureLogoColors,
                    t.feature3Templates,
                    t.featureHistory,
                    t.featureSupport,
                  ].map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-emerald-300">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  <button
                    disabled={loadingCheckout}
                    onClick={() => handleUpgrade("monthly")}
                    className="w-full bg-white text-blue-700 py-2.5 rounded-xl font-semibold hover:bg-blue-50 disabled:opacity-60"
                  >
                    {t.startMonthly}
                  </button>
                  <button
                    disabled={loadingCheckout}
                    onClick={() => handleUpgrade("yearly")}
                    className="w-full bg-blue-500/30 text-white py-2.5 rounded-xl font-medium hover:bg-blue-500/40 border border-white/20 disabled:opacity-60"
                  >
                    {t.startYearly}
                  </button>
                  <CheckoutConsent lang={lang} dark className="pt-1" />
                </div>
              </div>
            </div>
            <div className="mt-10 text-center text-xs text-slate-400 flex flex-wrap justify-center gap-6">
              <span>🔒 {t.secure}</span>
              
              <span>📄 {t.compliant}</span>
            </div>
          </div>
        )}

        {/* ───── HISTORY ───── */}
        {view === "history" && (
          <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
              <h2 className="text-2xl font-bold text-slate-900">{t.historyTitle}</h2>
              {plan === "free" && (
                <span className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full">
                  {t.historyLimit}
                </span>
              )}
            </div>
            <BackupPanel lang={lang} t={t} lastExport={lastExport} onExport={exportData} onImported={onImported} />
            {savedInvoices.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <p className="text-slate-500 mb-4">{t.noInvoices}</p>
                <button
                  onClick={() => setView("app")}
                  className="text-blue-600 font-medium hover:underline"
                >
                  {t.createFirst}
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left px-5 py-3 font-medium">{t.number}</th>
                        <th className="text-left px-5 py-3 font-medium">{t.client}</th>
                        <th className="text-left px-5 py-3 font-medium">{t.date}</th>
                        <th className="text-right px-5 py-3 font-medium">{t.totalTTC}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleInvoices.map((inv) => (
                        <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-5 py-3 font-medium text-slate-900">{inv.number}</td>
                          <td className="px-5 py-3 text-slate-600">{inv.clientName}</td>
                          <td className="px-5 py-3 text-slate-500">{inv.date}</td>
                          <td className="px-5 py-3 text-right font-medium">
                            {formatCurrency(inv.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hiddenInvoices > 0 && (
                  <p className="px-5 py-3 text-xs text-slate-500 border-t border-slate-100">
                    +{hiddenInvoices} {t.historyHidden}{" "}
                    <button onClick={() => setView("pricing")} className="text-blue-600 font-medium hover:underline">{t.upgrade}</button>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ───── APP ───── */}
        {view === "app" && (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {reminder && (
              <div role="status" className="xl:col-span-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
                <span>💾 {t.backupReminder}</span>
                <span className="flex gap-3 whitespace-nowrap">
                  <button onClick={exportData} className="font-semibold underline">{t.backupNow}</button>
                  <button onClick={snoozeReminder} className="text-amber-700">{t.backupLater}</button>
                </span>
              </div>
            )}
            {/* Form – 3 cols */}
            <div className="xl:col-span-3 space-y-5">
              {/* Templates */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">{t.template}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => applyTemplate(tpl.id)}
                      className="text-left border border-slate-200 hover:border-blue-400 hover:bg-blue-50 rounded-lg p-3 transition"
                    >
                      <div className="font-medium text-sm text-slate-800">
                        {tpl.label[lang]}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{tpl.desc[lang]}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Company + Client */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded text-xs flex items-center justify-center font-bold">
                      1
                    </span>
                    {t.yourCompany}
                  </h2>
                  <div className="space-y-2.5">
                    <input
                      placeholder={t.companyName}
                      value={company.name}
                      onChange={(e) => setCompany({ ...company, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <input
                      placeholder={t.address}
                      value={company.address}
                      onChange={(e) => setCompany({ ...company, address: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <input
                      placeholder={t.city}
                      value={company.city}
                      onChange={(e) => setCompany({ ...company, city: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder={t.email}
                        value={company.email}
                        onChange={(e) => setCompany({ ...company, email: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                      <input
                        placeholder={t.phone}
                        value={company.phone}
                        onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder={t.siret}
                        value={company.bn}
                        onChange={(e) => setCompany({ ...company, bn: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                      <input
                        placeholder={t.gstNumber}
                        value={company.gst}
                        onChange={(e) => setCompany({ ...company, gst: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <input
                      placeholder={t.qstNumber}
                      value={company.qst}
                      onChange={(e) => setCompany({ ...company, qst: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <input
                      placeholder={t.interac}
                      value={company.interac}
                      onChange={(e) => setCompany({ ...company, interac: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => { setView("history"); window.scrollTo({ top: 0 }); }}
                      className="text-xs text-blue-600 hover:underline pt-1"
                    >
                      💾 {t.backupLink} →
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded text-xs flex items-center justify-center font-bold">
                      2
                    </span>
                    {t.clientSection}
                  </h2>
                  <div className="space-y-2.5">
                    <input
                      placeholder={t.clientName}
                      value={client.name}
                      onChange={(e) => setClient({ ...client, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <input
                      placeholder={t.address}
                      value={client.address}
                      onChange={(e) => setClient({ ...client, address: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <input
                      placeholder={t.city}
                      value={client.city}
                      onChange={(e) => setClient({ ...client, city: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <input
                      placeholder={t.email}
                      value={client.email}
                      onChange={(e) => setClient({ ...client, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Invoice meta */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded text-xs flex items-center justify-center font-bold">
                    3
                  </span>
                  {t.invoiceSection}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">{t.invoiceNumber}</label>
                    <input
                      value={invoiceMeta.number}
                      onChange={(e) =>
                        setInvoiceMeta({ ...invoiceMeta, number: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">{t.date}</label>
                    <input
                      type="date"
                      value={invoiceMeta.date}
                      onChange={(e) =>
                        setInvoiceMeta({ ...invoiceMeta, date: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">{t.dueDate}</label>
                    <input
                      type="date"
                      value={invoiceMeta.dueDate}
                      onChange={(e) =>
                        setInvoiceMeta({ ...invoiceMeta, dueDate: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Line items */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded text-xs flex items-center justify-center font-bold">
                      4
                    </span>
                    {t.items}
                  </h2>
                  <button
                    onClick={addItem}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {t.addLine}
                  </button>
                </div>
                <div className="space-y-2.5">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
                    >
                      <input
                        placeholder={t.description}
                        value={item.description}
                        onChange={(e) =>
                          updateItem(item.id, "description", e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm w-full"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)
                        }
                        className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)
                        }
                        className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                      <div className="w-24 text-right text-sm font-medium text-slate-700 py-2">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-slate-400 hover:text-red-500 p-1 text-sm"
                        title={t.remove}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h2 className="font-semibold text-slate-800 mb-3">{t.notes}</h2>
                <textarea
                  rows={3}
                  value={invoiceMeta.notes}
                  onChange={(e) =>
                    setInvoiceMeta({ ...invoiceMeta, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                />
              </div>
            </div>

            {/* Sidebar – Preview + Summary (2 cols) */}
            <div className="xl:col-span-2 space-y-5">
              {/* Live preview card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-20">
                <div className="bg-slate-800 text-white px-4 py-2.5 text-xs font-medium flex items-center justify-between">
                  <span>{t.livePreview}</span>
                  <span className="opacity-70">{invoiceMeta.number}</span>
                </div>
                <div className="p-5 preview-scroll max-h-[420px] overflow-y-auto text-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-lg font-bold text-blue-600">
                        {lang === "fr" ? "FACTURE" : lang === "es" ? "FACTURA" : "INVOICE"}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {invoiceMeta.date}
                        {invoiceMeta.dueDate && ` · ${t.dueDate} ${invoiceMeta.dueDate}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-900">
                        {company.name || (lang === "fr" ? "Votre entreprise" : "Your Business")}
                      </div>
                      <div className="text-xs text-slate-500">
                        {[company.city, company.email].filter(Boolean).join(" · ")}
                      </div>
                      {(company.gst || company.qst) && (
                        <div className="text-[10px] text-slate-400">
                          {[
                            company.gst && `${lang === "fr" ? "TPS" : "GST"} ${company.gst}`,
                            company.qst && `${lang === "fr" ? "TVQ" : "QST"} ${company.qst}`,
                          ].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                      {t.billTo}
                    </div>
                    <div className="font-medium text-slate-800">
                      {client.name || "—"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {[client.city, client.email].filter(Boolean).join(" · ")}
                    </div>
                  </div>

                  <table className="w-full text-xs mb-4">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="text-left py-1.5 font-medium">{t.description}</th>
                        <th className="text-right py-1.5 font-medium">{t.qty}</th>
                        <th className="text-right py-1.5 font-medium">{t.totalHT}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-b border-slate-50">
                          <td className="py-1.5 text-slate-700">
                            {item.description || "—"}
                          </td>
                          <td className="py-1.5 text-right text-slate-600">
                            {item.quantity}
                          </td>
                          <td className="py-1.5 text-right font-medium">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>{t.totalHT}</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {discountPct > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>{lang === "fr" ? "Remise" : lang === "es" ? "Descuento" : "Discount"} ({discountPct}%)</span>
                        <span>-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                    {taxResult.lines.map((line) => (
                      <div key={line.code} className="flex justify-between text-slate-600">
                        <span>
                          {line.label} ({formatRate(line.rate, lang)})
                        </span>
                        <span>{formatCurrency(line.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-base font-bold text-blue-700 pt-1 border-t border-slate-100">
                      <span>{t.total}</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>

                  {company.interac && (
                    <div className="mt-3 text-[11px] text-slate-500">
                      Interac: {company.interac}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="border-t border-slate-100 p-4 space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">{t.taxRate}</label>
                    <select
                      value={taxPreset}
                      onChange={(e) => setTaxPreset(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    >
                      {TAX_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label[lang]}
                        </option>
                      ))}
                    </select>
                    {taxPreset === "custom" && (
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={customTaxRate}
                        onChange={(e) =>
                          setCustomTaxRate(parseFloat(e.target.value) || 0)
                        }
                        placeholder={lang === "fr" ? "Taux %" : "Custom %"}
                        className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      {lang === "fr" ? "Remise %" : lang === "es" ? "Descuento %" : "Discount %"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={discountPct}
                      onChange={(e) => setDiscountPct(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>

                  {plan === "free" && (
                    <div className="text-xs text-center text-slate-500 bg-slate-50 rounded-lg py-1.5">
                      {invoicesThisMonth}/{FREE_LIMIT} {t.usedThisMonth}
                    </div>
                  )}

                  <button
                    onClick={handleGenerate}
                    className={`w-full py-3 rounded-xl font-semibold shadow-sm transition ${
                      isLimitReached
                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {isLimitReached ? t.upgradeToContinue : t.downloadPdf}
                  </button>

                  {plan === "free" && (
                    <p className="text-[11px] text-slate-400 text-center">
                      {t.freeWatermark}
                    </p>
                  )}
                </div>
              </div>

              {plan === "free" && (
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl p-5 text-white shadow-lg">
                  <h3 className="font-bold text-lg mb-1">{t.goPro}</h3>
                  <p className="text-blue-100 text-sm mb-3">{t.goProDesc}</p>
                  <div className="text-2xl font-bold mb-3">
                    {t.proPrice}<span className="text-base font-normal text-blue-200">{t.perMonth}</span>
                  </div>
                  <button
                    onClick={() => setView("pricing")}
                    className="w-full bg-white text-indigo-700 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-50"
                  >
                    {t.seePricing}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade-in">
          {toast}
        </div>
      )}

      <footer className="border-t border-slate-200 mt-12 py-8 text-center text-sm text-slate-500">
        <p className="font-medium text-slate-700 mb-1">{t.brand}</p>
        <p>{t.footerTagline}</p>
        <LegalFooterLinks lang={lang} className="mt-3" />
        {plan === "pro" && (
          <div className="mt-2">
            <ManageSubscription lang={lang === "en" ? "en" : "fr"} compact />
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">
          © {new Date().getFullYear()} {t.brand} – Janvier Alie (Multilaser Créations), Mont-Laurier (QC) – {t.rights}
        </p>
      </footer>
    </div>
  );
}
