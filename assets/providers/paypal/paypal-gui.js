// Reusable .GUI PayPal surface: slim pay form, QRme of one's .me, conversation/receipt, and GUI.LLMS.
// The mark is the official monotone PayPal icon with currentColor so it follows the theme.
// A completed capture issues a receipt on the graph and posts it into the conversation.
(function () {
  const MARK_PATHS = [
    { opacity: 0.95, fillRule: "evenodd", clipRule: "evenodd", d: "M38.168 13.352c-1.596-.842-3.535-1.346-5.644-1.346h-12.6l-4.218 26.92H6.413L12 3.032h15.05c5.065 0 9.056 2.827 10.518 6.755a9.643 9.643 0 0 1 .6 3.565Z" },
    { opacity: 0.45, d: "M43.527 23.671A12.848 12.848 0 0 1 30.814 34.44h-5.188L23.459 47.9h-9.235l1.482-8.973 1.747-11.148.363-2.312h7.468c7.753 0 12.884-6.562 12.884-12.114l.005.002c3.817 1.964 6.038 5.944 5.354 10.317Z" },
    { opacity: 0.7, d: "M38.167 13.352c-1.596-.841-3.534-1.346-5.644-1.346H19.924l-2.11 13.46h7.47c7.752 0 12.883-6.562 12.883-12.114Z" },
  ];
  function formatAmount(cents, currency) {
    try { return window.WalletPayPal.toValue(Number(cents), String(currency || "USD").toUpperCase()) + " " + String(currency || "USD").toUpperCase(); }
    catch (_) { return String(cents) + " " + (currency || ""); }
  }
  function identityValue(member) {
    const raw = String(member || "").trim();
    if (/^https?:\/\//i.test(raw) || /^me:\/\//i.test(raw)) return raw;
    if (raw && /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(raw)) return "https://" + raw;
    if (raw) return "me://" + raw.replace(/^\/+/, "");
    try {
      if (typeof location !== "undefined" && location.protocol === "https:") {
        return location.origin + (location.pathname || "/.wallet/paypal/");
      }
    } catch (_) {}
    return "https://neurons-me.github.io/.wallet/paypal/";
  }
  function identityName(member) {
    const raw = String(member || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) {
      try { return new URL(raw).hostname.split(".")[0] || raw; } catch (_) { return raw; }
    }
    if (/^me:\/\//i.test(raw)) return raw.slice(5).split("/")[0] || raw;
    return raw.split(".")[0];
  }
  function phraseOf(snap) {
    const rec = snap.receipt;
    if (rec && rec.captureId) {
      return [rec.member, "paid", formatAmount(rec.amountCents, rec.currency), rec.to ? "to " + rec.to : "", rec.description ? "for " + rec.description : ""].filter(Boolean).join(" ");
    }
    const inn = snap.input || {};
    if (inn.amountCents) {
      return [inn.member || "someone", "pays", formatAmount(inn.amountCents, inn.currency), inn.to ? "to " + inn.to : ""].filter(Boolean).join(" ");
    }
    return "wallet.paypal";
  }
  function receiptText(r) {
    if (!r) return "";
    return [
      "PayPal receipt",
      formatAmount(r.amountCents, r.currency),
      r.member ? "From: " + r.member : "",
      r.to ? "To: " + r.to : "",
      r.description ? "For: " + r.description : "",
      r.orderId ? "Order: " + r.orderId : "",
      r.captureId ? "Capture: " + r.captureId : "",
      r.status ? "Status: " + r.status : "",
      r.issuedAt ? "Issued: " + r.issuedAt : "",
    ].filter(Boolean).join("\n");
  }
  function receiptSvg(r) {
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
    const lines = [
      ["Amount", formatAmount(r.amountCents, r.currency)],
      r.member && ["From", r.member],
      r.to && ["To", r.to],
      r.description && ["For", r.description],
      r.orderId && ["Order", r.orderId],
      r.captureId && ["Capture", r.captureId],
      r.status && ["Status", r.status],
      r.issuedAt && ["Issued", r.issuedAt],
    ].filter(Boolean);
    const rows = lines.map((pair, i) => {
      const y = 132 + i * 22;
      return '<text x="28" y="' + y + '" font-size="12" fill="#6b7280">' + esc(pair[0]) + '</text>'
        + '<text x="372" y="' + y + '" text-anchor="end" font-size="12" fill="#111827">' + esc(pair[1]) + '</text>';
    }).join("");
    const h = 148 + lines.length * 22;
    return '<?xml version="1.0" encoding="UTF-8"?>'
      + '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="' + h + '" viewBox="0 0 400 ' + h + '">'
      + '<rect width="400" height="' + h + '" rx="18" fill="#fff"/>'
      + '<g transform="translate(24 20) scale(0.7)" fill="#111827">'
      + MARK_PATHS.map((p) => '<path fill="#111827" opacity="' + p.opacity + '" ' + (p.fillRule ? 'fill-rule="' + p.fillRule + '" clip-rule="' + p.clipRule + '" ' : "") + 'd="' + p.d + '"/>').join("")
      + '</g>'
      + '<text x="68" y="52" font-size="22" font-weight="700" fill="#111827" font-family="ui-sans-serif, system-ui, sans-serif">PayPal</text>'
      + '<text x="68" y="72" font-size="12" fill="#6b7280" font-family="ui-sans-serif, system-ui, sans-serif">Receipt</text>'
      + '<text x="28" y="108" font-size="28" font-weight="700" fill="#111827" font-family="ui-sans-serif, system-ui, sans-serif">' + esc(formatAmount(r.amountCents, r.currency)) + '</text>'
      + rows
      + '</svg>';
  }
  window.WalletPayPalGUI = function createPayPalGUI(G, React) {
    const h = React.createElement, { Box, Button } = G.Atoms;
    const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    const paneH = 320;
    const panel = { border: 1, borderColor: "divider", borderRadius: "14px", p: { xs: 2, sm: 3 }, minWidth: 0, bgcolor: "background.paper" };
    function llmsView(snap) {
      const shared = { graph: snap.graph, explain: snap.explain, ops: snap.ops, phrase: phraseOf(snap), changed: snap.changed, graphHeight: paneH, graphMode: "interactive", explainOnSelect: true };
      if (!G.LLMS) return h(Box, { component: "pre", sx: { overflow: "auto", fontFamily: mono, fontSize: 12 } }, JSON.stringify(snap.graph, null, 2));
      if (G.LLMS.Phrase && G.LLMS.Syntax && G.LLMS.Graph) {
        return h(G.LLMS, shared,
          h(G.LLMS.Phrase),
          h(Box, { sx: { display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0,1fr) minmax(0,1fr)" }, gap: 1.5, mt: 1.25, alignItems: "stretch" } },
            h(Box, { sx: { minWidth: 0, height: paneH, minHeight: paneH, maxHeight: paneH, overflow: "auto", overscrollBehavior: "contain" }, "data-gui-node-id": "wallet.paypal.llms.syntax" },
              h(G.LLMS.Syntax)),
            h(Box, { sx: { minWidth: 0, height: paneH, minHeight: paneH }, "data-gui-node-id": "wallet.paypal.llms.graph" },
              h(G.LLMS.Graph, { height: paneH }))),
          G.LLMS.Explain ? h(G.LLMS.Explain) : null);
      }
      return h(G.LLMS, { ...shared, parts: ["phrase", "syntax", "graph", "explain"] });
    }
    const text = (s, sx) => h(Box, { component: "p", sx: { m: 0, color: "text.secondary", fontSize: 13, ...sx } }, s);
    const code = (s) => h(Box, { component: "code", sx: { fontFamily: mono, overflowWrap: "anywhere" } }, s);
    const btn = (label, props) => h(Button, { size: "small", variant: "outlined", sx: { textTransform: "none" }, ...props }, label);
    function PayPalMark({ size = 40, clipId = "paypal-mark-clip" }) {
      return h("svg", { viewBox: "0 0 48 48", width: size, height: size, fill: "none", role: "img", "aria-label": "PayPal", style: { display: "block", color: "currentColor", flex: "none" } },
        h("g", { clipPath: "url(#" + clipId + ")" }, MARK_PATHS.map((p, i) => h("path", { key: i, fill: "currentColor", opacity: p.opacity, fillRule: p.fillRule, clipRule: p.clipRule, d: p.d }))),
        h("defs", null, h("clipPath", { id: clipId }, h("path", { fill: "currentColor", d: "M6.15 3h37.5v45H6.15z" }))));
    }
    function MeQr({ member }) {
      const value = identityValue(member), username = identityName(member);
      if (!G.QRme) return text(value, { fontFamily: mono });
      return h(Box, { sx: { display: "grid", justifyItems: "center", gap: 1, minWidth: 0 }, "data-gui-node-id": "wallet.paypal.me.qr" },
        h(G.QRme, { value, username, variant: "lg", defaultFace: "qr", perimeterLabel: value, perimeterRootLabel: username || "wallet.paypal", "data-gui-node-id": "wallet.paypal.me.qr.mark" }),
        text(value, { fontFamily: mono, fontSize: 11, textAlign: "center", overflowWrap: "anywhere" }));
    }
    function ReceiptCard({ receipt, notice }) {
      if (!receipt || !receipt.captureId) return text("A PayPal receipt is issued when a capture completes.");
      const row = (k, v) => v ? h(Box, { sx: { display: "flex", justifyContent: "space-between", gap: 2, fontSize: 13 } }, h("span", { style: { color: "inherit", opacity: 0.7 } }, k), h(Box, { component: "span", sx: { fontFamily: mono, overflowWrap: "anywhere", textAlign: "right" } }, String(v))) : null;
      return h(Box, { sx: { ...panel, display: "grid", gap: 1.25 }, "data-gui-node-id": "wallet.paypal.receipt" },
        h(Box, { sx: { display: "flex", alignItems: "center", gap: 1, color: "text.primary" } },
          h(PayPalMark, { size: 28, clipId: "paypal-mark-clip-rcpt-" + receipt.captureId }),
          h(Box, null, h(Box, { sx: { fontWeight: 700, lineHeight: 1.2 } }, "PayPal"), text("Receipt"))),
        h(Box, { sx: { fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-.03em", color: "text.primary" } }, formatAmount(receipt.amountCents, receipt.currency)),
        row("From", receipt.member),
        row("To", receipt.to),
        row("For", receipt.description),
        row("Order", receipt.orderId),
        row("Capture", receipt.captureId),
        row("Status", receipt.status),
        row("Issued", receipt.issuedAt),
        h(Box, { sx: { display: "flex", gap: 1, flexWrap: "wrap", mt: 0.5 } },
          btn("Share", { onClick: () => shareReceipt(receipt, notice) }),
          btn("Copy", { onClick: () => copyReceipt(receipt, notice) }),
          btn("Download", { onClick: () => downloadReceipt(receipt, notice) })));
    }
    async function copyReceipt(r, notice) {
      try { await navigator.clipboard.writeText(receiptText(r)); notice && notice("Receipt copied."); }
      catch (e) { notice && notice(e.message || "Could not copy."); }
    }
    async function shareReceipt(r, notice) {
      const payload = { title: "PayPal receipt", text: receiptText(r) };
      if (navigator.share) {
        try { await navigator.share(payload); notice && notice("Receipt shared."); return; }
        catch (e) { if (e && e.name === "AbortError") return; }
      }
      await copyReceipt(r, notice);
    }
    function downloadReceipt(r, notice) {
      const blob = new Blob([receiptSvg(r)], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "paypal-receipt-" + r.captureId + ".svg"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notice && notice("Receipt downloaded.");
    }
    function lookupReceipt(snap, id) {
      return ((snap.receipts || []).find((r) => r.captureId === id)) || (snap.receipt && snap.receipt.captureId === id ? snap.receipt : null);
    }
    function Surface({ mapUrl = "/.wallet/assets/providers/paypal/paypal-me-map.json" }) {
      const [map, setMap] = React.useState(null), [loadError, setLoadError] = React.useState("");
      React.useEffect(() => { let off = false;
        if (window.__WALLET_PAYPAL_MAP) { setMap(window.__WALLET_PAYPAL_MAP); return; }
        fetch(mapUrl).then((r) => { if (!r.ok) throw Error("Provider map: HTTP " + r.status); return r.json(); })
          .then((j) => { if (!off) setMap(j); }).catch((e) => { if (!off) setLoadError(e.message); });
        return () => { off = true; };
      }, [mapUrl]);
      if (loadError) return text(loadError, { color: "error.main" });
      if (!map) return text("Loading wallet.paypal…");
      if (!window.PayPalMe || !window.Me || !window.WalletPayPal) return text("Local .me / PayPal modules did not load. Reload to try again.");
      return h(Provider, { map });
    }
    function seedPreview(model) {
      const demo = window.__WALLET_PAYPAL_PREVIEW_RECEIPT;
      if (!demo) return;
      for (const name of ["member", "to", "amountCents", "currency", "description", "payeeEmail"]) if (demo[name] != null) model.set("wallet.paypal.operators.pay." + name, demo[name]);
      const request = model.input();
      const orderId = demo.orderId || "PREVIEWORDER";
      model.order({ id: orderId, status: "COMPLETED" }, request);
      model.capture({ type: "capture", orderId, captureId: demo.captureId || "PREVIEWCAPTURE", status: "COMPLETED", issuedAt: demo.issuedAt || new Date().toISOString(), ...request });
    }
    function Provider({ map }) {
      const [model] = React.useState(() => { const m = window.PayPalMe(window.Me, map); seedPreview(m); return m; });
      const [snap, setSnap] = React.useState(() => model.snapshot());
      const [pp] = React.useState(() => window.WalletPayPal.client({ baseUrl: window.__walletPayPalUrl || "http://127.0.0.1:8788" }));
      const [health, setHealth] = React.useState(null), [checking, setChecking] = React.useState(true);
      const [message, setMessage] = React.useState(""), [busy, setBusy] = React.useState(false);
      const alive = React.useRef(true), pending = React.useRef(false), queued = React.useRef([]);
      const update = (s) => { if (s && alive.current) setSnap(s); };
      const check = async () => {
        setChecking(true);
        try { const j = await pp.health(); if (!alive.current) return; setHealth(j); update(model.health(j)); }
        catch (_) { if (alive.current) { setHealth(null); update(model.health(null)); } }
        finally { if (alive.current) setChecking(false); }
      };
      React.useEffect(() => { alive.current = true; check(); return () => { alive.current = false; }; }, []);
      React.useEffect(() => {
        if (!health || !health.ok) return;
        update(model.state("wallet.paypal.events.state", "subscribed (local SSE client)"));
        const off = pp.events((evt) => {
          if (pending.current) { queued.current.push(evt); return; }
          const next = model.capture(evt); if (next) { update(next); setMessage("Capture received; receipt " + (evt.status === "COMPLETED" ? "issued" : "pending") + " (" + evt.status + ")."); }
        });
        return () => off();
      }, [!!(health && health.ok)]);
      const live = !!(health && health.ok && health.configured);
      const tag = checking ? "checking…" : live ? (health.env + " · local") : health ? "server has no credentials" : "off · node tools/paypal-server.mjs";
      const payRow = map.endpoints.find((r) => r.id === "operators.pay") || { fields: [], status: "wired" };
      const fieldOrder = ["member", "to", "amountCents", "currency", "description"];
      const fields = (payRow.fields || []).filter((f) => fieldOrder.includes(f.name)).sort((a, b) => fieldOrder.indexOf(a.name) - fieldOrder.indexOf(b.name));
      const fieldPath = (name) => "wallet.paypal.operators.pay." + name;
      const fieldValue = (name) => {
        const v = snap.values && snap.values[fieldPath(name)];
        return v === undefined || v === null ? "" : String(v);
      };
      const setField = (name, raw) => {
        let value = raw;
        if (name === "amountCents") value = raw === "" ? "" : Number(raw);
        if (name === "currency") value = String(raw).toUpperCase();
        update(model.set(fieldPath(name), value));
      };
      const operate = async () => {
        if (!live || busy) return;
        setBusy(true); setMessage(""); pending.current = true;
        try {
          const request = window.WalletPayPal.checkOrderInput(model.input());
          update(model.state("wallet.paypal.operators.pay.state", "creating order"));
          const order = await pp.charge(request);
          update(model.order(order, request));
          setMessage("Approve in the PayPal window. If it was blocked, use Open approval below.");
        } catch (e) { setMessage(e.message); update(model.state("wallet.paypal.operators.pay.state", "error")); }
        finally {
          pending.current = false;
          for (const evt of queued.current.splice(0)) update(model.capture(evt));
          if (alive.current) setBusy(false);
        }
      };
      const inputEl = (label, value, onChange, props, wrapSx) => h(Box, { component: "label", sx: { display: "grid", gap: 0.5, fontSize: 12, color: "text.secondary", ...wrapSx } }, label,
        h(Box, { component: "input", value, onChange, ...props, sx: { boxSizing: "border-box", width: "100%", minWidth: 0, p: 1, border: 1, borderColor: "divider", borderRadius: "7px", bgcolor: "background.default", color: "text.primary", fontFamily: mono, fontSize: 14 } }));
      const disabled = !live || busy || payRow.status !== "wired";
      const safeApprove = snap.lastOrder && /^https:\/\/(?:www\.)?(?:sandbox\.)?paypal\.com\//.test(snap.lastOrder.approveUrl || "") ? snap.lastOrder.approveUrl : null;
      const notice = (s) => setMessage(s);
      return h(Box, { sx: { display: "grid", gap: 2 }, "data-gui-node-id": "wallet.paypal.gui" },
        h(Box, { component: "header", sx: { display: "flex", alignItems: "center", gap: 1.25, color: "text.primary" } },
          h(PayPalMark, { size: 36, clipId: "paypal-mark-clip-hdr" }),
          h(Box, { component: "h1", sx: { fontSize: "clamp(1.6rem, 3.6vw, 2.1rem)", fontWeight: 800, letterSpacing: "-.03em", m: 0, lineHeight: 1 } }, "PayPal"),
          h(Box, { sx: { flex: 1 } }),
          text(tag),
          btn("Check", { onClick: check, disabled: checking || busy })),
        h(Box, { sx: { display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0,1fr) auto" }, gap: 2, alignItems: "start" } },
          h(Box, { sx: panel },
            h(Box, { sx: { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 } },
              fields.map((f) => inputEl(f.name + (f.required ? " *" : ""), fieldValue(f.name), (e) => setField(f.name, e.target.value), { disabled: busy, inputMode: f.name === "amountCents" ? "numeric" : undefined, maxLength: f.name === "currency" ? 3 : undefined }, f.name === "description" ? { gridColumn: { sm: "1 / -1" } } : null))),
            h(Box, { sx: { display: "flex", gap: 1, flexWrap: "wrap", mt: 1.5 } },
              btn("Pay", { onClick: operate, disabled, variant: "contained" }),
              safeApprove && h(Button, { size: "small", variant: "outlined", sx: { textTransform: "none" }, href: safeApprove, target: "_blank", rel: "noopener noreferrer" }, "Open approval")),
            message && text(message, { mt: 1.5 })),
          h(Box, { sx: panel }, h(MeQr, { member: fieldValue("member") }))),
        h(Box, { sx: panel },
          h(Box, { component: "h2", sx: { fontSize: 16, m: 0, mb: 1.5 } }, "Conversation"),
          !(snap.messages || []).length && text("When PayPal captures, the issued receipt appears here — ready to share."),
          h(Box, { sx: { display: "grid", gap: 1.5 } }, (snap.messages || []).map((msg, i) =>
            h(Box, { key: msg.receiptId || i, sx: { display: "grid", gap: 1, p: 1.5, border: 1, borderColor: "divider", borderRadius: "12px", bgcolor: "background.default" } },
              h(Box, { sx: { display: "flex", alignItems: "center", gap: 1, color: "text.primary" } },
                h(PayPalMark, { size: 20, clipId: "paypal-mark-clip-msg-" + (msg.receiptId || i) }),
                h(Box, { sx: { fontSize: 13, fontWeight: 600 } }, "PayPal"),
                text(msg.kind === "receipt" ? "receipt" : msg.kind)),
              text(msg.text || ""),
              msg.kind === "receipt" && h(ReceiptCard, { receipt: lookupReceipt(snap, msg.receiptId), notice }))))),
        h(Box, { sx: panel }, llmsView(snap)));
    }
    return Surface;
  };
})();
