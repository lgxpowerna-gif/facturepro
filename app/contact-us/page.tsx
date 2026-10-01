import type { Metadata } from "next";
import { ContactPage } from "@/components/Legal";

export const metadata: Metadata = { title: "Contact us", alternates: { canonical: "/contact-us" } };

export default function Page() {
  return <ContactPage lang="en" />;
}
