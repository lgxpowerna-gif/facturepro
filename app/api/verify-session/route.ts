import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const APP = "facturepro";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe not configured", valid: false },
        { status: 500 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    });

    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Missing sessionId", valid: false },
        { status: 400 }
      );
    }

    if (!sessionId.startsWith("cs_")) {
      return NextResponse.json(
        { error: "Invalid sessionId", valid: false },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    // Only accept sessions created by this app when metadata is present
    const metaApp = session.metadata?.app;
    if (metaApp && metaApp !== APP) {
      return NextResponse.json(
        {
          error: "Session belongs to another application",
          valid: false,
          code: "wrong_app",
        },
        { status: 403 }
      );
    }

    const paid =
      session.payment_status === "paid" || session.status === "complete";

    let subscriptionStatus: string | null = null;
    if (session.subscription) {
      if (typeof session.subscription === "string") {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        subscriptionStatus = sub.status;
      } else {
        subscriptionStatus = session.subscription.status;
      }
    }

    const activeSub =
      !subscriptionStatus ||
      subscriptionStatus === "active" ||
      subscriptionStatus === "trialing";

    return NextResponse.json({
      valid: paid && activeSub,
      status: session.status,
      payment_status: session.payment_status,
      mode: session.mode,
      customer: session.customer,
      subscription: typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id ?? null,
      subscription_status: subscriptionStatus,
      app: session.metadata?.app ?? null,
      plan: session.metadata?.plan ?? null,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Session verification failed";
    console.error(`[${APP}] Verify session error:`, message);
    return NextResponse.json(
      { error: message, valid: false },
      { status: 500 }
    );
  }
}
