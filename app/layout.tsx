import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = "https://facturepro.faitle.net";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FacturePro – Factures en français avec TPS et TVQ | Gratuit",
    template: "%s | FacturePro",
  },
  description:
    "Créez des factures professionnelles en français en 30 secondes : TPS 5 % et TVQ 9,975 % calculées séparément, numéros TPS/TVQ, Virement Interac, PDF. Gratuit · Pro 9 $/mois.",
  keywords: [
    "invoice generator Canada",
    "générateur de factures",
    "GST HST invoice",
    "facture TPS TVH",
    "Canadian invoice PDF",
    "Interac invoice",
    "freelance invoice Canada",
    "small business invoicing",
  ],
  authors: [{ name: "FacturePro" }],
  creator: "FacturePro",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: siteUrl, languages: { "fr-CA": siteUrl, "en-CA": siteUrl, es: siteUrl } },
  openGraph: {
    type: "website",
    locale: "fr_CA",
    alternateLocale: ["en_CA", "es_ES"],
    url: siteUrl,
    siteName: "FacturePro",
    title: "FacturePro – Factures avec TPS et TVQ",
    description: "Factures professionnelles en français avec TPS/TVQ. Gratuit pour commencer. Pro illimité à 9 $/mois.",
  },
  twitter: {
    card: "summary_large_image",
    title: "FacturePro – Canadian Invoice Generator",
    description: "GST/HST invoices in seconds. Free plan available. Made for Canada.",
  },
  category: "business",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FacturePro",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: [
    { "@type": "Offer", price: "0", priceCurrency: "CAD", name: "Free" },
    { "@type": "Offer", price: "9.00", priceCurrency: "CAD", name: "Pro Monthly" },
    { "@type": "Offer", price: "79.00", priceCurrency: "CAD", name: "Pro Yearly" },
  ],
  description: "Générateur de factures avec TPS/TVQ (Québec) et taxes canadiennes, en français, export PDF.",
  url: siteUrl,
  inLanguage: ["fr-CA", "en-CA", "es"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-CA">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
