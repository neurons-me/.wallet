// node --test: Meta model parse validation with mocked API replies (no network, no key). The AI parses; split-me.js computes.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { parseExpenses, checkInput, buildMessages, createServer } from "../../tools/meta-parse-server.mjs";
const require = createRequire(import.meta.url);
const P = require("../../assets/split/meta-parse.js");
const Me = require("this.me");
const SplitMe = require("../../assets/split/split-me.js");

const dinner = { expenses: [{ payer: "Ana", amountCents: 30000, participants: ["Ana", "Bo", "Cy"], description: "dinner" }] };
const mock = (status, body) => async (url, init) => { mock.last = { url, init }; return { ok: status < 400, status, json: async () => body }; };
const reply = (content) => ({ choices: [{ message: { role: "assistant", content } }] });

test("valid reply parses, also inside a ```json fence", () => {
  assert.deepEqual(P.parseModelText(JSON.stringify(dinner)), dinner);
  assert.deepEqual(P.parseModelText("```json\n" + JSON.stringify(dinner) + "\n```"), dinner);
});

test("strict schema rejects bad shapes", () => {
  const bad = (e, re) => assert.throws(() => P.validate({ expenses: [{ ...dinner.expenses[0], ...e }] }), re);
  bad({ amountCents: 300.5 }, /integer/); bad({ amountCents: 0 }, /integer/); bad({ amountCents: "30000" }, /integer/);
  bad({ participants: [] }, /non-empty/); bad({ participants: ["Ana", "ana"] }, /duplicates/); bad({ payer: "" }, /payer/);
  bad({ payer: "<script>" }, /payer/); bad({ extra: 1 }, /unknown key/);
  assert.throws(() => P.validate({ expenses: [] }), /non-empty/);
  assert.throws(() => P.validate({ expenses: dinner.expenses, note: "x" }), /unknown key/);
  assert.throws(() => P.validate({ expenses: [{ payer: "Ana", amountCents: 1, participants: ["Ana"] }] }), /missing description/);
  assert.throws(() => P.parseModelText("Sure! Here is the JSON: {}"), /not JSON/);
});

test("mocked API: request shape, then the result feeds split-me.js", async () => {
  const r = await parseExpenses({ text: "I paid 300 for dinner for the three of us", members: ["Ana", "Bo", "Cy"], speaker: "Ana" },
    { apiKey: "test-key", fetchImpl: mock(200, reply(JSON.stringify(dinner))) });
  assert.equal(mock.last.url, "https://api.meta.ai/v1/chat/completions");
  assert.equal(mock.last.init.headers.Authorization, "Bearer test-key");
  assert.equal(JSON.parse(mock.last.init.body).model, "muse-spark-1.3");
  const { members, specs } = P.toSplitSpecs(r);
  const s = SplitMe(Me); for (const m of members) s.addMember(m.id, m.name); const e = s.addExpense(specs[0]);
  assert.deepEqual(["ana", "bo", "cy"].map((m) => s.owe(e, m)), [10000, 10000, 10000]);
  assert.deepEqual(s.settle(), [{ from: "bo", to: "ana", cents: 10000 }, { from: "cy", to: "ana", cents: 10000 }]);
});

test("mocked API: invalid model output is rejected (422), API errors surface status without the key (502)", async () => {
  await assert.rejects(parseExpenses({ text: "x" }, { apiKey: "k", fetchImpl: mock(200, reply('{"expenses":[{"payer":"Ana","amountCents":"300","participants":["Ana"],"description":""}]}')) }), (e) => e.status === 422);
  await assert.rejects(parseExpenses({ text: "x" }, { apiKey: "secret-k", fetchImpl: mock(402, { error: { code: "billing_not_configured" } }) }),
    (e) => e.status === 502 && /402: billing_not_configured/.test(e.message) && !e.message.includes("secret-k"));
  await assert.rejects(parseExpenses({ text: "x" }, {}), (e) => e.status === 503);
});

test("input checks and image message", () => {
  assert.throws(() => checkInput({ text: " " }), /text or a receipt/);
  const i = checkInput({ text: "", image: "data:image/png;base64,AAAA" });
  assert.equal(buildMessages(i)[1].content[1].type, "image_url");
  assert.equal(checkInput({ text: "hi", image: "http://evil/x.png" }).imageDataUrl, null);
});

test("server: /health never exposes the key; /parse validates", async () => {
  const srv = createServer({ apiKey: "secret-k", model: "muse-spark-1.3", fetchImpl: mock(200, reply(JSON.stringify(dinner))) });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  try {
    const h = await (await fetch(base + "/health")).text();
    assert.deepEqual(JSON.parse(h), { ok: true, model: "muse-spark-1.3", keyConfigured: true }); assert.ok(!h.includes("secret-k"));
    const r = await fetch(base + "/parse", { method: "POST", body: JSON.stringify({ text: "I paid 300 for dinner" }) });
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), dinner);
    assert.equal((await fetch(base + "/parse", { method: "POST", body: "{}" })).status, 400);
  } finally { srv.close(); }
});
