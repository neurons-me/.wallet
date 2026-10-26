---
layout: readme
title: Getting Started — this.wallet
---

[← Back to this.wallet Docs](https://neurons-me.github.io/.wallet/docs/)

# Getting Started

`this.wallet` is an ES module published on npm (current version 1.0.57).

```bash
npm install this.wallet
```

```js
import Wallet from 'this.wallet';

// No key given: a new random wallet is created in memory, with a mnemonic.
const wallet = new Wallet({ type: 'ethereum' });

console.log(wallet.address);
console.log(wallet.getTypeInfo().availableNetworks);
// ['mainnet', 'bnb', 'bnbTestnet', 'goerli', 'infuraMainnet', 'alchemyMainnet']

wallet.setNetwork('mainnet');          // required before any network call
const balance = await wallet.getBalance(); // decimal string, e.g. "0.0"
```

Open an existing wallet:

```js
const fromKey      = new Wallet({ type: 'ethereum', privateKey: '0x…' });
const fromMnemonic = new Wallet({ type: 'ethereum', mnemonic: 'word word …' });
```

Only `type: 'ethereum'` works today. See [Status](./Status.html).

## Keys

The private key and mnemonic live in memory on the wallet object. `export()` leaves them out
unless you pass `{ includeSecrets: true }`. If you export secrets and lose them, the funds cannot be recovered.
