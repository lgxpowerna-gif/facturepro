import type { Metadata } from "next";
import { TermsPage } from "@/components/Legal";

export const metadata: Metadata = { title: "Terms of use", alternates: { canonical: "/terms" } };

export default function Page() {
  return <TermsPage lang="en" />;
}
