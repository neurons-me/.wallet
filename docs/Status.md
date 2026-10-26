---
layout: readme
title: Status — this.wallet
---

[← Back to this.wallet Docs](https://neurons-me.github.io/.wallet/docs/)

# Status

| Part | Path in repo | Status |
|---|---|---|
| Ethereum / EVM handler | `wallet.npm/src/types/ethereum.js` | Working. Uses ethers v6. |
| Bitcoin handler | `wallet.npm/src/types/bitcoin.js` | Not implemented. The file is empty. |
| Stellar handler | `wallet.npm/src/types/stellar.js` | Not implemented. The file is empty. |
| Rust JSON-RPC server | `wallet.crate` (crate `this-wallet` 0.1.1) | Working for EVM chains. `/bitcoin` and `/stellar` pages are placeholders. |
| Python package | `wallet.pip` | Stub only. No wallet code. |

`new Wallet({ type: 'bitcoin' })` and `new Wallet({ type: 'stellar' })` currently throw, because those modules export nothing.

## Python {#python}

`wallet.pip` contains a `setup.py` and an `__init__.py` with a placeholder function. It is not usable yet.
