// One local .me kernel for the PayPal provider surface. No café demo, no identity agent, no second API.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.PayPalMe = factory;
})(typeof self !== "undefined" ? self : this, function (MeLib, map, options) {
  const Me = MeLib.default || MeLib, me = Me(), paths = new Set(), rules = new Map();
  const seen = new Map(), orders = new Map();
  const groupId = (options && options.groupId) || "paypal" + Math.random().toString(36).slice(2, 12);
  let lastOrder = null, changed = [];
  function set(path, value) {
    me[path](value); paths.add(path); changed.push(path);
  }
  function define(path, expr) { me["="](path, expr); paths.add(path); rules.set(path, expr); }
  function batch(fn) { changed = []; fn(); return snapshot(); }
  const key = (id) => "id" + Array.from(String(id), (c) => c.charCodeAt(0).toString(16).padStart(4, "0")).join("");
  const pay = (name) => "wallet.paypal.operators.pay." + name;
  if (map && Array.isArray(map.endpoints)) {
    for (const row of map.endpoints) {
      set(row.me + ".availability", row.status);
      if (row.grant) set("wallet.paypal.oauth.token.grants." + row.grant + ".availability", row.status);
    }
  }
  set("wallet.paypal.operators.pay.state", "idle");
  set("wallet.paypal.health.reachable", false);
  set("wallet.paypal.events.state", "off");
  set(pay("groupId"), groupId);
  set(pay("currency"), "USD");
  function input() {
    const read = (name, fallback) => {
      const v = me(pay(name));
      return v === undefined || v === null || v === "" ? fallback : v;
    };
    return {
      member: read("member", ""),
      to: read("to", ""),
      groupId: read("groupId", groupId),
      currency: read("currency", "USD"),
      description: read("description", ""),
      payeeEmail: read("payeeEmail", ""),
      amountCents: read("amountCents", 0),
    };
  }
  function snapshot() {
    const nodes = [...paths].map((path) => ({ path, value: me(path), derived: rules.has(path) }));
    const explain = [...rules.keys()].map((p) => me.explain(p));
    const edges = explain.flatMap((x) => ((x.derivation && x.derivation.inputs) || []).map((i) => ({ from: i.path, to: x.path })));
    const ops = [...paths].map((path) => {
      if (!rules.has(path)) return { op: "set", path, value: me(path) };
      const parts = path.split("."), name = parts.pop();
      return { op: "define", path: parts.join("."), name, expr: rules.get(path) };
    });
    const values = Object.fromEntries([...paths].map((path) => [path, me(path)]));
    function collect(prefix, fields) {
      const bases = new Set();
      for (const path of paths) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length);
        const id = rest.split(".")[0];
        if (id && /^id[0-9a-f]+$/.test(id)) bases.add(prefix + id);
      }
      return [...bases].map((base) => Object.fromEntries(fields.map((f) => [f, me(base + "." + f)])));
    }
    const receipts = collect("wallet.paypal.receipts.", ["orderId", "captureId", "status", "amountCents", "currency", "member", "to", "groupId", "description", "issuedAt"]);
    const messages = collect("wallet.paypal.conversation.messages.", ["kind", "receiptId", "text"]);
    return { graph: { nodes, edges }, explain, ops, changed: [...changed, ...rules.keys()], input: input(), lastOrder, values, receipts, messages, receipt: receipts[receipts.length - 1] || null };
  }
  return {
    me, snapshot, input,
    get(path) { return me(path); },
    set(path, value) { return batch(() => set(path, value)); },
    define,
    health(h) { return batch(() => {
      set("wallet.paypal.health.reachable", !!h);
      if (!h || !h.ok) set("wallet.paypal.events.state", "off");
      if (h) for (const p of ["ok", "provider", "env", "configured", "webhookConfigured"]) if (h[p] !== undefined) set("wallet.paypal.health." + p, h[p]);
    }); },
    state(path, value) { return batch(() => set(path, value)); },
    order(order, request) {
      if (!order || !/^[A-Za-z0-9_-]+$/.test(order.id)) throw Error("Invalid order response.");
      orders.set(order.id, { ...request }); lastOrder = { ...order };
      return batch(() => {
        const p = "wallet.paypal.orders." + key(order.id);
        for (const f of ["id", "status", "approveUrl"]) if (order[f] != null) set(p + "." + f, order[f]);
        for (const f of ["member", "to", "groupId", "amountCents", "currency"]) set(p + "." + f, request[f]);
        set("wallet.paypal.operators.pay.state", "awaiting approval");
      });
    },
    capture(evt) {
      const req = evt && orders.get(evt.orderId);
      if (!req || !evt.captureId || typeof evt.status !== "string" || seen.get(evt.captureId) === "COMPLETED" || seen.get(evt.captureId) === evt.status || evt.groupId !== groupId || evt.member !== req.member || evt.to !== req.to || evt.currency !== req.currency || evt.amountCents !== req.amountCents) return null;
      seen.set(evt.captureId, evt.status);
      return batch(() => {
        const p = "wallet.paypal.orders." + key(evt.orderId) + ".capture";
        for (const f of ["orderId", "captureId", "status", "amountCents", "currency", "member", "to", "groupId"]) set(p + "." + f, evt[f]);
        set("wallet.paypal.events.lastCaptureId", evt.captureId);
        set("wallet.paypal.operators.pay.state", evt.status === "COMPLETED" ? "captured" : evt.status);
        if (evt.status === "COMPLETED") {
          set("paid." + req.member, (me("paid." + req.member) || 0) + evt.amountCents);
          const payment = "payments." + key(evt.captureId);
          for (const f of ["member", "to", "amountCents", "currency"]) set(payment + "." + f, evt[f]);
          const issuedAt = evt.issuedAt || evt.createTime || new Date().toISOString();
          const rec = {
            orderId: evt.orderId,
            captureId: evt.captureId,
            status: evt.status,
            amountCents: evt.amountCents,
            currency: evt.currency,
            member: evt.member,
            to: evt.to,
            groupId: evt.groupId,
            description: evt.description || req.description || "",
            issuedAt,
          };
          const r = "wallet.paypal.receipts." + key(evt.captureId);
          for (const f of ["orderId", "captureId", "status", "amountCents", "currency", "member", "to", "groupId", "description", "issuedAt"]) if (rec[f] !== undefined && rec[f] !== "") set(r + "." + f, rec[f]);
          set("wallet.paypal.orders." + key(evt.orderId) + ".receipt.captureId", evt.captureId);
          const msg = "wallet.paypal.conversation.messages." + key(evt.captureId);
          set(msg + ".kind", "receipt");
          set(msg + ".receiptId", evt.captureId);
          set(msg + ".text", "PayPal issued a receipt.");
        }
      });
    },
  };
});
