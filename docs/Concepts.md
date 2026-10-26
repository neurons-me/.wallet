---
layout: readme
title: Concepts — this.wallet
---

[← Back to this.wallet Docs](https://neurons-me.github.io/.wallet/docs/)

# Concepts

Translated and condensed from the Spanish notes in `docs/WalletNotes/`.

## Blockchain

A decentralized network with its own consensus and rules. Examples: Ethereum (EVM), Bitcoin, Solana, BNB Smart Chain.

## Network

A blockchain can have several networks: a mainnet and one or more testnets (for Ethereum: Mainnet, Sepolia).
A wallet must be pointed at one network at a time. In this.wallet that is `setNetwork(name)`.

## Native coin and tokens

Each blockchain has a native coin: ETH on Ethereum, BNB on BNB Smart Chain, BTC on Bitcoin, SOL on Solana.
EVM chains also carry tokens (ERC-20 / BEP-20, e.g. USDT, DAI). this.wallet sends native coins only today.

## Same key, many EVM chains

An Ethereum key gives the same address on every EVM-compatible chain (Ethereum, BNB Smart Chain, Polygon, and others).
That is why one Ethereum handler covers several networks.

## How this maps to this.wallet

```
Wallet
 ├─ Ethereum handler (working)
 │   ├─ networks: mainnet, bnb, bnbTestnet, … or your own via addNetwork
 │   └─ coin: the network's native coin
 ├─ Bitcoin handler (not implemented)
 └─ Stellar handler (not implemented)
```

Signing uses a different library per chain family: ethers for EVM, and bitcoinjs-lib and stellar-sdk are listed as dependencies for the planned Bitcoin and Stellar handlers.
