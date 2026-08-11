import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const APP = "facturepro";

/** In-memory idempotency for recent event ids (per serverless instance). */
const processedEvents = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_MAX = 500;

function pruneProcessed() {
  const now = Date.now();
  const entries = Array.from(processedEvents.entries());
  for (let i = 0; i < entries.length; i++) {
    const id = entries[i][0];
    const ts = entries[i][1];
    if (now - ts > IDEMPOTENCY_TTL_MS) processedEvents.delete(id);
  }
  if (processedEvents.size > IDEMPOTENCY_MAX) {
    const sorted = Array.from(processedEvents.entries()).sort(function (a, b) {
      return a[1] - b[1];
    });
    for (let i = 0; i < sorted.length - IDEMPOTENCY_MAX; i++) {
      processedEvents.delete(sorted[i][0]);
    }
  }
}

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      code: code || (status >= 500 ? "server_error" : "client_error"),
      app: APP,
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
    service: `${APP}-stripe-webhook`,
    configured,
    security: {
      signature_verification: true,
      raw_body: true,
      idempotency: true,
    },
    hint: configured
      ? "POST Stripe events to this endpoint. Requires valid Stripe-Signature."
      : "Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Vercel env vars",
  });
}

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!key) {
    console.error(`[${APP}/webhook] missing STRIPE_SECRET_KEY`);
    return jsonError(
      "Stripe not configured (missing STRIPE_SECRET_KEY)",
      500,
      "missing_secret_key"
    );
  }

  if (!secret) {
    console.error(`[${APP}/webhook] missing STRIPE_WEBHOOK_SECRET`);
    return jsonError(
      "STRIPE_WEBHOOK_SECRET not set. Add the signing secret from Stripe Dashboard → Webhooks.",
      500,
      "missing_webhook_secret"
    );
  }

  const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

  // Raw body is required for signature verification — never req.json() first
  let body: string;
  try {
    body = await req.text();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to read body";
    console.error(`[${APP}/webhook] body read error:`, message);
    return jsonError("Could not read request body", 400, "invalid_body");
  }

  if (!body || body.length === 0) {
    return jsonError("Empty request body", 400, "empty_body");
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return jsonError(
      "Missing stripe-signature header",
      400,
      "missing_signature"
    );
  }

  // Verify Stripe-Signature (HMAC) — rejects forged or replayed-with-bad-sig requests
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error(`[${APP}/webhook] signature verification failed:`, message);
    return jsonError("Invalid Stripe signature", 400, "invalid_signature");
  }

  // Idempotency: acknowledge duplicates with 200 so Stripe stops retrying
  pruneProcessed();
  if (processedEvents.has(event.id)) {
    return NextResponse.json({
      ok: true,
      received: true,
      duplicate: true,
      eventId: event.id,
      type: event.type,
      app: APP,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[${APP}/webhook] checkout.session.completed`, {
          eventId: event.id,
          sessionId: session.id,
          customer: session.customer,
          subscription: session.subscription,
          payment_status: session.payment_status,
          status: session.status,
          mode: session.mode,
          metadata: session.metadata,
          client_reference_id: session.client_reference_id,
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`[${APP}/webhook] ${event.type}`, {
          eventId: event.id,
          subscriptionId: sub.id,
          status: sub.status,
          customer: sub.customer,
          metadata: sub.metadata,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`[${APP}/webhook] subscription canceled`, {
          eventId: event.id,
          subscriptionId: sub.id,
          customer: sub.customer,
          status: sub.status,
        });
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        console.log(`[${APP}/webhook] invoice.paid (renewal ok)`, {
          eventId: event.id,
          invoiceId: inv.id,
          customer: inv.customer,
          amount_paid: inv.amount_paid,
          billing_reason: inv.billing_reason,
        });
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        console.error(`[${APP}/webhook] invoice.payment_failed`, {
          eventId: event.id,
          invoiceId: inv.id,
          customer: inv.customer,
          attempt_count: inv.attempt_count,
          billing_reason: inv.billing_reason,
        });
        break;
      }
      default:
        console.log(`[${APP}/webhook] unhandled event`, {
          eventId: event.id,
          type: event.type,
        });
    }

    processedEvents.set(event.id, Date.now());

    return NextResponse.json({
      ok: true,
      received: true,
      eventId: event.id,
      type: event.type,
      app: APP,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Webhook handler failed";
    console.error(`[${APP}/webhook] handler error:`, {
      eventId: event?.id,
      type: event?.type,
      message,
    });
    // 500 → Stripe retries (correct for transient failures)
    return jsonError(message, 500, "handler_error");
  }
}
