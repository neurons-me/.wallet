// DOM-free component contract tests; not a substitute for browser/visual QA.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Me = require('../split/node_modules/this.me');
const PayPalMe = require('../../assets/providers/paypal/paypal-me.js');
const WalletPayPal = require('../../assets/providers/paypal/paypal-provider.js');
const map = require('../../assets/providers/paypal/paypal-me-map.json');
const tick = () => new Promise((r) => setImmediate(r));
function harness(client, extraG) {
  let current;
  const React = {
    Fragment: 'Fragment',
    createElement(type, props, ...children) {
      const node = { type, props: props || {}, children: children.flat() };
      if (typeof type === 'function' && /^(PayPalMark|MeQr|ReceiptCard)$/.test(type.name)) {
        return type({ ...node.props, children: node.children });
      }
      return node;
    },
    useState(init) {
      const c = current, i = c.i++; if (!(i in c.values)) c.values[i] = typeof init === 'function' ? init() : init;
      return [c.values[i], (v) => { c.values[i] = typeof v === 'function' ? v(c.values[i]) : v; }];
    },
    useRef(init) { const [r] = React.useState(() => ({ current: init })); return r; },
    useEffect(fn, deps) {
      const c = current, i = c.i++, before = c.values[i];
      if (!before || !deps || deps.some((d, j) => d !== before[j])) { c.values[i] = deps; c.effects.push(fn); }
    },
  };
  const G = { Atoms: { Box: 'Box', Button: 'Button' }, LLMS: 'LLMS', QRme: 'QRme', ...(extraG || {}) };
  const window = { Me, PayPalMe, WalletPayPal: { ...WalletPayPal, client: () => client } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../../assets/providers/paypal/paypal-gui.js'), 'utf8'), { window, fetch: async () => ({ ok: true, json: async () => map }) });
  const Surface = window.WalletPayPalGUI(G, React);
  const surface = { values: [], effects: [] }, provider = { values: [], effects: [] };
  function render(Component, context, props) {
    current = context; context.i = 0; const tree = Component(props || {});
    for (const f of context.effects.splice(0)) f();
    return tree;
  }
  let entry;
  return {
    async init() { render(Surface, surface); await tick(); entry = render(Surface, surface); return this.render(); },
    render() { return render(entry.type, provider, entry.props); },
  };
}
function all(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  return [...(predicate(tree) ? [tree] : []), ...(tree.children || []).flatMap((x) => all(x, predicate))];
}
function text(tree) { return typeof tree === 'string' ? tree : tree && typeof tree === 'object' ? (tree.children || []).map(text).join(' ') : ''; }
const button = (tree, label) => all(tree, (n) => n.type === 'Button' && text(n) === label)[0];
const graph = (tree) => all(tree, (n) => n.type === 'LLMS' && n.props.parts.includes('graph'))[0].props.graph;
function labeledInput(tree, name) {
  const label = all(tree, (n) => n.props && n.props.component === 'label' && String(text(n)).startsWith(name))[0];
  return label && (label.children || []).find((c) => c && c.props && c.props.component === 'input');
}
test('offline GUI shows the mark, QRme, disabled Pay and LLMS — no café or endpoint map', async () => {
  const app = harness({ health: async () => { throw Error('off'); } });
  await app.init(); await tick(); const tree = app.render();
  assert.ok(text(tree).includes('off · node tools/paypal-server.mjs'));
  assert.ok(all(tree, (n) => n.type === 'svg' && n.props && n.props['aria-label'] === 'PayPal').length >= 1);
  assert.equal(button(tree, 'Pay').props.disabled, true);
  assert.ok(all(tree, (n) => n.type === 'QRme').length >= 1);
  const llms = all(tree, (n) => n.type === 'LLMS')[0];
  assert.ok(llms.props.parts.includes('phrase') && llms.props.parts.includes('syntax') && llms.props.parts.includes('graph') && llms.props.parts.includes('explain'));
  assert.equal(llms.props.graphHeight, 320);
  assert.ok(Array.isArray(llms.props.ops) && llms.props.ops.length > 0);
  assert.ok(llms.props.phrase);
  assert.equal(graph(tree).nodes.find((n) => n.path === 'cafe.total'), undefined);
  assert.ok(!text(tree).includes('Who pays'));
  assert.equal(all(tree, (n) => n.type === 'Button' && String(text(n)).includes('wallet.paypal.account')).length, 0);
});
test('live GUI uses charge() after filling pay fields and writes mocked SSE capture back', async () => {
  let onCapture, request;
  const app = harness({
    health: async () => ({ ok: true, configured: true, provider: 'paypal', env: 'sandbox', webhookConfigured: false }),
    events(cb) { onCapture = cb; return () => {}; },
    charge: async (r) => { request = r; return { id: 'GUIORDER', status: 'CREATED', approveUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=GUIORDER' }; },
  });
  await app.init(); await tick(); let tree = app.render();
  labeledInput(tree, 'member').props.onChange({ target: { value: 'payer' } }); tree = app.render();
  labeledInput(tree, 'to').props.onChange({ target: { value: 'cafe' } }); tree = app.render();
  labeledInput(tree, 'amountCents').props.onChange({ target: { value: '700' } }); tree = app.render();
  assert.equal(button(tree, 'Pay').props.disabled, false);
  await button(tree, 'Pay').props.onClick(); tree = app.render();
  assert.equal(request.amountCents, 700);
  assert.equal(request.member, 'payer');
  assert.ok(graph(tree).nodes.some((n) => n.path.endsWith('.id') && n.value === 'GUIORDER'));
  onCapture({ ...request, orderId: 'GUIORDER', captureId: 'GUICAPTURE', status: 'COMPLETED' }); tree = app.render();
  assert.equal(graph(tree).nodes.find((n) => n.path === 'paid.payer').value, 700);
});
test('compound LLMS keeps syntax and graph at the same scrollable pane height', async () => {
  const LLMS = Object.assign(function LLMS() {}, { Phrase: 'LLMSPhrase', Syntax: 'LLMSSyntax', Graph: 'LLMSGraph', Explain: 'LLMSExplain' });
  const app = harness({ health: async () => { throw Error('off'); } }, { LLMS });
  await app.init(); await tick(); const tree = app.render();
  const root = all(tree, (n) => n.type === LLMS)[0];
  assert.ok(root);
  assert.equal(root.props.graphHeight, 320);
  const syn = all(tree, (n) => n.props && n.props['data-gui-node-id'] === 'wallet.paypal.llms.syntax')[0];
  const graphPane = all(tree, (n) => n.props && n.props['data-gui-node-id'] === 'wallet.paypal.llms.graph')[0];
  assert.equal(syn.props.sx.height, 320);
  assert.equal(syn.props.sx.minHeight, 320);
  assert.equal(syn.props.sx.overflow, 'auto');
  assert.equal(graphPane.props.sx.height, 320);
  assert.equal(graphPane.props.sx.minHeight, 320);
  assert.ok(all(syn, (n) => n.type === 'LLMSSyntax').length >= 1);
  assert.ok(all(graphPane, (n) => n.type === 'LLMSGraph' && n.props.height === 320).length >= 1);
});
