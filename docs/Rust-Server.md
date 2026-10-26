---
layout: readme
title: Rust JSON-RPC Server — this.wallet
---

[← Back to this.wallet Docs](https://neurons-me.github.io/.wallet/docs/)

# Rust JSON-RPC Server (`wallet.crate`)

An Actix Web server that forwards JSON-RPC calls to EVM providers, so a frontend can make chain calls without holding provider API keys.

```bash
cd wallet.crate
cp .env.example .env   # fill in provider keys
cargo run --release    # listens on http://localhost:7878
```

## What it does

- Forwards `POST /rpc` to a list of upstream RPC URLs per chain.
- Rotates between upstreams (round-robin) and skips failing ones for a cooldown period.
- Only allows JSON-RPC methods on an allow-list.
- Limits requests per minute per origin and IP.
- Caches `eth_chainId` for a short time.
- Permissive CORS.

## Routes

| Route | Purpose |
|---|---|
| `GET /health` | Returns `ok`. |
| `POST /rpc` | JSON-RPC proxy. |
| `GET /meta`, `/meta/evm-networks` | Server and network info as JSON. |
| `GET /meta/upstreams`, `/dev/eth-upstreams` | Upstream inspection, when `EXPOSE_UPSTREAMS=1`. |
| `GET /`, `/ethereum`, `/json-rpc-overview`, `/eth-playground`, `/eth/endpoints`, `/evm-networks-page` | HTML pages. |
| `GET /bitcoin`, `/stellar` | Placeholder pages. No Bitcoin or Stellar support. |

## Configuration

Set in `.env` (see `.env.example`): `BIND`, `PUBLIC_BASE`, `PUBLIC_RPCS_<CHAIN>` (MAINNET, SEPOLIA, GOERLI, BNB, POLYGON),
`INFURA_*`, `ALCHEMY_*`, `ANKR_KEY`, `RATE_LIMIT_PER_MINUTE`, `RR_ENABLED`, `CB_COOLDOWN_SECS`, `CACHE_CHAINID_TTL`, `EXPOSE_UPSTREAMS`.
