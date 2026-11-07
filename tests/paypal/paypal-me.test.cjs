const { test } = require('node:test');
const assert = require('node:assert/strict');
const Me = require('../split/node_modules/this.me');
const create = require('../../assets/providers/paypal/paypal-me.js');
const map = require('../../assets/providers/paypal/paypal-me-map.json');
const fresh = () => create(Me, map, { groupId: 'guiTest' });
const fill = (m) => {
  m.set('wallet.paypal.operators.pay.member', 'payer');
  m.set('wallet.paypal.operators.pay.to', 'cafe');
  m.set('wallet.paypal.operators.pay.amountCents', 700);
  return m.input();
};
const evt = (m, fields = {}) => ({ type: 'capture', orderId: 'ORDER1', captureId: 'CAP1', status: 'COMPLETED', ...m.input(), ...fields });
const order = (m) => m.order({ id: 'ORDER1', status: 'CREATED', approveUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER1' }, m.input());

test('starts from the map, not a café demo', () => {
  const m = fresh();
  assert.equal(m.me('cafe.coffee'), undefined);
  assert.equal(m.me('cafe.total'), undefined);
  assert.equal(m.input().amountCents, 0);
  assert.equal(m.input().member, '');
  assert.equal(m.input().groupId, 'guiTest');
  assert.equal(m.input().currency, 'USD');
  assert.equal(m.me('wallet.paypal.operators.pay.state'), 'idle');
});

test('planned paths declare availability, not invented profiles or access tokens', () => {
  const m = fresh();
  for (const p of ['wallet.paypal.account.availability', 'wallet.paypal.account.userinfo.availability', 'wallet.paypal.oauth.token.grants.authorization_code.availability', 'wallet.paypal.oauth.token.grants.refresh_token.availability']) assert.equal(m.me(p), 'planned');
  assert.equal(m.me('wallet.paypal.account.email'), undefined);
  assert.equal(m.me('wallet.paypal.oauth.token.access_token'), undefined);
  assert.equal(map.endpoints.find((r) => r.id === 'account').paypalPath, '/v1/identity/oauth2/userinfo');
  assert.equal(map.endpoints.find((r) => r.id === 'account.userinfo').paypalPath, '/v1/identity/openidconnect/userinfo');
});

test('only allowlisted real health values enter the graph; offline is explicit', () => {
  const m = fresh();
  m.health({ ok: true, provider: 'paypal', configured: true, webhookConfigured: false, env: 'sandbox', secret: 'never' });
  assert.equal(m.me('wallet.paypal.health.configured'), true);
  assert.equal(m.me('wallet.paypal.health.secret'), undefined);
  m.health(null); assert.equal(m.me('wallet.paypal.health.reachable'), false);
  assert.equal(m.me('wallet.paypal.events.state'), 'off');
});

test('order/capture writes are real response data, with idempotent completed payment accounting', () => {
  const m = fresh(); fill(m); order(m);
  const s = m.capture(evt(m)); assert.ok(s);
  assert.equal(m.me('wallet.paypal.operators.pay.state'), 'captured');
  assert.equal(m.me('paid.payer'), 700);
  assert.ok(s.graph.nodes.some((n) => /^wallet\.paypal\.orders\..*\.capture\.captureId$/.test(n.path) && n.value === 'CAP1'));
  assert.equal(m.capture(evt(m)), null); assert.equal(m.me('paid.payer'), 700);
});

test('shared SSE rejects foreign contexts, unknown orders and mismatched captures', () => {
  const m = fresh(); fill(m); order(m);
  for (const fields of [{ groupId: 'other' }, { orderId: 'foreign' }, { amountCents: 900 }, { currency: 'EUR' }, { member: 'foreign' }, { to: 'foreign' }]) assert.equal(m.capture(evt(m, fields)), null);
  assert.equal(m.me('paid.payer'), undefined);
  assert.ok(m.capture(evt(m)));
});

test('a pending capture can later complete, but never counts as paid twice', () => {
  const m = fresh(); fill(m); order(m);
  assert.ok(m.capture(evt(m, { status: 'PENDING' })));
  assert.equal(m.me('paid.payer'), undefined);
  assert.ok(m.capture(evt(m)));
  assert.equal(m.me('paid.payer'), 700);
  assert.equal(m.capture(evt(m)), null);
});

test('completed capture issues a PayPal receipt and a conversation message', () => {
  const m = fresh(); fill(m); m.set('wallet.paypal.operators.pay.description', 'Cafe'); order(m);
  assert.equal(m.snapshot().receipt, null);
  assert.ok(m.capture(evt(m, { status: 'PENDING' })));
  assert.equal(m.snapshot().receipt, null);
  const s = m.capture(evt(m, { issuedAt: '2026-11-07T04:31:00.000Z' }));
  assert.equal(s.receipt.captureId, 'CAP1');
  assert.equal(s.receipt.orderId, 'ORDER1');
  assert.equal(s.receipt.amountCents, 700);
  assert.equal(s.receipt.member, 'payer');
  assert.equal(s.receipt.description, 'Cafe');
  assert.equal(s.receipt.issuedAt, '2026-11-07T04:31:00.000Z');
  assert.ok(s.graph.nodes.some((n) => /^wallet\.paypal\.receipts\..*\.captureId$/.test(n.path) && n.value === 'CAP1'));
  assert.deepEqual(s.messages.map((x) => x.kind), ['receipt']);
  assert.equal(s.messages[0].receiptId, 'CAP1');
  assert.equal(m.me('wallet.paypal.conversation.messages.' + ('id' + Array.from('CAP1', (c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')) + '.text'), 'PayPal issued a receipt.');
});
