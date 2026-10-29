// settle-methods.js: how a Split transfer is settled, listing only what .wallet supports. Same file in the browser
// (window.SettleMethods) and in Node (require; tests in /tests/split/).
//   paypal   the PayPal provider flow (assets/providers/paypal/paypal-provider.js).
//   eth      native coin transfer on an EVM chain: an EIP-681 link (ethereum:<to>@<chainId>?value=<wei>) and, when an injected
//            wallet (window.ethereum) is present, an eth_sendTransaction request. Chains are the ones in
//            wallet.npm/src/types/eth/ethereum_default_networks.js (Goerli is shut down upstream; Sepolia per docs/Ethereum-Handler.md).
//   Coming soon: Bitcoin and Stellar (docs/Status.md: wallet.npm/src/types/bitcoin.js and stellar.js are empty).
// No exchange rate is built in: the ETH amount is typed by the user, or derived only from a rate the user enters.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SettleMethods = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const METHODS = [
    { id: "paypal", label: "PayPal", available: true },
    { id: "eth", label: "ETH", available: true },
    { id: "btc", label: "Bitcoin", available: false },
    { id: "xlm", label: "Stellar", available: false },
  ];
  const NETWORKS = [
    { id: "mainnet", name: "Ethereum Mainnet", chainId: 1, symbol: "ETH" },
    { id: "sepolia", name: "Sepolia Testnet", chainId: 11155111, symbol: "SepoliaETH" },
    { id: "bnb", name: "BNB Smart Chain", chainId: 56, symbol: "BNB" },
    { id: "bnbTestnet", name: "BNB Testnet", chainId: 97, symbol: "tBNB" },
  ];
  const DEFAULT = "paypal";
  const pick = (id) => { const m = METHODS.find((x) => x.id === id); return m && m.available ? m.id : DEFAULT; };
  const network = (id) => NETWORKS.find((n) => n.id === id) || NETWORKS[0];
  const isAddress = (a) => /^0x[0-9a-fA-F]{40}$/.test(String(a || "").trim());
  // "0.015" (whole coin units, up to 18 decimals) -> wei as a BigInt; throws on anything else
  function toWei(amount) {
    const s = String(amount == null ? "" : amount).trim();
    if (!/^\d+(\.\d{1,18})?$/.test(s) && !/^\.\d{1,18}$/.test(s)) throw new Error("amount: a positive number, up to 18 decimals");
    const [i, f = ""] = s.split(".");
    const w = BigInt(i || "0") * 10n ** 18n + BigInt((f + "0".repeat(18)).slice(0, 18));
    if (w <= 0n) throw new Error("amount must be more than 0");
    return w;
  }
  function fromWei(w) {
    const v = BigInt(w), i = v / 10n ** 18n, f = (v % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
    return i.toString() + (f ? "." + f : "");
  }
  // fiat cents at a user-entered rate (fiat per 1 coin, e.g. "3200.50") -> wei, rounded down to the wei
  function weiFromRate(cents, rate) {
    if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("cents must be a positive integer");
    const r = String(rate == null ? "" : rate).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(r)) throw new Error("rate: a positive number, up to 2 decimals");
    const [i, f = ""] = r.split("."), rc = BigInt(i) * 100n + BigInt((f + "00").slice(0, 2));
    if (rc <= 0n) throw new Error("rate must be more than 0");
    return (BigInt(cents) * 10n ** 18n) / rc;
  }
  function eip681(to, chainId, wei) {
    if (!isAddress(to)) throw new Error("receiver: a 0x address (40 hex digits)");
    if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("chainId");
    return "ethereum:" + String(to).trim() + "@" + chainId + "?value=" + BigInt(wei).toString();
  }
  // params for window.ethereum.request({ method: "eth_sendTransaction", params: [tx] })
  function txRequest(from, to, wei) {
    if (!isAddress(from) || !isAddress(to)) throw new Error("from / to: 0x addresses");
    return { from: String(from).trim(), to: String(to).trim(), value: "0x" + BigInt(wei).toString(16) };
  }
  return { METHODS, NETWORKS, DEFAULT, pick, network, isAddress, toWei, fromWei, weiFromRate, eip681, txRequest };
});
