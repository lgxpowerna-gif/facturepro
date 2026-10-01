"use client";
import { useEffect, useState } from "react";

const PREFIX = "fp";
const CONTACT = "lgxpowerna@gmail.com";

/** Deletes every FacturePro key from this browser's localStorage. */
export function ClearDataButton({ lang }: { lang: "fr" | "en" }) {
  const [done, setDone] = useState(false);
  const clear = () => {
    const ok = window.confirm(
      lang === "fr"
        ? "Effacer toutes vos données FacturePro de ce navigateur (entreprise, clients, historique, abonnement mémorisé) ? Cette action est irréversible."
        : "Delete all your FacturePro data from this browser (business, clients, history, remembered subscription)? This cannot be undone."
    );
    if (!ok) return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`${PREFIX}_`))
      .forEach((k) => localStorage.removeItem(k));
    setDone(true);
  };
  return (
    <button onClick={clear} className="mt-2 border border-red-300 text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium">
      {done
        ? lang === "fr" ? "Données effacées ✓" : "Data deleted ✓"
        : lang === "fr" ? "Effacer mes données de ce navigateur" : "Delete my data from this browser"}
    </button>
  );
}

/** "Manage / cancel my subscription": opens the Stripe customer portal for the subscription remembered in this browser. */
export function ManageSubscription({ lang, compact = false }: { lang: "fr" | "en"; compact?: boolean }) {
  const [sub, setSub] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  useEffect(() => {
    try {
      const s = localStorage.getItem(`${PREFIX}_sub`);
      if (s && /^sub_[A-Za-z0-9]{8,}$/.test(s)) setSub(s);
    } catch {
      /* ignore */
    }
  }, []);
  const mailto = `mailto:${CONTACT}?subject=${encodeURIComponent(
    lang === "fr" ? "Annulation abonnement FacturePro" : "Cancel FacturePro subscription"
  )}`;
  if (!sub) {
    return compact ? null : (
      <p className="text-sm text-slate-600">
        {lang === "fr"
          ? "Aucun abonnement Pro n'est mémorisé dans ce navigateur. Pour gérer ou annuler votre abonnement, écrivez-nous (voir ci-dessous)."
          : "No Pro subscription is remembered in this browser. To manage or cancel it, email us (see below)."}
      </p>
    );
  }
  const open = async () => {
    setState("loading");
    try {
      const r = await fetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: sub, lang }),
      });
      const d = await r.json();
      if (d.url) {
        window.location.href = d.url;
        return;
      }
      setState("error");
    } catch {
      setState("error");
    }
  };
  return (
    <div className={compact ? "inline-block" : ""}>
      <button
        onClick={open}
        disabled={state === "loading"}
        className={compact ? "text-xs text-slate-600 underline hover:text-slate-900" : "bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"}
      >
        {state === "loading" ? "…" : lang === "fr" ? "Gérer / annuler mon abonnement" : "Manage / cancel my subscription"}
      </button>
      {state === "error" && (
        <p className="text-xs text-red-600 mt-1">
          {lang === "fr" ? "Le portail n'est pas disponible. Pour annuler, écrivez à " : "The portal is unavailable. To cancel, email "}
          <a href={mailto} className="underline">{CONTACT}</a>
        </p>
      )}
    </div>
  );
}
