import type { Metadata } from "next";
import { PrivacyPage } from "@/components/Legal";

export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

export default function Page() {
  return <PrivacyPage lang="en" />;
}
