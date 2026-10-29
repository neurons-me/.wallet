// node --test (from tests/split, after npm install): the .me split model, on the real this.me@4.2.1 kernel.
const test = require("node:test");
const assert = require("node:assert/strict");
const Me = require("this.me");
const SplitMe = require("../../assets/split/split-me.js");

const group = (ids) => { const s = SplitMe(Me); for (const id of ids) s.addMember(id, id.toUpperCase()); return s; };
const nets = (s) => Object.fromEntries(s.balances().map((b) => [b.id, b.net]));

test("installed kernel is this.me 4.2.1", () => {
  assert.equal(JSON.parse(require("fs").readFileSync(require.resolve("this.me").replace(/dist[\\/].*$/, "package.json"), "utf8")).version, "4.2.1");
});

test("equal split: one payer, three participants", () => {
  const s = group(["ana", "bo", "cy"]);
  const e = s.addExpense({ title: "dinner", paid: { ana: "90" }, split: ["ana", "bo", "cy"] });
  assert.deepEqual(["ana", "bo", "cy"].map((m) => s.owe(e, m)), [3000, 3000, 3000]);
  assert.deepEqual(nets(s), { ana: 6000, bo: -3000, cy: -3000 });
  assert.deepEqual(s.settle(), [{ from: "bo", to: "ana", cents: 3000 }, { from: "cy", to: "ana", cents: 3000 }]);
});

test("uneven shares: weights 1:2:3, and a non-participant", () => {
  const s = group(["ana", "bo", "cy", "dee"]);
  const e = s.addExpense({ title: "cabin", paid: { cy: "60" }, split: { ana: 1, bo: 2, cy: 3 } });
  assert.deepEqual(["ana", "bo", "cy", "dee"].map((m) => s.owe(e, m)), [1000, 2000, 3000, 0]);
  assert.deepEqual(nets(s), { ana: -1000, bo: -2000, cy: 3000, dee: 0 });
  // exact amounts as weights in cents
  const e2 = s.addExpense({ title: "tickets", paid: { dee: "10" }, split: { ana: 250, dee: 750 } });
  assert.deepEqual([s.owe(e2, "ana"), s.owe(e2, "dee")], [250, 750]);
});

test("multiple payers on one expense", () => {
  const s = group(["ana", "bo", "cy"]);
  const e = s.addExpense({ title: "groceries", paid: { ana: "40", bo: "20" }, split: ["ana", "bo", "cy"] });
  assert.equal(s.me(`ex.${e}.amount`), 6000);
  assert.deepEqual(nets(s), { ana: 2000, bo: 0, cy: -2000 });
  assert.deepEqual(s.settle(), [{ from: "cy", to: "ana", cents: 2000 }]);
});

test("editing an expense recomputes every derived value", () => {
  const s = group(["ana", "bo"]);
  const e1 = s.addExpense({ title: "taxi", paid: { ana: "20" }, split: ["ana", "bo"] });
  s.addExpense({ title: "lunch", paid: { bo: "30" }, split: ["ana", "bo"] });
  assert.deepEqual(nets(s), { ana: -500, bo: 500 });
  s.editExpense(e1, { paid: { ana: "50" } });
  assert.equal(s.me(`ex.${e1}.amount`), 5000);
  assert.deepEqual(nets(s), { ana: 1000, bo: -1000 });
  s.editExpense(e1, { split: ["bo"] });
  assert.deepEqual(nets(s), { ana: 3500, bo: -3500 });
  s.removeExpense(e1);
  assert.deepEqual(nets(s), { ana: -1500, bo: 1500 });
  // a member who joins later is outside earlier expenses
  s.addMember("cy", "CY");
  assert.deepEqual(nets(s), { ana: -1500, bo: 1500, cy: 0 });
});

test("rounding: integer cents, remainder to the first participants, nets sum to 0", () => {
  const s = group(["ana", "bo", "cy"]);
  const e = s.addExpense({ title: "x", paid: { cy: "100" }, split: ["ana", "bo", "cy"] });
  assert.deepEqual(["ana", "bo", "cy"].map((m) => s.owe(e, m)), [3334, 3333, 3333]);
  const e2 = s.addExpense({ title: "y", paid: { ana: "0.05" }, split: ["bo", "cy", "ana"] });
  assert.deepEqual(["ana", "bo", "cy"].map((m) => s.owe(e2, m)), [2, 2, 1]); // member order, not the order typed
  assert.equal(s.check(), 0);
  // many random expenses: every expense splits to its exact amount and the group always sums to 0
  let r = 7; const rnd = (n) => (r = (r * 1103515245 + 12345) % 2147483648) % n;
  const ids = ["ana", "bo", "cy"];
  for (let i = 0; i < 40; i++) {
    const w = {}; for (const m of ids) w[m] = rnd(4); if (!Object.values(w).some(Boolean)) w.ana = 1;
    const id = s.addExpense({ title: "r" + i, paid: { [ids[rnd(3)]]: 1 + rnd(99999) }, split: w });
    assert.equal(ids.reduce((a, m) => a + s.owe(id, m), 0), s.me(`ex.${id}.amount`));
  }
  assert.equal(s.check(), 0);
  assert.equal(Object.values(nets(s)).reduce((a, b) => a + b, 0), 0);
  const t = s.settle();
  assert.ok(t.length <= ids.length - 1);
  for (const x of t) assert.ok(Number.isInteger(x.cents) && x.cents > 0);
});

test("explain() is the kernel's own trace", () => {
  const s = group(["ana", "bo"]);
  const e = s.addExpense({ title: "dinner", paid: { ana: "10.01" }, split: ["ana", "bo"] });
  const x = s.explain("bo");
  assert.equal(x.net.value, -500);
  assert.equal(x.net.expr, "members[bo].paid - members[bo].owed");
  assert.deepEqual(x.net.inputs.map((i) => [i.path, i.value]), [["members.bo.paid", 0], ["members.bo.owed", 500]]);
  assert.equal(x.owed.expr, "ex[].parts.bo.owe");
  assert.equal(x.owed.trace.derivation.inputs[0].kind, "aggregate");
  assert.equal(x.expenses[0].owe.value, 500);
  assert.equal(x.expenses[0].base.value, 500);
  assert.equal(s.explain("ana").expenses[0].extra.value, 1); // the odd cent
  assert.equal(s.me.explain(`ex.${e}.amount`).value, 1001);
});

test("inputs are checked", () => {
  const s = group(["ana", "bo"]);
  assert.throws(() => s.addExpense({ paid: { ana: "1.234" }, split: ["ana"] }));
  assert.throws(() => s.addExpense({ paid: { zed: "1" }, split: ["ana"] }));
  assert.throws(() => s.addExpense({ paid: { ana: "1" }, split: [] }));
  assert.throws(() => s.addExpense({ currency: "EUR", paid: { ana: "1" }, split: ["ana"] }));
  assert.throws(() => s.addMember("Ana B", "x"));
});

// recordPayment: a captured provider payment (PayPal) written into .me; the kernel's nets recompute, idempotent per capture id
test("recordPayment writes paid.<member> and settles the nets", () => {
  const S = require("../../assets/split/split-me.js")(require("this.me"), { currency: "USD" });
  S.addMember("ana", "Ana"); S.addMember("bo", "Bo"); S.addMember("cy", "Cy");
  S.addExpense({ title: "dinner", paid: { ana: "30.00" }, split: ["ana", "bo", "cy"] });
  assert.deepEqual(S.settle(), [{ from: "bo", to: "ana", cents: 1000 }, { from: "cy", to: "ana", cents: 1000 }]);
  S.recordPayment("bo", "ana", 1000, "CAP777");
  assert.equal(S.me("paid.bo"), 1000);
  assert.equal(S.me("payments.CAP777.cents"), 1000);
  assert.equal(S.balance("bo").net, 0);
  assert.equal(S.check(), 0);
  assert.deepEqual(S.settle(), [{ from: "cy", to: "ana", cents: 1000 }]);
  S.recordPayment("bo", "ana", 1000, "CAP777"); // same capture again (webhook after capture): no double count
  assert.equal(S.me("paid.bo"), 1000);
  assert.equal(S.payments().length, 1);
  S.recordPayment("cy", "ana", 400, "CAP8"); S.recordPayment("cy", "ana", 600, "CAP9");
  assert.equal(S.paidOut("cy"), 1000);
  assert.deepEqual(S.settle(), []);
  assert.throws(() => S.recordPayment("bo", "bo", 1, "X"));
  assert.throws(() => S.recordPayment("bo", "ana", 1.5, "X"));
  assert.throws(() => S.recordPayment("zz", "ana", 1, "X"));
});
