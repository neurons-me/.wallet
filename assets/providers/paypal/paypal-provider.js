// paypal-provider.js: the reusable PayPal provider layer of .wallet (not split-only). Same file in Node (require; used by
// tools/paypal-server.mjs and tests/paypal/) and in the browser (window.WalletPayPal). It never sees credentials: the client id and
// secret stay in the local server (tools/paypal-server.mjs); the page only talks to that server.
//   Money: integer cents (minor units) everywhere in .wallet / .me; converted to PayPal's decimal string only at the boundary
//   (toValue / fromValue). Zero-decimal currencies (JPY, HUF, TWD) have no minor unit at PayPal.
//   Shared pieces: toValue, fromValue, buildOrderPayload, approveLink, parseCapture, parseWebhookCapture, checkOrderInput.
//   Browser client: WalletPayPal.client({ baseUrl }) -> health(), createOrder(), capture(), events(onCapture), charge() (popup flow).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WalletPayPal = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const ZERO_DEC = new Set(["JPY", "HUF", "TWD"]);
  const CUR = /^[A-Z]{3}$/;
  const MAX_CENTS = 100000000; // 1,000,000.00 per order
  const ID = /^[A-Za-z0-9][A-Za-z0-9_.\-]{0,63}$/;
  const fail = (msg, status) => Object.assign(new Error(msg), { status: status || 400 });

  // integer minor units -> PayPal value string ("12.34"); zero-decimal currencies must be whole units
  function toValue(cents, currency) {
    if (!Number.isSafeInteger(cents) || cents <= 0) throw fail("amountCents must be a positive integer");
    if (ZERO_DEC.has(currency)) { if (cents % 100) throw fail(currency + " has no decimals: amountCents must be a multiple of 100"); return String(cents / 100); }
    return Math.floor(cents / 100) + "." + String(cents % 100).padStart(2, "0");
  }
  // PayPal value string -> integer minor units (string math, no floats)
  function fromValue(value, currency) {
    const s = String(value).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(s)) throw fail("bad PayPal amount value " + JSON.stringify(value), 502);
    if (ZERO_DEC.has(currency) && s.includes(".")) throw fail("bad " + currency + " amount " + s, 502);
    const [i, f = ""] = s.split(".");
    return Number(i) * 100 + Number((f + "00").slice(0, 2));
  }
  function checkOrderInput(b) {
    if (!b || typeof b !== "object") throw fail("body must be JSON");
    const currency = String(b.currency || "USD").toUpperCase();
    if (!CUR.test(currency)) throw fail("currency must be a 3-letter ISO code");
    if (typeof b.member !== "string" || !ID.test(b.member)) throw fail("member must be an id (letters, digits, _ . -)");
    if (typeof b.groupId !== "string" || !ID.test(b.groupId)) throw fail("groupId must be an id (letters, digits, _ . -)");
    if (!Number.isSafeInteger(b.amountCents) || b.amountCents <= 0 || b.amountCents > MAX_CENTS) throw fail("amountCents must be a positive integer of cents");
    const out = { member: b.member, groupId: b.groupId, amountCents: b.amountCents, currency };
    if (typeof b.to === "string" && ID.test(b.to)) out.to = b.to;
    if (typeof b.description === "string") out.description = b.description.slice(0, 120);
    if (typeof b.payeeEmail === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.payeeEmail)) out.payeeEmail = b.payeeEmail;
    toValue(out.amountCents, currency); // zero-decimal check
    return out;
  }
  // custom_id carries the .wallet context through PayPal (max 127 chars) so captures and webhooks map back to a member
  const customId = (o) => JSON.stringify({ g: o.groupId, m: o.member, t: o.to || null }).slice(0, 127);
  const readCustom = (s) => { try { const j = JSON.parse(s); return { groupId: j.g || null, member: j.m || null, to: j.t || null }; } catch (_) { return { groupId: null, member: null, to: null }; } };
  function buildOrderPayload(o, opts) {
    const p = opts || {};
    const unit = {
      reference_id: o.groupId,
      custom_id: customId(o),
      description: o.description || (".wallet: " + o.member + (o.to ? " to " + o.to : "") + " (" + o.groupId + ")"),
      amount: { currency_code: o.currency, value: toValue(o.amountCents, o.currency) },
    };
    if (o.payeeEmail) unit.payee = { email_address: o.payeeEmail };
    const body = { intent: "CAPTURE", purchase_units: [unit] };
    if (p.returnUrl) body.payment_source = { paypal: { experience_context: { return_url: p.returnUrl, cancel_url: p.cancelUrl || p.returnUrl, user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING", brand_name: p.brandName || ".wallet" } } };
    return body;
  }
  const approveLink = (order) => { const l = (order && order.links || []).find((x) => x.rel === "approve" || x.rel === "payer-action"); return l ? l.href : null; };
  // a capture response (POST /v2/checkout/orders/:id/capture) -> the .wallet event
  function parseCapture(body) {
    const unit = body && body.purchase_units && body.purchase_units[0];
    const cap = unit && unit.payments && unit.payments.captures && unit.payments.captures[0];
    if (!cap) throw fail("capture response has no capture", 502);
    const currency = cap.amount.currency_code;
    return { type: "capture", orderId: body.id, captureId: cap.id, status: cap.status, amountCents: fromValue(cap.amount.value, currency), currency, ...readCustom(cap.custom_id || unit.custom_id) };
  }
  // a verified PAYMENT.CAPTURE.COMPLETED webhook -> the same event shape; other events -> null
  function parseWebhookCapture(evt) {
    if (!evt || evt.event_type !== "PAYMENT.CAPTURE.COMPLETED" || !evt.resource) return null;
    const r = evt.resource, currency = r.amount.currency_code;
    const orderId = r.supplementary_data && r.supplementary_data.related_ids && r.supplementary_data.related_ids.order_id || null;
    return { type: "capture", orderId, captureId: r.id, status: r.status, amountCents: fromValue(r.amount.value, currency), currency, ...readCustom(r.custom_id), webhookId: evt.id };
  }

  // ── browser client: talks only to the local server (never to PayPal with credentials) ──
  function client(opts) {
    const base = String((opts && opts.baseUrl) || "http://127.0.0.1:8788").replace(/\/$/, "");
    const f = (opts && opts.fetch) || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
    const post = async (p, body) => { const r = await f(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw fail(j.error || ("PayPal server " + r.status), r.status); return j; };
    const api = {
      base,
      health: async () => { const r = await f(base + "/health"); return r.json(); },
      createOrder: (o) => post("/orders", o),
      capture: (orderId) => post("/orders/" + encodeURIComponent(orderId) + "/capture"),
      // SSE: every capture (from /return, /capture or a verified webhook) arrives here once per captureId
      events(onCapture) {
        if (typeof EventSource === "undefined") return () => {};
        const es = new EventSource(base + "/events");
        es.addEventListener("capture", (m) => { try { onCapture(JSON.parse(m.data)); } catch (_) {} });
        return () => es.close();
      },
      // the simple sandbox flow: create the order, open PayPal's approve page in a popup; the server's /return captures it after
      // approval and broadcasts the capture over /events. Resolves with the order { id, approveUrl }.
      async charge(o) {
        const win = typeof window !== "undefined" ? window.open("about:blank", "paypal-approve", "width=480,height=720") : null;
        try { const order = await api.createOrder(o); if (win) win.location.href = order.approveUrl; return order; }
        catch (e) { if (win) win.close(); throw e; }
      },
    };
    return api;
  }
  return { toValue, fromValue, checkOrderInput, buildOrderPayload, approveLink, parseCapture, parseWebhookCapture, client, ZERO_DEC };
});
