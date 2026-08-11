import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 500 }
      );
    }

    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    if (!sessionId.startsWith("cs_")) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const paid =
      session.payment_status === "paid" || session.status === "complete";

    return NextResponse.json({
      valid: paid,
      status: session.status,
      payment_status: session.payment_status,
      mode: session.mode,
      customer: session.customer,
      subscription: session.subscription,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Session verification failed";
    console.error("Verify session error:", message);
    return NextResponse.json({ error: message, valid: false }, { status: 500 });
  }
}
