// node --test: the settlement-method selector logic (assets/split/settle-methods.js) and settle.method / members.<m>.eth in .me.
const test = require("node:test");
const assert = require("node:assert/strict");
const SM = require("../../assets/split/settle-methods.js");
const Me = require("this.me");
const SplitMe = require("../../assets/split/split-me.js");
const A = "0x" + "ab".repeat(20);

test("list: PayPal and ETH available, at most 4 coming soon, pick falls back to PayPal", () => {
  assert.deepEqual(SM.METHODS.filter((m) => m.available).map((m) => m.id), ["paypal", "eth"]);
  assert.ok(SM.METHODS.filter((m) => !m.available).length <= 4);
  assert.equal(SM.pick("eth"), "eth"); assert.equal(SM.pick("btc"), "paypal"); assert.equal(SM.pick(undefined), "paypal");
  assert.equal(SM.network("sepolia").chainId, 11155111); assert.equal(SM.network("x").chainId, 1);
});

test("wei: exact decimal parsing, user rate only, EIP-681 and tx request", () => {
  assert.equal(SM.toWei("1"), 10n ** 18n); assert.equal(SM.toWei("0.000000000000000001"), 1n); assert.equal(SM.toWei(".5"), 5n * 10n ** 17n);
  assert.throws(() => SM.toWei("0")); assert.throws(() => SM.toWei("1e3")); assert.throws(() => SM.toWei("-1")); assert.throws(() => SM.toWei(""));
  assert.equal(SM.fromWei(15n * 10n ** 15n), "0.015");
  assert.equal(SM.weiFromRate(3000, "3000"), 10n ** 16n); // 30.00 at 3000.00 per ETH = 0.01 ETH
  assert.throws(() => SM.weiFromRate(3000, "")); assert.throws(() => SM.weiFromRate(3000, "0"));
  assert.equal(SM.eip681(A, 1, 10n ** 16n), "ethereum:" + A + "@1?value=10000000000000000");
  assert.throws(() => SM.eip681("0x12", 1, 1n));
  assert.deepEqual(SM.txRequest(A, A, 255n), { from: A, to: A, value: "0xff" });
});

test(".me: settle.method and members.<m>.eth do not change the split", () => {
  const s = SplitMe(Me); s.addMember("ana", "Ana"); s.addMember("bo", "Bo");
  s.addExpense({ title: "x", paid: { ana: "10" }, split: ["ana", "bo"] });
  s.setMethod("eth"); s.setEthAddress("ana", A);
  assert.equal(s.method(), "eth"); assert.equal(s.me("settle.method"), "eth"); assert.equal(s.ethAddress("ana"), A); assert.equal(s.ethAddress("bo"), "");
  assert.deepEqual(s.settle(), [{ from: "bo", to: "ana", cents: 500 }]); assert.equal(s.check(), 0);
});
