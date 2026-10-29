#!/usr/bin/env node
// Local PayPal provider server for .wallet (sandbox by default): Orders v2 create / capture, webhook signature verification, and an
// SSE stream of captured payments for the page. Any .wallet page can use it through assets/providers/paypal/paypal-provider.js
// (window.WalletPayPal); /.wallet/paypal/split/ is one consumer.
// Credentials: PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET (and PAYPAL_WEBHOOK_ID for webhooks) from the environment or a git-ignored
// .env at the repo root. They are never logged, returned, or sent anywhere but PayPal's OAuth endpoint.
//   node tools/paypal-server.mjs     (PORT=8788, PAYPAL_ENV=sandbox -> https://api-m.sandbox.paypal.com)
//   POST /orders {member, amountCents, currency, groupId, to?, description?, payeeEmail?} -> { id, status, approveUrl }
//   POST /orders/:id/capture -> capture event      GET /return?token=<orderId> (PayPal return_url: captures, then closes the popup)
//   POST /webhooks/paypal (verified via /v1/notifications/verify-webhook-signature; PAYMENT.CAPTURE.COMPLETED -> capture event)
//   GET /events (SSE, event "capture")              GET /health -> { ok, env, configured, webhookConfigured }
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PP = require(path.join(ROOT, "assets/providers/paypal/paypal-provider.js"));

export function loadDotEnv(file = path.join(ROOT, ".env")) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
export const BASES = { sandbox: "https://api-m.sandbox.paypal.com", live: "https://api-m.paypal.com" };
const err = (msg, status) => Object.assign(new Error(msg), { status });
// PayPal error bodies can echo request data but never credentials; keep only the name / issue
const ppErr = (what, res, body) => err(`PayPal ${what} ${res.status}: ${(body && (body.name || body.error)) || "error"}${body && body.details && body.details[0] ? " (" + body.details[0].issue + ")" : ""}`, 502);

// the PayPal REST client; fetchImpl is injectable so tests mock PayPal
export function paypalApi({ clientId, clientSecret, env = "sandbox", baseUrl, fetchImpl = fetch } = {}) {
  const base = (baseUrl || BASES[env] || BASES.sandbox).replace(/\/$/, "");
  let tok = null, exp = 0;
  async function token() {
    if (!clientId || !clientSecret) throw err("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set on the server", 503);
    if (tok && Date.now() < exp) return tok;
    const res = await fetchImpl(base + "/v1/oauth2/token", { method: "POST", headers: { Authorization: "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
    const b = await res.json().catch(() => ({}));
    if (!res.ok || !b.access_token) throw ppErr("OAuth", res, b);
    tok = b.access_token; exp = Date.now() + Math.max(0, (Number(b.expires_in) || 300) - 60) * 1000;
    return tok;
  }
  async function call(method, p, body, extra) {
    const res = await fetchImpl(base + p, { method, headers: { Authorization: "Bearer " + await token(), "Content-Type": "application/json", ...(extra || {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const b = await res.json().catch(() => ({}));
    return { res, b };
  }
  return {
    base, token,
    async createOrder(payload, requestId) { const { res, b } = await call("POST", "/v2/checkout/orders", payload, requestId ? { "PayPal-Request-Id": requestId } : {}); if (!res.ok) throw ppErr("create order", res, b); return b; },
    async captureOrder(id) { const { res, b } = await call("POST", "/v2/checkout/orders/" + encodeURIComponent(id) + "/capture", {}); if (!res.ok) throw ppErr("capture", res, b); return b; },
    async verifyWebhook(headers, event, webhookId) {
      if (!webhookId) throw err("PAYPAL_WEBHOOK_ID is not set on the server", 503);
      const h = (k) => headers[k] || headers[k.toLowerCase()];
      const body = { auth_algo: h("paypal-auth-algo"), cert_url: h("paypal-cert-url"), transmission_id: h("paypal-transmission-id"), transmission_sig: h("paypal-transmission-sig"), transmission_time: h("paypal-transmission-time"), webhook_id: webhookId, webhook_event: event };
      if (!body.auth_algo || !body.cert_url || !body.transmission_id || !body.transmission_sig || !body.transmission_time) return false;
      const { res, b } = await call("POST", "/v1/notifications/verify-webhook-signature", body);
      if (!res.ok) throw ppErr("verify webhook", res, b);
      return b.verification_status === "SUCCESS";
    },
  };
}

const ALLOWED = (o) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) || o === "https://neurons-me.github.io";
const ORDER_ID = /^[A-Z0-9]{5,40}$/;

export function createServer(opts = {}) {
  const api = opts.api || paypalApi(opts);
  const port = opts.port || 8788;
  const publicBase = (opts.publicBase || `http://127.0.0.1:${port}`).replace(/\/$/, "");
  const clients = new Set(), seen = new Set(), log = opts.log || (() => {});
  const emit = (evt) => {
    if (!evt || !evt.captureId || seen.has(evt.captureId)) return false; // once per capture (return, capture call and webhook all land here)
    if (evt.status && evt.status !== "COMPLETED") return false;
    seen.add(evt.captureId);
    const line = `event: capture\ndata: ${JSON.stringify(evt)}\n\n`;
    for (const c of clients) c.write(line);
    log(`capture ${evt.captureId} ${evt.amountCents} ${evt.currency} member=${evt.member}`);
    return true;
  };
  const readBody = async (req, max = 1e6) => { let raw = ""; for await (const c of req) { raw += c; if (raw.length > max) throw err("too large", 413); } return raw; };
  const doCapture = async (id) => { const evt = PP.parseCapture(await api.captureOrder(id)); emit(evt); return evt; };
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin || "";
    if (ALLOWED(origin)) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin"); res.setHeader("Access-Control-Allow-Headers", "Content-Type"); res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); res.setHeader("Access-Control-Allow-Private-Network", "true"); }
    const send = (s, o) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    const url = new URL(req.url, "http://x"), p = url.pathname;
    try {
      if (req.method === "OPTIONS") return res.writeHead(204).end();
      if (req.method === "GET" && p === "/health") return send(200, { ok: true, provider: "paypal", env: opts.env || "sandbox", configured: !!(opts.api || (opts.clientId && opts.clientSecret)), webhookConfigured: !!opts.webhookId });
      if (req.method === "GET" && p === "/events") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
        res.write(": .wallet paypal events\n\n"); clients.add(res); req.on("close", () => clients.delete(res)); return;
      }
      if (req.method === "POST" && p === "/orders") {
        const o = PP.checkOrderInput(JSON.parse(await readBody(req) || "{}"));
        const order = await api.createOrder(PP.buildOrderPayload(o, { returnUrl: publicBase + "/return", cancelUrl: publicBase + "/return?cancel=1" }), opts.requestId ? opts.requestId(o) : undefined);
        return send(201, { id: order.id, status: order.status, approveUrl: PP.approveLink(order) });
      }
      let m;
      if (req.method === "POST" && (m = p.match(/^\/orders\/([^/]+)\/capture$/))) {
        if (!ORDER_ID.test(m[1])) throw err("bad order id", 400);
        return send(200, await doCapture(m[1]));
      }
      if (req.method === "GET" && p === "/return") {
        const id = url.searchParams.get("token") || "";
        let msg = "Payment cancelled. You can close this window.";
        if (!url.searchParams.get("cancel") && ORDER_ID.test(id)) { try { const e = await doCapture(id); msg = `Paid ${PP.toValue(e.amountCents, e.currency)} ${e.currency}. You can close this window.`; } catch (e2) { msg = "Capture failed: " + e2.message; } }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(`<!doctype html><meta charset="utf-8"><title>.wallet · PayPal</title><body style="font:16px system-ui;background:#0b0b0f;color:#f4f4f5;padding:40px"><p>${msg.replace(/[<>&]/g, "")}</p><script>setTimeout(()=>window.close(),1500)</script>`);
      }
      if (req.method === "POST" && p === "/webhooks/paypal") {
        const raw = await readBody(req); let evt; try { evt = JSON.parse(raw); } catch (_) { throw err("body must be JSON", 400); }
        const ok = await api.verifyWebhook(req.headers, evt, opts.webhookId);
        if (!ok) return send(400, { error: "webhook signature not verified" });
        const cap = PP.parseWebhookCapture(evt);
        return send(200, { ok: true, handled: cap ? emit(cap) || "duplicate" : false });
      }
      return send(404, { error: "not found" });
    } catch (e) { return send(e.status || 400, { error: e.message }); }
  });
  server.emitCapture = emit;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadDotEnv();
  const port = Number(process.env.PORT || 8788), env = process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
  const opts = { port, env, clientId: process.env.PAYPAL_CLIENT_ID, clientSecret: process.env.PAYPAL_CLIENT_SECRET, webhookId: process.env.PAYPAL_WEBHOOK_ID, publicBase: process.env.PAYPAL_PUBLIC_BASE, log: (s) => console.log(s) };
  createServer(opts).listen(port, "127.0.0.1", () => console.log(`paypal-server (${env}) on http://127.0.0.1:${port} · credentials ${opts.clientId && opts.clientSecret ? "configured" : "MISSING"} · webhook id ${opts.webhookId ? "configured" : "MISSING"}`));
}
