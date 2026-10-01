import type { Metadata } from "next";
import { TermsPage } from "@/components/Legal";

export const metadata: Metadata = { title: "Conditions d'utilisation", alternates: { canonical: "/conditions" } };

export default function Page() {
  return <TermsPage lang="fr" />;
}
