import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const APP = "facturepro";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe is not configured. Missing STRIPE_SECRET_KEY." },
        { status: 500 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    });

    const body = await req.json();
    const mode = body.mode as "monthly" | "yearly";

    if (mode !== "monthly" && mode !== "yearly") {
      return NextResponse.json(
        { error: "Invalid mode. Use monthly or yearly." },
        { status: 400 }
      );
    }

    const priceId =
      mode === "yearly"
        ? process.env.STRIPE_PRICE_YEARLY
        : process.env.STRIPE_PRICE_MONTHLY;

    if (!priceId) {
      return NextResponse.json(
        {
          error:
            "Missing price ID. Set STRIPE_PRICE_MONTHLY and STRIPE_PRICE_YEARLY in Vercel environment variables.",
        },
        { status: 400 }
      );
    }

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://facturepro-eight.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=true`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      locale: "auto",
      client_reference_id: `${APP}_${mode}_${Date.now()}`,
      metadata: {
        app: APP,
        plan: mode,
      },
      subscription_data: {
        metadata: {
          app: APP,
          plan: mode,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create checkout session";
    console.error(`[${APP}] Stripe checkout error:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
