import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { isValidSubscriptionId } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP = "facturepro";

/**
 * Opens the Stripe Customer Portal (manage card / cancel) for the subscription remembered in the browser.
 * Uses only the existing STRIPE_SECRET_KEY. Requires the portal to be activated once in the Stripe dashboard
 * (Settings → Billing → Customer portal); otherwise returns { fallback: "email" } and the UI shows the contact email.
 */
export async function POST(req: NextRequest) {
  let body: { subscriptionId?: unknown; lang?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  if (!isValidSubscriptionId(body.subscriptionId)) {
    return NextResponse.json({ error: "Invalid subscriptionId", fallback: "email" }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured", fallback: "email" }, { status: 503 });
  }
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
    const sub = await stripe.subscriptions.retrieve(body.subscriptionId);
    if (sub.metadata?.app !== APP) {
      return NextResponse.json({ error: "Wrong app", fallback: "email" }, { status: 403 });
    }
    const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || "https://facturepro.faitle.net";
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/`,
      locale: body.lang === "en" ? "en" : "fr-CA",
    });
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const e = err as { message?: string; code?: string };
    console.error(`[${APP}] portal error:`, e?.message);
    return NextResponse.json({ error: "Portal unavailable", fallback: "email" }, { status: 502 });
  }
}
