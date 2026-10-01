import Link from "next/link";
import { FREE_LIMIT } from "@/lib/plan";

/** Display prices — must match the Stripe prices behind STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY. */
export const PRICE_MONTHLY = 9;
export const PRICE_YEARLY = 79;

type PLang = "fr" | "en";

const COPY = {
  fr: {
    title: "Tarifs FacturePro",
    sub: "Factures professionnelles en français, avec TPS et TVQ. Commencez gratuitement, passez à Pro quand vous voulez.",
    free: "Gratuit",
    pro: "Pro",
    perMonth: "/mois",
    perYear: "/an",
    yearlyNote: `ou ${PRICE_YEARLY} $/an — 2 mois gratuits`,
    taxNote: "Prix en dollars canadiens. Taxes en sus. Paiement sécurisé par Stripe.",
    startFree: "Commencer gratuitement",
    goPro: "Passer à Pro",
    best: "Recommandé",
    freeFeatures: [`${FREE_LIMIT} documents par mois`, ...["Factures PDF en français ou en anglais", "TPS + TVQ et taxes des autres provinces", "Instructions Virement Interac"]],
    freeMissing: ["Filigrane « Gratuit » sur le PDF"],
    proFeatures: ["Factures illimitées", "Sans filigrane", "Tous les modèles", "Historique illimité", "Abonnement vérifié par Stripe"],
    faqTitle: "Questions fréquentes",
    faq: [["La TPS et la TVQ sont-elles calculées correctement ?", "Oui : TPS 5 % et TVQ 9,975 % calculées séparément sur le montant avant taxes, chacune arrondie au cent, avec vos numéros TPS et TVQ imprimés sur le PDF."], ["Faut-il créer un compte ?", "Non. Vos documents et coordonnées restent dans votre navigateur. Votre abonnement Pro est vérifié auprès de Stripe à chaque ouverture et est lié à ce navigateur pour l'instant."], ["Puis-je annuler ?", "Oui, sans engagement. L'accès Pro reste actif jusqu'à la fin de la période payée."]],
    other: { href: "/pricing", label: "English" },
    back: "← Retour à l'application",
  },
  en: {
    title: "FacturePro pricing",
    sub: "Professional invoices with GST/HST and QST. Start free, upgrade whenever you want.",
    free: "Free",
    pro: "Pro",
    perMonth: "/mo",
    perYear: "/yr",
    yearlyNote: `or $${PRICE_YEARLY}/yr — 2 months free`,
    taxNote: "Prices in Canadian dollars. Plus applicable taxes. Secure payment by Stripe.",
    startFree: "Start free",
    goPro: "Go Pro",
    best: "Recommended",
    freeFeatures: [`${FREE_LIMIT} documents per month`, ...["PDF invoices in French or English", "GST + QST and other provinces' taxes", "Interac e-Transfer instructions"]],
    freeMissing: ["“Free” watermark on the PDF"],
    proFeatures: ["Unlimited invoices", "No watermark", "All templates", "Unlimited history", "Subscription verified by Stripe"],
    faqTitle: "FAQ",
    faq: [["Are GST and QST calculated correctly?", "Yes: GST 5% and QST 9.975% are computed separately on the pre-tax amount, each rounded to the cent, with your GST and QST numbers printed on the PDF."], ["Do I need an account?", "No. Your documents and details stay in your browser. Your Pro subscription is verified with Stripe each time you open the app and is tied to this browser for now."], ["Can I cancel?", "Yes, no commitment. Pro stays active until the end of the paid period."]],
    other: { href: "/tarifs", label: "Français" },
    back: "← Back to the app",
  },
} as const;

export default function PricingPage({ lang }: { lang: PLang }) {
  const c = COPY[lang];
  const price = (n: number) => (lang === "fr" ? `${n} $` : `$${n}`);
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex justify-between items-center mb-8 text-sm">
          <Link href="/" className="text-blue-600 hover:underline">{c.back}</Link>
          <Link href={c.other.href} className="text-slate-500 hover:underline">{c.other.label}</Link>
        </div>
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{c.title}</h1>
          <p className="text-slate-600">{c.sub}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">{c.free}</h2>
            <div className="text-4xl font-bold text-slate-900 mb-6">{price(0)}</div>
            <ul className="space-y-2.5 text-sm text-slate-700 mb-8 flex-1">
              {c.freeFeatures.map((f) => (
                <li key={f} className="flex gap-2"><span className="text-emerald-500">✓</span> {f}</li>
              ))}
              {c.freeMissing.map((f) => (
                <li key={f} className="flex gap-2 text-slate-400"><span>✗</span> {f}</li>
              ))}
            </ul>
            <Link href="/" className="block text-center w-full border border-slate-300 text-slate-700 py-2.5 rounded-xl font-medium hover:bg-slate-50">
              {c.startFree}
            </Link>
          </section>
          <section className="bg-gradient-to-b from-blue-600 to-indigo-700 rounded-2xl p-6 shadow-xl text-white relative flex flex-col">
            <span className="absolute top-4 right-4 bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">{c.best}</span>
            <h2 className="text-sm font-semibold text-blue-100 uppercase tracking-wide mb-1">{c.pro}</h2>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold">{price(PRICE_MONTHLY)}</span>
              <span className="text-blue-200 mb-1">{c.perMonth}</span>
            </div>
            <p className="text-blue-100 text-sm mb-6">{c.yearlyNote}</p>
            <ul className="space-y-2.5 text-sm mb-8 flex-1">
              {c.proFeatures.map((f) => (
                <li key={f} className="flex gap-2"><span className="text-emerald-300">✓</span> {f}</li>
              ))}
            </ul>
            <Link href="/?view=pricing" className="block text-center w-full bg-white text-blue-700 py-2.5 rounded-xl font-semibold hover:bg-blue-50">
              {c.goPro}
            </Link>
          </section>
        </div>
        <p className="text-center text-xs text-slate-500 mt-6">{c.taxNote}</p>
        <section className="mt-12">
          <h2 className="text-xl font-bold text-slate-900 mb-4">{c.faqTitle}</h2>
          <dl className="space-y-4">
            {c.faq.map(([q, a]) => (
              <div key={q} className="bg-white rounded-xl border border-slate-200 p-4">
                <dt className="font-semibold text-slate-800">{q}</dt>
                <dd className="text-sm text-slate-600 mt-1">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  );
}
