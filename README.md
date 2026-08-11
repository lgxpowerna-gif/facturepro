# FacturePro

Canadian invoice generator SaaS.

**Live:** https://facturepro-eight.vercel.app

## Status

- Homepage + Stripe checkout: live in production
- Webhook + verify-session: included in this repo (deploy ZIP or connect Git to roll out)

## Env vars (Vercel)

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_YEARLY`
- `STRIPE_WEBHOOK_SECRET` (optional)

## Deploy

1. Connect this repo in Vercel → Project → Settings → Git
2. Or upload the complete ZIP from Drive

## Stack

Next.js 14, Tailwind, Stripe, jsPDF
