#!/usr/bin/env node
// Local parse server for /.wallet/paypal/demos/split/: plain text (+ optional receipt image) -> Meta Model API -> strictly validated
// { expenses: [{ payer, amountCents, participants, description }] }. The model only parses; split-me.js (.me) computes the split.
// The key stays here: META_API_KEY from the environment or a git-ignored .env at the repo root. It is never logged or returned.
//   node tools/meta-parse-server.mjs            (PORT=8787, META_MODEL=muse-spark-1.3, META_BASE_URL=https://api.meta.ai/v1)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MetaParse = require(path.join(ROOT, "assets/split/meta-parse.js"));

function loadDotEnv() {
  const f = path.join(ROOT, ".env");
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export const SYSTEM = [
  "You turn a description of shared expenses (and optionally a receipt photo) into JSON. You only parse; you never compute shares.",
  'Reply with ONLY a JSON object: {"expenses":[{"payer":string,"amountCents":integer,"participants":[string],"description":string}]}.',
  "amountCents is the total paid, in integer cents (300 -> 30000). payer is who paid. participants is everyone the expense is for, including the payer if they took part.",
  "Use the given member names when they match. 'I' / 'me' means the speaker name given. If the text says 'the three of us' and members are given, use them.",
  "description is a short label (max 60 chars). No other keys, no prose, no markdown.",
].join(" ");

export function buildMessages({ text, members, speaker, imageDataUrl }) {
  const ctx = `Members: ${members && members.length ? members.join(", ") : "(none given)"}. Speaker ("I"): ${speaker || (members && members[0]) || "Me"}.`;
  const userText = `${ctx}\nText: ${text || "(none, read the receipt)"}`;
  const content = imageDataUrl ? [{ type: "text", text: userText }, { type: "image_url", image_url: { url: imageDataUrl } }] : userText;
  return [{ role: "system", content: SYSTEM }, { role: "user", content }];
}

// one parse: fetchImpl is injectable so tests can mock the API
export async function parseExpenses(input, { apiKey, baseUrl = "https://api.meta.ai/v1", model = "muse-spark-1.3", fetchImpl = fetch } = {}) {
  if (!apiKey) { const e = new Error("META_API_KEY is not set on the server"); e.status = 503; throw e; }
  const res = await fetchImpl(baseUrl.replace(/\/$/, "") + "/chat/completions", {
    method: "POST", headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: buildMessages(input) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error("Meta Model API " + res.status + ": " + ((body.error && (body.error.code || body.error.message)) || body.detail || "error")); e.status = 502; throw e; }
  const text = body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
  try { return MetaParse.parseModelText(text); } catch (err) { const e = new Error("model reply rejected: " + err.message); e.status = 422; throw e; }
}

export function checkInput(b) {
  if (!b || typeof b !== "object") throw Object.assign(new Error("body must be JSON"), { status: 400 });
  const text = typeof b.text === "string" ? b.text.slice(0, 2000) : "";
  const members = Array.isArray(b.members) ? b.members.filter((m) => typeof m === "string").slice(0, 30).map((m) => m.slice(0, 40)) : [];
  const speaker = typeof b.speaker === "string" ? b.speaker.slice(0, 40) : "";
  const imageDataUrl = typeof b.image === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(b.image) && b.image.length < 8e6 ? b.image : null;
  if (!text.trim() && !imageDataUrl) throw Object.assign(new Error("send text or a receipt image"), { status: 400 });
  return { text, members, speaker, imageDataUrl };
}

const ALLOWED = (o) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) || o === "https://neurons-me.github.io";

export function createServer(opts = {}) {
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin || "";
    if (ALLOWED(origin)) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin"); res.setHeader("Access-Control-Allow-Headers", "Content-Type"); res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); res.setHeader("Access-Control-Allow-Private-Network", "true"); }
    const send = (s, o) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    if (req.method === "GET" && req.url === "/health") return send(200, { ok: true, model: opts.model, keyConfigured: !!opts.apiKey });
    if (req.method !== "POST" || req.url !== "/parse") return send(404, { error: "not found" });
    let raw = ""; for await (const c of req) { raw += c; if (raw.length > 9e6) return send(413, { error: "too large" }); }
    try { const input = checkInput(JSON.parse(raw)); send(200, await parseExpenses(input, opts)); }
    catch (e) { send(e.status || 400, { error: e.message }); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadDotEnv();
  const port = Number(process.env.PORT || 8787);
  const opts = { apiKey: process.env.META_API_KEY, baseUrl: process.env.META_BASE_URL || "https://api.meta.ai/v1", model: process.env.META_MODEL || "muse-spark-1.3" };
  createServer(opts).listen(port, "127.0.0.1", () => console.log(`meta-parse-server on http://127.0.0.1:${port} (model ${opts.model}, key ${opts.apiKey ? "configured" : "MISSING"})`));
}
