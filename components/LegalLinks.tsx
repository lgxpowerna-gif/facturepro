/* Pure (client-safe) legal links, used by the app footer, checkout and legal pages. */
type L = "fr" | "en";
export const LEGAL_LINKS = {
  fr: { privacy: "/confidentialite", terms: "/conditions", contact: "/contact", pricing: "/tarifs" },
  en: { privacy: "/privacy", terms: "/terms", contact: "/contact-us", pricing: "/pricing" },
} as const;
const T = {
  fr: { privacy: "Confidentialité", terms: "Conditions", contact: "Contact", pricing: "Tarifs" },
  en: { privacy: "Privacy", terms: "Terms", contact: "Contact", pricing: "Pricing" },
};
export const legalLang = (lang: string): L => (lang === "en" ? "en" : "fr");

export function LegalFooterLinks({ lang, className = "mt-6" }: { lang: string; className?: string }) {
  const k = legalLang(lang);
  const l = LEGAL_LINKS[k];
  const t = T[k];
  return (
    <nav className={`${className} flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs`}>
      <a href={l.pricing} className="text-blue-600 hover:underline">{t.pricing}</a>
      <a href={l.privacy} className="text-blue-600 hover:underline">{t.privacy}</a>
      <a href={l.terms} className="text-blue-600 hover:underline">{t.terms}</a>
      <a href={l.contact} className="text-blue-600 hover:underline">{t.contact}</a>
    </nav>
  );
}

/** Shown next to every Pro checkout button. */
export function CheckoutConsent({ lang, className = "", dark = false }: { lang: string; className?: string; dark?: boolean }) {
  const k = legalLang(lang);
  const l = LEGAL_LINKS[k];
  const a = dark ? "underline text-white" : "underline text-blue-600";
  return (
    <p className={`text-[11px] leading-snug ${dark ? "text-blue-100" : "text-slate-500"} ${className}`}>
      {k === "fr" ? (
        <>En vous abonnant, vous acceptez les <a href={l.terms} className={a}>Conditions d&apos;utilisation</a> et la <a href={l.privacy} className={a}>Politique de confidentialité</a>. Renouvellement automatique, annulable en tout temps (<a href={l.contact} className={a}>comment annuler</a>).</>
      ) : (
        <>By subscribing you accept the <a href={l.terms} className={a}>Terms of use</a> and <a href={l.privacy} className={a}>Privacy policy</a>. Renews automatically, cancel anytime (<a href={l.contact} className={a}>how to cancel</a>).</>
      )}
    </p>
  );
}
