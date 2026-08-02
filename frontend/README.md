# ShopX

An editorial, multi-category e-commerce app built with React, Vite, TypeScript, Express, MongoDB Atlas, and Razorpay Test Mode.

## Run locally

```bash
pnpm install
pnpm dev
```

## Backend setup

1. Create a MongoDB Atlas database user and add your development IP address to the Atlas project's IP access list.
2. Copy `server/.env.example` to `server/.env` and fill in the Atlas `mongodb+srv` connection string, a long JWT secret, an allowlisted admin email, and Razorpay **Test Mode** credentials.
3. Install server dependencies, seed the current catalog into Atlas, then start the API:

```bash
cd server
pnpm install
pnpm seed
pnpm dev
```

In another terminal, run `pnpm dev` at the repository root. Vite proxies `/api` to `http://localhost:5000` and preserves the secure session cookie.

Use `pnpm build` for the frontend and `pnpm build:api` for the backend TypeScript build.

## Current frontend scope

- Home, category, product listing, product detail, search, and cart routes.
- Atlas-backed public catalog, account registration/sign-in/profile, and customer order history.
- Cart persistence in browser local storage; product prices and the payable amount are recalculated on the server before a Razorpay order is created.
- Test Mode Razorpay Standard Checkout, server-side signature verification, and idempotent webhook processing.
- Role-protected admin API/UI for catalog archiving, customer lookup, paid-order fulfillment, and audit-only refund requests.

## Future backend connection

The API source is in `server/`. Product IDs and slugs remain stable client-facing IDs in MongoDB. Do not commit `.env` files or expose `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, or `JWT_SECRET` to the browser. Before Live Mode, deploy the API behind HTTPS and configure its public `/api/webhooks/razorpay` URL in Razorpay Dashboard.
