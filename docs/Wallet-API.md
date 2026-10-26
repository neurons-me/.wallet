---
layout: readme
title: Wallet API — this.wallet
---

[← Back to this.wallet Docs](https://neurons-me.github.io/.wallet/docs/)

# Wallet API

`Wallet` (from `wallet.npm/src/wallet.js`) is a thin wrapper. It creates a chain handler and copies the handler's methods onto itself. State lives in the handler.

## `new Wallet({ type = 'ethereum', ...options })`

`options` go to the handler. For Ethereum: `privateKey`, `mnemonic`, `networks`, `currentNetwork`.

## Methods on the wrapper

| Method | Description |
|---|---|
| `setNetwork(name)` | Selects an active network. Throws if `name` is not defined. |
| `addNetwork(name, config)` | Adds or replaces a network entry. |
| `export({ includeSecrets = false })` | Returns `{ type, address, networks, currentNetwork }`, plus `privateKey` and `mnemonic` when `includeSecrets` is true. |
| `getTypeInfo()` | Returns `{ type, address, currentNetwork, availableNetworks }`. |
| `Wallet.import(json)` | Creates a wallet from an `export()` result. |

Getters: `address`, `publicKey`, `privateKey`, `mnemonic`.

All handler methods (see [Ethereum Handler](./Ethereum-Handler.html)) are also available directly on the wallet.

## Browser

When loaded in a browser, the module creates `window.wallet` (an Ethereum wallet) and `wallet.help()` prints the available methods.
