import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FacturePro – Free Canadian Invoice Generator",
  description:
    "Create professional CAD invoices in seconds. GST/HST ready, Interac, multi-language. Free plan available.",
  openGraph: {
    title: "FacturePro – Free Canadian Invoice Generator",
    description: "Professional invoices for Canadian freelancers & small businesses.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
