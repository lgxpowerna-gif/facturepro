import Link from "next/link";
import { ClearDataButton, ManageSubscription } from "./LegalClient";
import { LEGAL_LINKS, LegalFooterLinks } from "./LegalLinks";
export { LEGAL_LINKS, LegalFooterLinks };

/* Operator & contact (approved by the owner). Never add a phone number here. */
export const OPERATOR = "Janvier Alie (Multilaser Créations)";
export const RESPONSIBLE = "Janvier Alie";
export const CITY = "Mont-Laurier (Québec)";
export const CONTACT_EMAIL = "lgxpowerna@gmail.com";
export const UPDATED = { fr: "1er octobre 2026", en: "October 1, 2026" };
const BRAND: string = "FacturePro";

type L = "fr" | "en";
const LABELS = {
  fr: { privacy: "Confidentialité", terms: "Conditions", contact: "Contact", pricing: "Tarifs", back: "← Retour à l'application", other: "English" },
  en: { privacy: "Privacy", terms: "Terms", contact: "Contact", pricing: "Pricing", back: "← Back to the app", other: "Français" },
};

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 underline">{CONTACT_EMAIL}</a>;

function Shell({ lang, other, title, children }: { lang: L; other: string; title: string; children: React.ReactNode }) {
  const t = LABELS[lang];
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex justify-between items-center mb-6 text-sm">
          <Link href="/" className="text-blue-600 hover:underline">{t.back}</Link>
          <Link href={other} className="text-slate-500 hover:underline" hrefLang={lang === "fr" ? "en" : "fr"}>{t.other}</Link>
        </div>
        <article className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm text-slate-700 text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:mt-6 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p]:mb-2">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{title}</h1>
          <p className="text-xs text-slate-400 mb-4">{BRAND} · {lang === "fr" ? "Dernière mise à jour" : "Last updated"} : {UPDATED[lang]}</p>
          {children}
        </article>
        <LegalFooterLinks lang={lang} />
      </div>
    </main>
  );
}

/* ───────────── Politique de confidentialité / Privacy ───────────── */
export function PrivacyPage({ lang }: { lang: L }) {
  if (lang === "en") {
    return (
      <Shell lang="en" other="/confidentialite" title="Privacy policy">
        <h2>Person responsible for personal information</h2>
        <p>{BRAND} is operated by {OPERATOR}, {CITY}. The person responsible for the protection of personal information (Québec Law 25) is <strong>{RESPONSIBLE}</strong>, reachable at <Mail />.</p>
        <h2>What we collect and where it is stored</h2>
        <ul>
          <li><strong>Data you type into the app</strong> (your business details, GST/QST{BRAND === "TradeQuote" ? "/RBQ" : ""} numbers, clients, line items, document history): stored <strong>only in your browser's local storage</strong> on your device. It is not sent to our servers; PDFs are generated in your browser.</li>
          <li><strong>Pro subscription payments</strong>: processed by Stripe. Stripe collects your name, email, billing address and card details; we never see your full card number. In our Stripe account we can see your name, email, billing address, subscription status and the last 4 digits of the card. Your browser keeps the Stripe subscription identifier so the app can confirm your Pro status with Stripe.</li>
          <li><strong>Technical logs</strong>: our host, Vercel, records technical data (IP address, browser, page requested, time) to operate and secure the service.</li>
          <li><strong>Emails you send us</strong>: your address and the content of your message.</li>
        </ul>
        <p>No advertising cookies, no third-party analytics, and we never sell or rent your information.</p>
        <h2>Why we use it</h2>
        <p>To provide the app, process and verify subscriptions, prevent fraud, answer your requests and meet our legal (tax) obligations.</p>
        <h2>Outside Québec</h2>
        <p>Stripe and Vercel may store or process information outside Québec, including in the United States. They are subject to the laws of those jurisdictions.</p>
        <h2>Retention</h2>
        <ul>
          <li>Browser data: until you delete it (button below, or by clearing your browser's site data).</li>
          <li>Payment records: for the length of the subscription, then as long as tax laws require (generally 6 years).</li>
          <li>Technical logs: according to Vercel's retention periods (short term).</li>
          <li>Emails: as long as needed to handle your request, at most 2 years after our last exchange.</li>
        </ul>
        <h2>Your rights</h2>
        <p>You can ask to access, correct or delete your personal information, withdraw your consent, or receive your information in a structured format. Write to <Mail />; we reply within 30 days. You may also file a complaint with the Commission d'accès à l'information du Québec (cai.gouv.qc.ca).</p>
        <h2>Security incidents</h2>
        <p>If a confidentiality incident presents a risk of serious injury, we will notify the Commission d'accès à l'information and the people concerned, as required by law.</p>
        <h2>Delete the data stored in this browser</h2>
        <ClearDataButton lang="en" />
      </Shell>
    );
  }
  return (
    <Shell lang="fr" other="/privacy" title="Politique de confidentialité">
      <h2>Responsable de la protection des renseignements personnels</h2>
      <p>{BRAND} est exploité par {OPERATOR}, {CITY}. La personne responsable de la protection des renseignements personnels (Loi 25) est <strong>{RESPONSIBLE}</strong>, joignable à <Mail />.</p>
      <h2>Renseignements recueillis et lieu de conservation</h2>
      <ul>
        <li><strong>Ce que vous saisissez dans l'application</strong> (coordonnées de votre entreprise, numéros TPS/TVQ{BRAND === "TradeQuote" ? "/RBQ" : ""}, clients, lignes, historique) : conservé <strong>uniquement dans le stockage local de votre navigateur</strong>, sur votre appareil. Ces données ne sont pas transmises à nos serveurs ; les PDF sont générés dans votre navigateur.</li>
        <li><strong>Paiement de l'abonnement Pro</strong> : traité par Stripe. Stripe recueille votre nom, courriel, adresse de facturation et carte ; nous n'avons jamais accès au numéro complet de la carte. Dans notre compte Stripe, nous voyons votre nom, courriel, adresse de facturation, le statut de l'abonnement et les 4 derniers chiffres de la carte. Votre navigateur conserve l'identifiant d'abonnement Stripe pour que l'application vérifie votre statut Pro auprès de Stripe.</li>
        <li><strong>Journaux techniques</strong> : notre hébergeur, Vercel, enregistre des données techniques (adresse IP, navigateur, page demandée, heure) pour faire fonctionner et sécuriser le service.</li>
        <li><strong>Courriels que vous nous envoyez</strong> : votre adresse et le contenu du message.</li>
      </ul>
      <p>Aucun témoin publicitaire, aucun outil d'analyse tiers, et nous ne vendons ni ne louons vos renseignements.</p>
      <h2>Fins</h2>
      <p>Fournir l'application, traiter et vérifier les abonnements, prévenir la fraude, répondre à vos demandes et respecter nos obligations légales (fiscales).</p>
      <h2>Communication à l'extérieur du Québec</h2>
      <p>Stripe et Vercel peuvent conserver ou traiter des renseignements à l'extérieur du Québec, notamment aux États-Unis, où ils sont soumis aux lois locales.</p>
      <h2>Durée de conservation</h2>
      <ul>
        <li>Données du navigateur : jusqu'à ce que vous les effaciez (bouton ci-dessous ou en effaçant les données du site dans votre navigateur).</li>
        <li>Dossiers de paiement : pendant l'abonnement, puis le temps exigé par les lois fiscales (généralement 6 ans).</li>
        <li>Journaux techniques : selon les délais de conservation de Vercel (courte durée).</li>
        <li>Courriels : le temps nécessaire pour traiter votre demande, au plus 2 ans après le dernier échange.</li>
      </ul>
      <h2>Vos droits</h2>
      <p>Vous pouvez demander l'accès à vos renseignements, leur rectification ou leur suppression, retirer votre consentement ou obtenir vos renseignements dans un format structuré. Écrivez à <Mail /> ; nous répondons dans un délai de 30 jours. Vous pouvez aussi porter plainte auprès de la Commission d'accès à l'information du Québec (cai.gouv.qc.ca).</p>
      <h2>Incidents de confidentialité</h2>
      <p>Si un incident de confidentialité présente un risque de préjudice sérieux, nous aviserons la Commission d'accès à l'information et les personnes concernées, comme l'exige la loi.</p>
      <h2>Effacer les données conservées dans ce navigateur</h2>
      <ClearDataButton lang="fr" />
    </Shell>
  );
}

/* ───────────── Conditions d'utilisation / Terms ───────────── */
export function TermsPage({ lang }: { lang: L }) {
  if (lang === "en") {
    return (
      <Shell lang="en" other="/conditions" title="Terms of use">
        <h2>1. Operator</h2>
        <p>{BRAND} is operated by {OPERATOR}, {CITY}. Contact: <Mail />.</p>
        <h2>2. Service</h2>
        <p>{BRAND} lets you create {BRAND === "TradeQuote" ? "quotes and invoices" : "invoices"} as PDFs. The free plan allows 5 documents per month with a watermark. The Pro plan removes these limits.</p>
        <h2>3. Pro subscription</h2>
        <ul>
          <li>Price: <strong>$9 CAD per month</strong> (or $79 CAD per year), plus applicable taxes, paid by card through Stripe.</li>
          <li>The subscription renews automatically at the end of each period until cancelled.</li>
          <li>We will give at least 30 days' notice by email before any price change.</li>
        </ul>
        <h2>4. Cancellation and refunds</h2>
        <ul>
          <li>You can <strong>cancel at any time</strong>: with the “Manage / cancel my subscription” button (on the Contact page or in the app), or by emailing <Mail /> from the address used at checkout.</li>
          <li>Cancellation takes effect at the end of the period already paid; Pro stays active until then.</li>
          <li><strong>No refund is given for partial months or periods</strong>, unless required by law.</li>
        </ul>
        <h2>5. Your responsibilities</h2>
        <p>You are responsible for the information you enter and for the documents you issue (tax rates, GST/QST numbers{BRAND === "TradeQuote" ? ", RBQ licence number" : ""}, mandatory notices). {BRAND} is a tool, not accounting, tax or legal advice. Your data is stored in your browser: keep your own copies of your PDFs.</p>
        <h2>6. Availability and liability</h2>
        <p>The service is provided “as is”. We do our best to keep it available but do not guarantee uninterrupted service. To the extent permitted by law, our liability is limited to the amounts you paid in the last 12 months. Nothing in these terms limits your rights under the Québec Consumer Protection Act.</p>
        <h2>7. Changes</h2>
        <p>We may update these terms; the date above shows the latest version. Material changes will be announced in advance.</p>
        <h2>8. Governing law</h2>
        <p>These terms are governed by the laws of the Province of Québec and the federal laws of Canada that apply there. Any dispute falls under the jurisdiction of the courts of Québec.</p>
      </Shell>
    );
  }
  return (
    <Shell lang="fr" other="/terms" title="Conditions d'utilisation">
      <h2>1. Exploitant</h2>
      <p>{BRAND} est exploité par {OPERATOR}, {CITY}. Contact : <Mail />.</p>
      <h2>2. Service</h2>
      <p>{BRAND} permet de créer {BRAND === "TradeQuote" ? "des soumissions et des factures" : "des factures"} en PDF. Le forfait gratuit permet 5 documents par mois, avec filigrane. Le forfait Pro retire ces limites.</p>
      <h2>3. Abonnement Pro</h2>
      <ul>
        <li>Prix : <strong>9 $ CA par mois</strong> (ou 79 $ CA par année), taxes applicables en sus, payé par carte via Stripe.</li>
        <li>L'abonnement se renouvelle automatiquement à la fin de chaque période jusqu'à son annulation.</li>
        <li>Toute modification de prix sera annoncée par courriel au moins 30 jours à l'avance.</li>
      </ul>
      <h2>4. Annulation et remboursement</h2>
      <ul>
        <li>Vous pouvez <strong>annuler en tout temps</strong> : avec le bouton « Gérer / annuler mon abonnement » (page Contact ou dans l'application), ou en écrivant à <Mail /> à partir de l'adresse utilisée lors du paiement.</li>
        <li>L'annulation prend effet à la fin de la période déjà payée ; le Pro reste actif jusque-là.</li>
        <li><strong>Aucun remboursement n'est accordé pour un mois ou une période entamée</strong>, sauf si la loi l'exige.</li>
      </ul>
      <h2>5. Vos responsabilités</h2>
      <p>Vous êtes responsable des renseignements saisis et des documents que vous émettez (taux de taxes, numéros TPS/TVQ{BRAND === "TradeQuote" ? ", numéro de licence RBQ" : ""}, mentions obligatoires). {BRAND} est un outil et ne constitue pas un conseil comptable, fiscal ou juridique. Vos données sont conservées dans votre navigateur : gardez vos propres copies de vos PDF.</p>
      <h2>6. Disponibilité et responsabilité</h2>
      <p>Le service est fourni « tel quel ». Nous faisons de notre mieux pour qu'il soit disponible, sans garantir un service ininterrompu. Dans la mesure permise par la loi, notre responsabilité se limite aux sommes que vous avez payées au cours des 12 derniers mois. Rien dans les présentes ne limite les droits que vous accorde la Loi sur la protection du consommateur du Québec.</p>
      <h2>7. Modifications</h2>
      <p>Nous pouvons mettre à jour ces conditions ; la date ci-dessus indique la version en vigueur. Les changements importants seront annoncés à l'avance.</p>
      <h2>8. Droit applicable</h2>
      <p>Ces conditions sont régies par les lois de la province de Québec et les lois fédérales du Canada qui s'y appliquent. Tout litige relève des tribunaux du Québec.</p>
    </Shell>
  );
}

/* ───────────── Contact ───────────── */
export function ContactPage({ lang }: { lang: L }) {
  const fr = lang === "fr";
  const cancelMail = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(fr ? `Annulation abonnement ${BRAND}` : `Cancel ${BRAND} subscription`)}`;
  return (
    <Shell lang={lang} other={fr ? "/contact-us" : "/contact"} title={fr ? "Nous joindre" : "Contact us"}>
      <p>{fr ? `${BRAND} est exploité par ${OPERATOR}, ${CITY}.` : `${BRAND} is operated by ${OPERATOR}, ${CITY}.`}</p>
      <p className="text-base">{fr ? "Courriel" : "Email"} : <Mail /></p>
      <p>{fr ? "Questions, problème technique, facture Stripe ou demande liée à vos renseignements personnels : écrivez-nous, nous répondons par courriel." : "Questions, technical issue, Stripe invoice or a personal-information request: email us and we will reply by email."}</p>

      <h2>{fr ? "Gérer ou annuler mon abonnement Pro" : "Manage or cancel my Pro subscription"}</h2>
      <ManageSubscription lang={lang} />
      <p className="mt-3">{fr ? "Ou par courriel :" : "Or by email:"}</p>
      <ol className="list-decimal pl-5 space-y-1">
        {fr ? (
          <>
            <li>Écrivez à <a href={cancelMail} className="text-blue-600 underline">{CONTACT_EMAIL}</a> avec l'objet « Annulation abonnement {BRAND} ».</li>
            <li>Envoyez-le à partir de l'adresse courriel utilisée lors du paiement (ou indiquez-la dans le message).</li>
            <li>Nous annulons le renouvellement et vous confirmons par courriel. Le Pro reste actif jusqu'à la fin de la période payée.</li>
          </>
        ) : (
          <>
            <li>Email <a href={cancelMail} className="text-blue-600 underline">{CONTACT_EMAIL}</a> with the subject “Cancel {BRAND} subscription”.</li>
            <li>Send it from the email address used at checkout (or include it in the message).</li>
            <li>We cancel the renewal and confirm by email. Pro stays active until the end of the paid period.</li>
          </>
        )}
      </ol>

      <h2>{fr ? "Renseignements personnels" : "Personal information"}</h2>
      <p>{fr ? "Responsable de la protection des renseignements personnels : " : "Person responsible for personal information: "}<strong>{RESPONSIBLE}</strong> — <Mail />. {fr ? "Réponse dans un délai de 30 jours." : "Reply within 30 days."}</p>
    </Shell>
  );
}
