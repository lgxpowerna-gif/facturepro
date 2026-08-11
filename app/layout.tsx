import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = "https://facturepro-eight.vercel.app";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FacturePro – Free Canadian Invoice Generator | GST/HST",
    template: "%s | FacturePro",
  },
  description:
    "Create professional CAD invoices in seconds. GST/HST by province, Interac notes, FR/EN/ES. Free plan · Pro from $9/mo CAD. Built for Canadian freelancers & SMBs.",
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
  alternates: { canonical: siteUrl, languages: { en: siteUrl, fr: siteUrl, es: siteUrl } },
  openGraph: {
    type: "website",
    locale: "en_CA",
    alternateLocale: ["fr_CA", "es_ES"],
    url: siteUrl,
    siteName: "FacturePro",
    title: "FacturePro – Free Canadian Invoice Generator",
    description: "Professional CAD invoices with GST/HST. Free to start. Pro unlimited from $9/mo.",
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
  description: "Canadian invoice generator with GST/HST, multi-language, and PDF export.",
  url: siteUrl,
  inLanguage: ["en", "fr", "es"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
