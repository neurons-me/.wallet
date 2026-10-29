// Tests for the .wallet PayPal provider (assets/providers/paypal/paypal-provider.js) and tools/paypal-server.mjs, PayPal mocked.
//   node --test tests/paypal/paypal.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer, paypalApi } from "../../tools/paypal-server.mjs";
const require = createRequire(import.meta.url);
const PP = require("../../assets/providers/paypal/paypal-provider.js");

test("amount conversion: integer cents <-> PayPal decimal string", () => {
  assert.equal(PP.toValue(1, "USD"), "0.01");
  assert.equal(PP.toValue(1050, "USD"), "10.50");
  assert.equal(PP.toValue(123456789, "EUR"), "1234567.89");
  assert.equal(PP.toValue(500, "JPY"), "5");
  assert.throws(() => PP.toValue(550, "JPY"), /no decimals/);
  assert.throws(() => PP.toValue(0, "USD"));
  assert.throws(() => PP.toValue(1.5, "USD"));
  assert.equal(PP.fromValue("10.50", "USD"), 1050);
  assert.equal(PP.fromValue("0.07", "USD"), 7);
  assert.equal(PP.fromValue("10.5", "USD"), 1050);
  assert.equal(PP.fromValue("5", "JPY"), 500);
  for (let c = 1; c < 2000; c += 7) assert.equal(PP.fromValue(PP.toValue(c, "USD"), "USD"), c);
  assert.throws(() => PP.fromValue("1e3", "USD"));
});

test("order input validation", () => {
  assert.deepEqual(PP.checkOrderInput({ member: "bo", amountCents: 500, currency: "usd", groupId: "g1" }), { member: "bo", groupId: "g1", amountCents: 500, currency: "USD" });
  assert.throws(() => PP.checkOrderInput({ member: "bo", amountCents: "5.00", groupId: "g1" }), /amountCents/);
  assert.throws(() => PP.checkOrderInput({ member: "<x>", amountCents: 5, groupId: "g1" }), /member/);
  assert.throws(() => PP.checkOrderInput({ member: "bo", amountCents: 5 }), /groupId/);
});

test("order payload: Orders v2 CAPTURE, decimal value, custom_id carries group/member/to", () => {
  const o = PP.checkOrderInput({ member: "bo", to: "ana", amountCents: 1234, currency: "USD", groupId: "split-abc" });
  const b = PP.buildOrderPayload(o, { returnUrl: "http://127.0.0.1:8788/return" });
  assert.equal(b.intent, "CAPTURE");
  assert.deepEqual(b.purchase_units[0].amount, { currency_code: "USD", value: "12.34" });
  assert.equal(b.purchase_units[0].reference_id, "split-abc");
  assert.deepEqual(JSON.parse(b.purchase_units[0].custom_id), { g: "split-abc", m: "bo", t: "ana" });
  assert.equal(b.payment_source.paypal.experience_context.return_url, "http://127.0.0.1:8788/return");
});

// a mock PayPal: records calls, answers OAuth, orders, capture and verify
function mockPayPal({ verify = "SUCCESS" } = {}) {
  const calls = [];
  const json = (status, body) => ({ ok: status < 300, status, json: async () => body });
  const fetchImpl = async (url, init) => {
    const u = new URL(url), body = init.body && init.body !== "grant_type=client_credentials" ? JSON.parse(init.body) : init.body;
    calls.push({ path: u.pathname, auth: init.headers.Authorization, body });
    if (u.pathname === "/v1/oauth2/token") return json(200, { access_token: "TOKEN", expires_in: 32400 });
    if (u.pathname === "/v2/checkout/orders") return json(201, { id: "ORDER123AB", status: "CREATED", links: [{ rel: "self", href: "x" }, { rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER123AB" }] });
    if (/\/capture$/.test(u.pathname)) return json(201, { id: "ORDER123AB", status: "COMPLETED", purchase_units: [{ reference_id: "g1", payments: { captures: [{ id: "CAP777", status: "COMPLETED", amount: { currency_code: "USD", value: "12.34" }, custom_id: JSON.stringify({ g: "g1", m: "bo", t: "ana" }) }] } }] });
    if (u.pathname === "/v1/notifications/verify-webhook-signature") return json(200, { verification_status: verify });
    return json(404, { name: "NOT_FOUND" });
  };
  return { calls, fetchImpl };
}
const listen = (srv) => new Promise((r) => srv.listen(0, "127.0.0.1", () => r("http://127.0.0.1:" + srv.address().port)));

test("paypalApi: sandbox base, OAuth once, secret never in the order call", async () => {
  const m = mockPayPal();
  const api = paypalApi({ clientId: "id", clientSecret: "shh", fetchImpl: m.fetchImpl });
  assert.equal(api.base, "https://api-m.sandbox.paypal.com");
  await api.createOrder({ intent: "CAPTURE" }); await api.createOrder({ intent: "CAPTURE" });
  assert.equal(m.calls.filter((c) => c.path === "/v1/oauth2/token").length, 1);
  assert.equal(m.calls[1].auth, "Bearer TOKEN");
  await assert.rejects(paypalApi({ fetchImpl: m.fetchImpl }).createOrder({}), /PAYPAL_CLIENT_ID/);
});

test("server: /orders -> approve link; /capture -> capture event over SSE once", async () => {
  const m = mockPayPal();
  const srv = createServer({ clientId: "id", clientSecret: "shh", webhookId: "WH1", fetchImpl: m.fetchImpl });
  const base = await listen(srv);
  try {
    const h = await (await fetch(base + "/health")).json();
    assert.deepEqual(h, { ok: true, provider: "paypal", env: "sandbox", configured: true, webhookConfigured: true });
    assert.ok(!JSON.stringify(h).includes("shh"));
    const r = await fetch(base + "/orders", { method: "POST", body: JSON.stringify({ member: "bo", to: "ana", amountCents: 1234, currency: "USD", groupId: "g1" }) });
    assert.equal(r.status, 201);
    assert.deepEqual(await r.json(), { id: "ORDER123AB", status: "CREATED", approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER123AB" });
    const sent = m.calls.find((c) => c.path === "/v2/checkout/orders").body;
    assert.equal(sent.purchase_units[0].amount.value, "12.34");
    // SSE subscriber
    const ac = new AbortController(), es = await fetch(base + "/events", { signal: ac.signal }), rd = es.body.getReader();
    await rd.read(); // comment line
    const cap = await (await fetch(base + "/orders/ORDER123AB/capture", { method: "POST" })).json();
    assert.deepEqual(cap, { type: "capture", orderId: "ORDER123AB", captureId: "CAP777", status: "COMPLETED", amountCents: 1234, currency: "USD", groupId: "g1", member: "bo", to: "ana" });
    const chunk = new TextDecoder().decode((await rd.read()).value);
    assert.match(chunk, /^event: capture\ndata: /);
    assert.equal(JSON.parse(chunk.split("data: ")[1]).captureId, "CAP777");
    assert.equal(srv.emitCapture(cap), false, "duplicate capture is not re-emitted");
    ac.abort();
    assert.equal((await fetch(base + "/orders/bad id!/capture", { method: "POST" })).status, 400);
    assert.equal((await fetch(base + "/orders", { method: "POST", body: JSON.stringify({ member: "bo", amountCents: 1.5, groupId: "g1" }) })).status, 400);
  } finally { srv.close(); }
});

const webhookEvent = { id: "WH-EVT-1", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "CAP888", status: "COMPLETED", amount: { currency_code: "USD", value: "5.00" }, custom_id: JSON.stringify({ g: "g1", m: "cy", t: "ana" }), supplementary_data: { related_ids: { order_id: "ORDER999ZZ" } } } };
const sigHeaders = { "paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": "https://api.sandbox.paypal.com/cert", "paypal-transmission-id": "t1", "paypal-transmission-sig": "sig", "paypal-transmission-time": "2026-10-28T00:00:00Z" };

test("webhook: verified via PayPal, PAYMENT.CAPTURE.COMPLETED -> capture event", async () => {
  assert.deepEqual(PP.parseWebhookCapture(webhookEvent), { type: "capture", orderId: "ORDER999ZZ", captureId: "CAP888", status: "COMPLETED", amountCents: 500, currency: "USD", groupId: "g1", member: "cy", to: "ana", webhookId: "WH-EVT-1" });
  assert.equal(PP.parseWebhookCapture({ event_type: "CHECKOUT.ORDER.APPROVED", resource: {} }), null);
  const m = mockPayPal();
  const srv = createServer({ clientId: "id", clientSecret: "shh", webhookId: "WH1", fetchImpl: m.fetchImpl });
  const base = await listen(srv);
  try {
    const post = (headers, body) => fetch(base + "/webhooks/paypal", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    const r = await post(sigHeaders, webhookEvent);
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true, handled: true });
    const v = m.calls.find((c) => c.path === "/v1/notifications/verify-webhook-signature").body;
    assert.equal(v.webhook_id, "WH1"); assert.equal(v.transmission_sig, "sig"); assert.deepEqual(v.webhook_event, webhookEvent);
    assert.deepEqual(await (await post(sigHeaders, webhookEvent)).json(), { ok: true, handled: "duplicate" });
    assert.equal((await post({}, webhookEvent)).status, 400, "no signature headers -> rejected without calling PayPal");
  } finally { srv.close(); }
  const bad = mockPayPal({ verify: "FAILURE" });
  const srv2 = createServer({ clientId: "id", clientSecret: "shh", webhookId: "WH1", fetchImpl: bad.fetchImpl });
  const b2 = await listen(srv2);
  try { const r = await fetch(b2 + "/webhooks/paypal", { method: "POST", headers: sigHeaders, body: JSON.stringify(webhookEvent) }); assert.equal(r.status, 400); }
  finally { srv2.close(); }
  const srv3 = createServer({ clientId: "id", clientSecret: "shh", fetchImpl: m.fetchImpl });
  const b3 = await listen(srv3);
  try { assert.equal((await fetch(b3 + "/webhooks/paypal", { method: "POST", headers: sigHeaders, body: JSON.stringify(webhookEvent) })).status, 503); }
  finally { srv3.close(); }
});
