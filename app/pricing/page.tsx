import type { Metadata } from "next";
import PricingPage from "@/components/PricingPage";

export const metadata: Metadata = {
  title: "Pricing",
  description: "FacturePro — Free or Pro at $9/mo CAD.",
  alternates: { canonical: "/pricing", languages: { "fr-CA": "/tarifs", "en-CA": "/pricing" } },
};

export default function Page() {
  return <PricingPage lang="en" />;
}
