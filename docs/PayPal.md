---
layout: readme
title: PayPal — this.wallet
---

[← Back to this.wallet Docs](https://neurons-me.github.io/.wallet/docs/)

# PayPal

**Status: planned. Nothing is implemented yet.**

PayPal is a provider, not a chain or a currency. This page says what exists in this repo today, what is planned, and which PayPal APIs the plan relies on.

## What exists today

| Part | Status |
|---|---|
| PayPal code in `wallet.npm` | None. `new Wallet({ type: 'paypal' })` throws `Unsupported wallet type: paypal`, like any type that has no handler. |
| PayPal code in `wallet.crate` | None. The Rust server only proxies EVM JSON-RPC. |
| PayPal code in `wallet.pip` | None. The package is a stub. |
| Demo UI | [Paypal .me](/.wallet/paypal/demos/split/): an entry form (text and receipt photo). It is UI only and sends nothing. |

The existing wallet handlers are per chain (see [Wallet API](./Wallet-API.html) and [Status](./Status.html)). A PayPal provider does not map one to one onto that interface, and how it will be exposed has not been decided.

## Planned

Settling one debt through PayPal, after the person who owes it approves:

1. Create an order for the amount owed with the PayPal Orders API.
2. The payer approves it in PayPal.
3. Capture the approved order.

None of these steps is built. PayPal's REST APIs authenticate with a client ID and secret exchanged for an OAuth 2.0 access token, so the secret has to stay on a server and cannot ship in browser code.

## PayPal documentation

- [REST APIs overview](https://developer.paypal.com/api/rest)
- [Authentication](https://developer.paypal.com/api/rest/authentication/): client ID and secret, access token.
- [Orders v2](https://developer.paypal.com/api/orders/v2): `POST /v2/checkout/orders` (create), `POST /v2/checkout/orders/{id}/capture` (capture).
- [Sandbox testing](https://developer.paypal.com/sandbox-testing/overview)

## Demos

[Paypal .me](/.wallet/paypal/demos/split/) was made for the PayPal AI hackathon. It is in development.
