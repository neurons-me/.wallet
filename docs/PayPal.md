---
layout: readme
title: PayPal — this.wallet
---

[← Back to this.wallet Docs](https://neurons-me.github.io/.wallet/docs/)

# PayPal

**Status: sandbox provider built (Orders v2 create / capture, verified webhooks), run locally. Not tested against PayPal yet: no sandbox credentials have been configured. Not in `wallet.npm` / `wallet.crate` / `wallet.pip`.**

PayPal is a provider, not a chain or a currency. In .wallet it is a provider layer that any page can use; the [Split app](/.wallet/paypal/split/) is its first consumer.

## The pieces

| Part | Where | What it does |
|---|---|---|
| Provider module | `assets/providers/paypal/paypal-provider.js` | One file for Node and the browser (`window.WalletPayPal`). Converts cents to PayPal's decimal string (`toValue` / `fromValue`), validates order input, builds the Orders v2 payload, reads capture responses and webhooks into one capture event. Browser client: `WalletPayPal.client({ baseUrl })` with `health()`, `createOrder()`, `capture()`, `events(onCapture)` (SSE), `charge()` (approve popup). No credentials. |
| Local server | `tools/paypal-server.mjs` | Holds the client id and secret, gets the OAuth token, talks to `api-m.sandbox.paypal.com`. Listens on `127.0.0.1:8788`. |
| Split consumer | `assets/wallet-gui.js` (SplitApp), `assets/split/split-me.js` (`recordPayment`) | A **Charge with PayPal** button next to each suggested transfer. When the payment is captured, writes `paid.<member>` and `payments.<captureId>` to .me and adds a settlement entry, so the kernel recomputes every net. |
| Tests | `tests/paypal/paypal.test.mjs`, `tests/split/split.test.cjs` | PayPal is mocked. |

Money is integer cents in .wallet and .me. It becomes a decimal string (`"12.34"`) only in the order payload sent to PayPal, and is read back to cents from the capture. Zero-decimal currencies (JPY, HUF, TWD) are handled.

## Server endpoints

| Method / path | Body / query | Returns |
|---|---|---|
| `GET /health` | | `{ ok, provider, env, configured, webhookConfigured }` (never the values) |
| `POST /orders` | `{ member, amountCents, currency, groupId, to?, description?, payeeEmail? }` | `{ id, status, approveUrl }`. Order: `intent: CAPTURE`; `custom_id` carries group, member and recipient. |
| `POST /orders/:id/capture` | | the capture event |
| `GET /return?token=<orderId>` | PayPal's `return_url` after approval | captures the order, closes the popup |
| `POST /webhooks/paypal` | a PayPal webhook | verified with `POST /v1/notifications/verify-webhook-signature` (`verification_status` must be `SUCCESS`). On `PAYMENT.CAPTURE.COMPLETED`, emits the capture. |
| `GET /events` | | SSE, event `capture`: `{ orderId, captureId, status, amountCents, currency, groupId, member, to }` |

Each capture is emitted once per capture id, whether it arrives from `/capture`, `/return` or the webhook. `recordPayment` in split-me.js is idempotent per capture id too.

## Flow (Split)

1. Split suggests "Bo → Ana 10.00 USD". Bo clicks **Charge with PayPal**.
2. The page calls `POST /orders` (`member: bo`, `to: ana`, `amountCents: 1000`). A popup opens PayPal's approve page (sandbox).
3. After approval, PayPal redirects to `/return`, which captures the order. The capture event goes out over `/events`. If a webhook is set up, PayPal also confirms it with `PAYMENT.CAPTURE.COMPLETED`.
4. The page writes `paid.bo = 1000` in .me and adds the settlement entry. Bo's net goes to 0, and the transfer disappears.

The money goes to the PayPal account that owns the app's credentials (the sandbox business account). To pay a member's own PayPal account, pass `payeeEmail`.

Publicly (on github.io, without the local server) the button stays disabled with "PayPal · off: run node tools/paypal-server.mjs locally", the same way the Meta option works.

## Setup (sandbox)

1. On [developer.paypal.com](https://developer.paypal.com/dashboard/applications/sandbox), create a sandbox REST app. Copy its client ID and secret.
2. In the repo root, create `.env` (git-ignored; never commit it):

   ```
   PAYPAL_CLIENT_ID=...
   PAYPAL_CLIENT_SECRET=...
   PAYPAL_WEBHOOK_ID=...        # optional, only for webhooks
   # PAYPAL_ENV=sandbox         # default; "live" switches to api-m.paypal.com
   # PORT=8788                  # default
   # PAYPAL_PUBLIC_BASE=        # base URL PayPal returns to; default http://127.0.0.1:8788
   ```

3. Run `node tools/paypal-server.mjs`. It prints whether credentials are configured, never their values.
4. Serve the site locally, or open the github.io page; the server allows `https://neurons-me.github.io` and localhost origins. Add members and an expense, then use **Charge with PayPal**. Approve with a sandbox *personal* account from the dashboard.
5. Webhooks (optional; capture already works without them): PayPal has to reach the server over public HTTPS, so expose it with a tunnel (for example `cloudflared tunnel --url http://127.0.0.1:8788`). In the sandbox app, add a webhook at `https://<tunnel>/webhooks/paypal` for **Payment capture completed** (`PAYMENT.CAPTURE.COMPLETED`), then put its Webhook ID in `PAYPAL_WEBHOOK_ID`. Without `PAYPAL_WEBHOOK_ID`, `/webhooks/paypal` answers 503.

Tests (no credentials needed): `node --test tests/paypal/paypal.test.mjs` and `cd tests/split && npm install && npm test`.

## PayPal documentation

- [REST APIs overview](https://developer.paypal.com/api/rest)
- [Authentication](https://developer.paypal.com/api/rest/authentication/): client ID and secret, access token.
- [Orders v2](https://developer.paypal.com/api/orders/v2): `POST /v2/checkout/orders` (create), `POST /v2/checkout/orders/{id}/capture` (capture).
- [Sandbox testing](https://developer.paypal.com/sandbox-testing/overview)
- [Webhooks](https://developer.paypal.com/api/rest/webhooks/) and [verify webhook signature](https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature_post)

## Demos

[Paypal .me](/.wallet/paypal/split/) was made for the PayPal AI hackathon. It is in development. It charges real PayPal **sandbox** orders when the local server runs.
