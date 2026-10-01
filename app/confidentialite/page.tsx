import type { Metadata } from "next";
import { PrivacyPage } from "@/components/Legal";

export const metadata: Metadata = { title: "Politique de confidentialité", alternates: { canonical: "/confidentialite" } };

export default function Page() {
  return <PrivacyPage lang="fr" />;
}
