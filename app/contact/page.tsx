import type { Metadata } from "next";
import { ContactPage } from "@/components/Legal";

export const metadata: Metadata = { title: "Nous joindre", alternates: { canonical: "/contact" } };

export default function Page() {
  return <ContactPage lang="fr" />;
}
