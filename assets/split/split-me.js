// split.me: the expense-split model of /.wallet/paypal/split/, on a .me kernel (this.me@4.2.1).
// Same file in the browser (window.SplitMe, needs window.Me from this.me's UMD build) and in Node (require; tests in /tests/split/).
//
// What is a declared rule (me["="]) and what is plain JS:
//   inputs (written by JS)       ex.<e>.parts.<m>.paid   cents this member paid toward expense e (0 if none)
//                                ex.<e>.parts.<m>.w      weight of the member in e (0 = not a participant; equal split = 1 each)
//                                ex.<e>.parts.<m>.rank   order among e's participants (0..n-1, members' join order); n for non-participants
//                                ex.<e>.n                number of participants
//                                ex.<e>.title / currency labels (strings; never used in a formula)
//   rules (the kernel computes)  ex.<e>.amount           = sum of parts paid                       (several payers allowed)
//                                ex.<e>.W                = sum of parts w
//                                ex.<e>.parts.<m>.base   = floor(amount * w / W)                  (floor(x/y) written as (x - x % y) / y)
//                                ex.<e>.rem              = amount - sum of base                    (always 0 .. n-1)
//                                ex.<e>.parts.<m>.extra  = 1 if rank < rem else 0                 (as floor((rem - rank + n) / (n + 1)); the numerator is 0 .. 2n-1)
//                                ex.<e>.parts.<m>.owe    = base + extra
//                                members.<m>.paid        = ex[].parts.<m>.paid   ([] aggregate over every expense)
//                                members.<m>.owed        = ex[].parts.<m>.owe
//                                members.<m>.net         = paid - owed           (> 0: is owed money, < 0: owes)
//                                total.net               = members[].net         (always 0: the check)
//   plain JS (not rules)         who pays whom (settle): the kernel has no min / max / conditionals, so a greedy match runs over the
//                                kernel's net balances; and the structural writes (ranks, n, rebuilding a sum when a member joins).
// Money is integer cents. Rounding rule: each participant gets floor(amount * w / W); the cents left over (fewer than the number of
// participants) go one each to the first participants in the group's member order. Every expense then splits to exactly its amount,
// so the nets always sum to 0.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.SplitMe = factory;
})(typeof self !== "undefined" ? self : this, function createSplit(MeLib, opts) {
  const Me = (MeLib && MeLib.default) || MeLib;
  const me = Me();
  const o = opts || {};
  const currency = String(o.currency || "USD");
  me.group.currency(currency);
  const members = []; // ids in join order
  const names = {};
  const expenses = []; // ids in creation order
  const exMeta = {};
  let seq = 0;
  const payments = {}, paidOut = {}; // recordPayment: ref -> payment, member -> cents paid through a provider
  const ID = /^[a-z][a-z0-9]*$/;

  const P = (e, m, f) => `ex[${e}].parts[${m}].${f}`;
  const sum = (terms) => terms.join(" + ");
  const toCents = (v) => {
    if (typeof v === "number") { if (!Number.isInteger(v) || v < 0) throw new Error("cents must be a non-negative integer"); return v; }
    const s = String(v).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error("amount must look like 12 or 12.34");
    const [i, f = ""] = s.split(".");
    return Number(i) * 100 + Number((f + "00").slice(0, 2));
  };
  const fmt = (c) => { if (c === undefined) return "0.00"; const s = c < 0 ? "-" : ""; const a = Math.abs(c); return s + Math.floor(a / 100) + "." + String(a % 100).padStart(2, "0"); };

  // (re)declare every rule of one expense; called when it is created, edited, or when the member set changes
  function wireExpense(e) {
    const parts = members;
    me["="](`ex.${e}.amount`, sum(parts.map((m) => P(e, m, "paid"))));
    me["="](`ex.${e}.W`, sum(parts.map((m) => P(e, m, "w"))));
    for (const m of parts) {
      const aw = `ex[${e}].amount * ${P(e, m, "w")}`;
      me["="](`ex.${e}.parts.${m}.base`, `(${aw} - (${aw}) % ex[${e}].W) / ex[${e}].W`);
    }
    me["="](`ex.${e}.rem`, `ex[${e}].amount - (${sum(parts.map((m) => P(e, m, "base")))})`);
    for (const m of parts) {
      const k = `(ex[${e}].rem - ${P(e, m, "rank")} + ex[${e}].n)`, d = `(ex[${e}].n + 1)`;
      me["="](`ex.${e}.parts.${m}.extra`, `(${k} - ${k} % ${d}) / ${d}`);
      me["="](`ex.${e}.parts.${m}.owe`, `${P(e, m, "base")} + ${P(e, m, "extra")}`);
    }
  }
  function wireMember(m) {
    me["="](`members.${m}.paid`, `ex[].parts.${m}.paid`);
    me["="](`members.${m}.owed`, `ex[].parts.${m}.owe`);
    me["="](`members.${m}.net`, `members[${m}].paid - members[${m}].owed`);
  }
  function wireTotal() { me["="]("total.net", "members[].net"); }

  // write one expense's inputs; spec: { title, currency, paid: {m: amount}, split: [m, ...] | {m: weight} }
  function writeExpense(e, spec) {
    if (spec.currency && spec.currency !== currency) throw new Error(`expense currency ${spec.currency} is not the group's ${currency} (no conversion)`);
    const paid = spec.paid || {};
    const payers = Object.keys(paid);
    if (!payers.length) throw new Error("an expense needs at least one payer");
    for (const m of payers) if (!names[m]) throw new Error("unknown payer " + m);
    const w = Array.isArray(spec.split) ? Object.fromEntries(spec.split.map((m) => [m, 1])) : { ...(spec.split || {}) };
    for (const m of Object.keys(w)) {
      if (!names[m]) throw new Error("unknown participant " + m);
      if (!Number.isInteger(w[m]) || w[m] < 0) throw new Error("weights are non-negative integers");
    }
    const inSplit = members.filter((m) => w[m] > 0);
    if (!inSplit.length) throw new Error("an expense needs at least one participant");
    const cents = Object.fromEntries(members.map((m) => [m, paid[m] === undefined ? 0 : toCents(paid[m])]));
    if (!members.some((m) => cents[m] > 0)) throw new Error("amount must be more than 0");
    me.ex[e].title(String(spec.title || ""));
    me.ex[e].currency(currency);
    me.ex[e].n(inSplit.length);
    for (const m of members) {
      me.ex[e].parts[m].paid(cents[m]);
      me.ex[e].parts[m].w(w[m] > 0 ? w[m] : 0);
      me.ex[e].parts[m].rank(w[m] > 0 ? inSplit.indexOf(m) : inSplit.length);
    }
    exMeta[e] = { title: String(spec.title || ""), paid: { ...paid }, split: Array.isArray(spec.split) ? spec.split.slice() : { ...w } };
  }

  const api = {
    me, currency, fmt, toCents,
    members: () => members.map((id) => ({ id, name: names[id] })),
    expenses: () => expenses.map((id) => ({ id, ...exMeta[id], amount: me(`ex.${id}.amount`) })),
    addMember(id, name) {
      if (!ID.test(id)) throw new Error("member id: lowercase letters and digits, starting with a letter");
      if (names[id]) throw new Error("member exists: " + id);
      members.push(id); names[id] = String(name || id);
      me.members[id].name(names[id]);
      for (const e of expenses) { // not part of past expenses: paid 0, weight 0, rank n
        me.ex[e].parts[id].paid(0); me.ex[e].parts[id].w(0); me.ex[e].parts[id].rank(me(`ex.${e}.n`));
        wireExpense(e);
      }
      wireMember(id); wireTotal();
      return id;
    },
    addExpense(spec) {
      const e = "e" + (++seq);
      writeExpense(e, spec); expenses.push(e); wireExpense(e);
      return e;
    },
    editExpense(e, spec) {
      if (!exMeta[e]) throw new Error("unknown expense " + e);
      writeExpense(e, { ...exMeta[e], ...spec });
      return e;
    },
    removeExpense(e) {
      const i = expenses.indexOf(e);
      if (i < 0) throw new Error("unknown expense " + e);
      expenses.splice(i, 1); delete exMeta[e];
      me["-"](`ex.${e}`);
    },
    // a settled payment (e.g. a captured PayPal order): writes paid.<from> (cumulative cents paid out through the provider) and
    // payments.<ref>, and adds a settlement entry (from paid `cents`, `to` takes all of it) so the kernel's nets recompute.
    // Idempotent per ref (a capture can arrive from the capture call, the return page and the webhook).
    recordPayment(from, to, cents, ref) {
      if (!names[from]) throw new Error("unknown member " + from);
      if (!names[to]) throw new Error("unknown member " + to);
      if (from === to) throw new Error("a payment needs two different members");
      if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("cents must be a positive integer");
      const key = String(ref || "").replace(/[^A-Za-z0-9]/g, "");
      if (!key) throw new Error("a payment needs a reference (e.g. the capture id)");
      if (payments[key]) return payments[key].expense;
      const e = api.addExpense({ title: "PayPal " + names[from] + " → " + names[to] + " (" + key + ")", paid: { [from]: cents }, split: [to] });
      paidOut[from] = (paidOut[from] || 0) + cents;
      me.paid[from](paidOut[from]);
      me.payments[key].from(from); me.payments[key].to(to); me.payments[key].cents(cents); me.payments[key].expense(e);
      payments[key] = { from, to, cents, expense: e };
      return e;
    },
    payments: () => Object.entries(payments).map(([ref, x]) => ({ ref, ...x })),
    paidOut: (m) => me(`paid.${m}`),
    // cents; undefined from the kernel means there is no expense yet (an empty [] aggregate is undefined, not 0)
    balance(m) { return { paid: me(`members.${m}.paid`), owed: me(`members.${m}.owed`), net: me(`members.${m}.net`) }; },
    balances() { return members.map((m) => ({ id: m, name: names[m], ...api.balance(m) })); },
    owe(e, m) { return me(`ex.${e}.parts.${m}.owe`); },
    check() { return me("total.net"); },
    // the kernel's own traces: the net, its paid and owed, and each expense's share of this member
    explain(m) {
      const t = (p) => { const x = me.explain(p); return { path: p, value: x.value, expr: x.expr, inputs: ((x.derivation && x.derivation.inputs) || []).map((i) => ({ path: i.path, value: i.value, status: i.status })), trace: x }; };
      return {
        net: t(`members.${m}.net`), paid: t(`members.${m}.paid`), owed: t(`members.${m}.owed`),
        expenses: expenses.map((e) => ({ id: e, title: exMeta[e].title, paid: me(`ex.${e}.parts.${m}.paid`), base: t(`ex.${e}.parts.${m}.base`), extra: t(`ex.${e}.parts.${m}.extra`), owe: t(`ex.${e}.parts.${m}.owe`) })),
      };
    },
    // plain JS over the kernel's nets: largest debtor pays largest creditor, ties by member order. At most (members - 1) transfers;
    // not guaranteed the fewest possible in every case (that problem is NP-hard in general).
    settle() {
      const bal = members.map((m, i) => ({ m, i, c: me(`members.${m}.net`) || 0 }));
      const out = [];
      const by = (a, b) => b.v - a.v || a.i - b.i;
      for (;;) {
        const cr = bal.filter((x) => x.c > 0).map((x) => ({ ...x, v: x.c })).sort(by)[0];
        const db = bal.filter((x) => x.c < 0).map((x) => ({ ...x, v: -x.c })).sort(by)[0];
        if (!cr || !db) break;
        const amt = Math.min(cr.v, db.v);
        out.push({ from: db.m, to: cr.m, cents: amt });
        bal[cr.i].c -= amt; bal[db.i].c += amt;
      }
      return out;
    },
  };
  return api;
});
