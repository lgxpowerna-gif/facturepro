import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { isEntitled, isValidSubscriptionId } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP = "facturepro";

/**
 * Server-side Pro check. Uses only the existing STRIPE_SECRET_KEY (no new secret, no DB).
 * Body: { subscriptionId: "sub_..." }  ->  { pro: true|false|null, status, cancel_at_period_end, current_period_end }
 * pro=null means "could not check" (Stripe not configured / unreachable); the client then
 * falls back to its last confirmed state for a short grace period.
 */
export async function POST(req: NextRequest) {
  let subscriptionId: unknown;
  try {
    ({ subscriptionId } = await req.json());
  } catch {
    return NextResponse.json({ pro: false, error: "Bad JSON" }, { status: 400 });
  }
  if (!isValidSubscriptionId(subscriptionId)) {
    return NextResponse.json({ pro: false, error: "Invalid subscriptionId" }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ pro: null, error: "Stripe not configured" }, { status: 503 });
  }
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const pro = isEntitled(sub.status, sub.metadata?.app, APP);
    return NextResponse.json(
      {
        pro,
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end,
        current_period_end: sub.current_period_end,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: unknown) {
    const e = err as { type?: string; code?: string; message?: string };
    if (e?.code === "resource_missing") {
      return NextResponse.json({ pro: false, error: "Unknown subscription" }, { status: 404 });
    }
    console.error(`[${APP}] subscription-status error:`, e?.message);
    return NextResponse.json({ pro: null, error: "Stripe unreachable" }, { status: 502 });
  }
}
