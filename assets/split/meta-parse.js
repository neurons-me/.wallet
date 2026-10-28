// meta-parse.js: strict validation of what the Meta model returns for the split demo. The model only PARSES text / a receipt into
// expenses; split-me.js (.me) computes every share. Shared by tools/meta-parse-server.mjs (Node) and the page (browser, UMD).
//   expense = { payer: string, amountCents: positive integer, participants: [string, ...] (unique, non-empty), description: string }
//   result  = { expenses: [expense, ...] }  (no other keys anywhere)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MetaParse = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const MAX_CENTS = 100000000; // 1,000,000.00
  const NAME = /^[\p{L}\p{N}][\p{L}\p{N} .'\-]{0,39}$/u;
  const keysExactly = (o, keys, where) => {
    if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error(where + " must be an object");
    for (const k of Object.keys(o)) if (!keys.includes(k)) throw new Error(where + " has unknown key " + JSON.stringify(k));
    for (const k of keys) if (!(k in o)) throw new Error(where + " is missing " + k);
  };
  const name = (v, where) => { if (typeof v !== "string" || !NAME.test(v.trim())) throw new Error(where + " must be a name (1-40 letters, digits, space . ' -)"); return v.trim(); };
  function validate(obj) {
    keysExactly(obj, ["expenses"], "result");
    if (!Array.isArray(obj.expenses) || !obj.expenses.length) throw new Error("result.expenses must be a non-empty array");
    if (obj.expenses.length > 50) throw new Error("result.expenses has more than 50 items");
    return { expenses: obj.expenses.map((e, i) => {
      const w = "expenses[" + i + "]";
      keysExactly(e, ["payer", "amountCents", "participants", "description"], w);
      const payer = name(e.payer, w + ".payer");
      if (!Number.isSafeInteger(e.amountCents) || e.amountCents <= 0 || e.amountCents > MAX_CENTS) throw new Error(w + ".amountCents must be a positive integer of cents");
      if (!Array.isArray(e.participants) || !e.participants.length) throw new Error(w + ".participants must be a non-empty array");
      const participants = e.participants.map((p, j) => name(p, w + ".participants[" + j + "]"));
      const seen = new Set(participants.map((p) => p.toLowerCase()));
      if (seen.size !== participants.length) throw new Error(w + ".participants has duplicates");
      if (typeof e.description !== "string" || e.description.length > 120) throw new Error(w + ".description must be a string of at most 120 chars");
      return { payer, amountCents: e.amountCents, participants, description: e.description.trim() };
    }) };
  }
  // the model's text reply -> validated result (accepts a bare JSON object, optionally inside a ``` fence; nothing else)
  function parseModelText(text) {
    if (typeof text !== "string") throw new Error("model reply is not text");
    const m = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    let obj; try { obj = JSON.parse(m ? m[1] : text.trim()); } catch (_) { throw new Error("model reply is not JSON"); }
    return validate(obj);
  }
  // validated expenses -> split-me.js specs (member ids are lowercased names); amounts stay integer cents until the kernel's string input
  const idOf = (n) => { let b = n.toLowerCase().replace(/[^a-z0-9]/g, "") || "m"; return /^[a-z]/.test(b) ? b : "m" + b; };
  function toSplitSpecs(result) {
    const members = new Map();
    const add = (n) => { const id = idOf(n); if (!members.has(id)) members.set(id, n); return id; };
    const specs = result.expenses.map((e) => {
      const payer = add(e.payer), split = e.participants.map(add);
      return { title: e.description, paid: { [payer]: (e.amountCents / 100).toFixed(2) }, split };
    });
    return { members: [...members].map(([id, name]) => ({ id, name })), specs };
  }
  const SCHEMA = { type: "object", additionalProperties: false, required: ["expenses"], properties: { expenses: { type: "array", minItems: 1, items: {
    type: "object", additionalProperties: false, required: ["payer", "amountCents", "participants", "description"], properties: {
      payer: { type: "string" }, amountCents: { type: "integer", minimum: 1 }, participants: { type: "array", minItems: 1, items: { type: "string" } }, description: { type: "string" } } } } } };
  return { validate, parseModelText, toSplitSpecs, idOf, SCHEMA };
});
