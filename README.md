<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid rgba(127,127,127,0.3);padding-bottom:12px;margin-bottom:16px;">
  <div style="min-width:0;">
    <h1 id="wallet" style="border-bottom:none;margin:0 0 8px 0;padding:0;">.wallet</h1>
    <p style="margin:0;opacity:0.75;"><em>Wallet handlers for <a href="https://neurons-me.github.io/.me/">.me</a>.</em></p>
  </div>
  <img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1765902981/this.wallet_giyxtt.webp" alt="this.wallet" style="width:104px;max-width:28vw;height:auto;flex:0 0 auto;" />
</div>

`this.wallet` creates and opens crypto wallets, selects a network, reads balances, sends the native coin and signs messages. Today it works with **Ethereum and EVM-compatible networks** only. **Bitcoin and Stellar are not implemented yet.**

You hold the keys. If you export a private key or mnemonic and lose it, the funds cannot be recovered.

------

## ⚡ Quick Start

```bash
npm install this.wallet
```

```js
import Wallet from 'this.wallet';

const wallet = new Wallet({ type: 'ethereum' }); // new random wallet, in memory
wallet.setNetwork('mainnet');
console.log(wallet.address, await wallet.getBalance());
```

More in [Getting Started](https://neurons-me.github.io/.wallet/docs/Getting-Started.html).

------

## Status

| Part | Status |
|---|---|
| Ethereum / EVM handler (`wallet.npm`) | Working |
| Bitcoin handler | Not implemented |
| Stellar handler | Not implemented |
| Rust JSON-RPC server (`wallet.crate`) | Working for EVM chains |
| Python package (`wallet.pip`) | Stub |

Details in [Status](https://neurons-me.github.io/.wallet/docs/Status.html).

------

## The pieces

**[wallet.npm](https://www.npmjs.com/package/this.wallet)** — the JavaScript package `this.wallet`. A `Wallet` class that delegates to a handler per chain.

**[wallet.crate](https://neurons-me.github.io/.wallet/docs/Rust-Server.html)** — an Actix server that proxies EVM JSON-RPC calls, so a frontend does not need provider API keys.

**wallet.pip** — placeholder for a Python package.

This repo uses a dot-prefixed name as a system-level module: `.me` is the identity layer, `.wallet` is the economy layer.

------

## Where to go from here:
- **All docs** → [this.wallet Docs](https://neurons-me.github.io/.wallet/docs/)
- **Use it in code** → [Wallet API](https://neurons-me.github.io/.wallet/docs/Wallet-API.html) · [Ethereum Handler](https://neurons-me.github.io/.wallet/docs/Ethereum-Handler.html)
- **Run the RPC proxy** → [Rust JSON-RPC Server](https://neurons-me.github.io/.wallet/docs/Rust-Server.html)
- **New to blockchains, networks and tokens?** → [Concepts](https://neurons-me.github.io/.wallet/docs/Concepts.html)
- **Package** → [this.wallet on npm](https://www.npmjs.com/package/this.wallet)

------

[Github Home](https://neurons-me.github.io)

**MIT —** [neurons.me](https://neurons.me)

**Author:** [suiGn](https://suign.github.io/)

<img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760629064/neurons.me_b50f6a.png" alt="neurons.me Logo" width="89"/>
