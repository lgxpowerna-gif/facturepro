import type { Metadata } from "next";
import PricingPage from "@/components/PricingPage";

export const metadata: Metadata = {
  title: "Tarifs",
  description: "FacturePro — Gratuit ou Pro à 9 $/mois. TPS/TVQ, en français.",
  alternates: { canonical: "/tarifs", languages: { "fr-CA": "/tarifs", "en-CA": "/pricing" } },
};

export default function Page() {
  return <PricingPage lang="fr" />;
}
