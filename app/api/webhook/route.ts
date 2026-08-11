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
    console.error("[webhook] missing STRIPE_SECRET_KEY");
    return jsonError("Stripe not configured (missing STRIPE_SECRET_KEY)", 500, "missing_secret_key");
  }

  if (!secret) {
    console.error("[webhook] missing STRIPE_WEBHOOK_SECRET");
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to read body";
    console.error("[webhook] body read error:", message);
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
          status: session.status,
          mode: session.mode,
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`[webhook] ${event.type}`, {
          eventId: event.id,
          subscriptionId: sub.id,
          status: sub.status,
          customer: sub.customer,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        console.log("[webhook] subscription canceled", {
          eventId: event.id,
          subscriptionId: sub.id,
          customer: sub.customer,
        });
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        console.log("[webhook] invoice.paid", {
          eventId: event.id,
          invoiceId: inv.id,
          customer: inv.customer,
          amount_paid: inv.amount_paid,
        });
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        console.error("[webhook] invoice.payment_failed", {
          eventId: event.id,
          invoiceId: inv.id,
          customer: inv.customer,
          attempt_count: inv.attempt_count,
        });
        break;
      }
      default:
        console.log("[webhook] unhandled event", {
          eventId: event.id,
          type: event.type,
        });
    }

    return NextResponse.json({
      ok: true,
      received: true,
      eventId: event.id,
      type: event.type,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook handler failed";
    console.error("[webhook] handler error:", {
      eventId: event?.id,
      type: event?.type,
      message,
    });
    return jsonError(message, 500, "handler_error");
  }
}
