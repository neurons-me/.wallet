---
layout: readme
title: Ethereum Handler — this.wallet
---

[← Back to this.wallet Docs](https://neurons-me.github.io/.wallet/docs/)

# Ethereum Handler

`wallet.npm/src/types/ethereum.js`. Works with Ethereum and other EVM chains. Built on ethers v6.

## Methods

| Method | Returns | Notes |
|---|---|---|
| `generateAddress()` | address | Replaces the current key with a new random one. The old key is dropped. |
| `getBalance()` | `Promise<string>` | Native balance, 18 decimals, as a decimal string. |
| `sendCrypto(to, amount, overrides?)` | `Promise<{ hash, network, symbol }>` | Sends the native coin. `amount` is in whole units, e.g. `"0.01"`. |
| `send(to, amount, overrides?)` | same | Old name for `sendCrypto`. |
| `sign(message)` | `Promise<string>` | EIP-191 message signature. |
| `verifySignature(message, signature)` | boolean | True if the signature recovers to this wallet's address. |
| `getSymbol()` | string | Symbol of the active network, default `ETH`. |
| `addNetwork`, `setNetwork`, `export`, `getTypeInfo` | | See [Wallet API](./Wallet-API.html). |

ERC-20 tokens are not supported yet; only native coin transfers.

## Default networks

| Name | Chain ID | Symbol |
|---|---|---|
| `mainnet` | 1 | ETH |
| `bnb` | 56 | BNB |
| `bnbTestnet` | 97 | tBNB |
| `goerli` | 5 | GoerliETH |
| `infuraMainnet` | 1 | ETH (needs `INFURA_KEY`) |
| `alchemyMainnet` | 1 | ETH (needs `ALCHEMY_KEY`) |

Goerli has been shut down upstream; prefer adding Sepolia with `addNetwork`.

## How the RPC URL is chosen

For the active network, in this order:

1. `proxyBase`: e.g. `http://localhost:7878/rpc`. `?chain=<network>` is appended. Use this with the [Rust server](./Rust-Server.html).
2. `rpcUrl`.
3. `rpcUrlTemplate` with `INFURA_KEY` / `ALCHEMY_KEY` from the network config.

```js
wallet.addNetwork('local', { chainId: 1, symbol: 'ETH', proxyBase: 'http://localhost:7878/rpc' });
wallet.setNetwork('local');
```
