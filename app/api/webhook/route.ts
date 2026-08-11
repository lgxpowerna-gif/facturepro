import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      code: code || (status >= 500 ? "server_error" : "client_error"),
    },
    { status }
  );
}

export async function GET() {
  const configured = Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET
  );
  return NextResponse.json({
    ok: true,
    service: "facturepro-stripe-webhook",
    configured,
    hint: configured
      ? "POST Stripe events to this endpoint"
      : "Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Vercel env vars",
  });
}

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!key) {
    return jsonError("Stripe not configured (missing STRIPE_SECRET_KEY)", 500, "missing_secret_key");
  }

  if (!secret) {
    return jsonError(
      "STRIPE_WEBHOOK_SECRET not set. Add it in Vercel after creating the Stripe webhook endpoint.",
      500,
      "missing_webhook_secret"
    );
  }

  const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

  let body: string;
  try {
    body = await req.text();
  } catch {
    return jsonError("Could not read request body", 400, "invalid_body");
  }

  if (!body || body.length === 0) {
    return jsonError("Empty request body", 400, "empty_body");
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return jsonError("Missing stripe-signature header", 400, "missing_signature");
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[webhook] signature verification failed:", message);
    return jsonError("Invalid Stripe signature", 400, "invalid_signature");
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("[webhook] checkout.session.completed", {
          eventId: event.id,
          sessionId: session.id,
          customer: session.customer,
          subscription: session.subscription,
          payment_status: session.payment_status,
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`[webhook] ${event.type}`, { id: sub.id, status: sub.status });
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        console.log(`[webhook] ${event.type}`, { id: inv.id, customer: inv.customer });
        break;
      }
      default:
        console.log("[webhook] unhandled", event.type);
    }

    return NextResponse.json({ ok: true, received: true, eventId: event.id, type: event.type });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook handler failed";
    console.error("[webhook] handler error:", message);
    return jsonError(message, 500, "handler_error");
  }
}
