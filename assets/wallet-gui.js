// .GUI (this.gui@4.2.1, which has G.QRme) for the two pages of the .wallet site: the landing (/.wallet/, a card per currency) and /.wallet/paypal/.
// Self-contained: the same topbar as the neurons-me docs (me:// path, search, Docs, GitHub, theme picker, light/dark, gear) plus Cleaker's compact QRme.
// The page's own static markup (#static-landing) is the single source of text, links and images: this script reads it, renders the same content
// through GUI.mount, then removes the static copy. Without JS or if the CDN fails, the static page stays as it is.
(function () {
  const html = document.documentElement, SRC = document.getElementById("static-landing"), ROOT = document.getElementById("root");
  const G = window.GUI;
  if (!G || !window.React || !window.ReactDOM || typeof G.mount !== "function" || !SRC || !ROOT) { html.classList.remove("gui-boot"); return; }
  try { render(); } catch (e) { html.classList.remove("gui-on", "gui-boot"); ROOT.innerHTML = ""; console.error(e); }
  function render() {
  const h = React.createElement, params = new URLSearchParams(location.search);
  const { Box, Button, Link, IconButton } = G.Atoms;
  const { Menu, MenuItem, ListItemIcon, ListItemText } = G.Molecules;
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const WIDE = "@media (min-width:640px)";
  const N = (type, props, children) => ({ type, props: props || {}, ...(children ? { children } : {}) });
  const txt = (el) => (el ? el.textContent.trim() : "");

  // ── read the static page ──
  const path = [...SRC.querySelectorAll(".mepath > a, .mepath > .here")].map((e) => ({ text: txt(e), href: e.getAttribute("href"), title: e.getAttribute("title") || txt(e) }));
  const header = SRC.querySelector("header");
  const page = {
    path, docs: SRC.querySelector(".topnav .act")?.getAttribute("href"), github: SRC.querySelector(".topnav .gh")?.getAttribute("href"),
    h1: txt(header.querySelector("h1")), lead: txt(header.querySelector(".lead")),
    // a small caption under the entry (.note), when the page has one
    note: txt(SRC.querySelector("main > .note")),
    // /.wallet/paypal/ and /.wallet/paypal/demos/ (#static-landing[data-layout=wallet-cards]): one card each (.card: .t title, .d line, .tag)
    cards: SRC.dataset.layout === "wallet-cards" ? [...SRC.querySelectorAll(".cards > .card")].map((c) => ({ href: c.getAttribute("href") || "", title: txt(c.querySelector(".t")), desc: txt(c.querySelector(".d")), tag: txt(c.querySelector(".tag")) })) : null,
    // /.wallet/paypal/ (#static-landing[data-layout=wallet-paypal]): the entry's own labels come from the static form, like every other text here
    wallet: SRC.dataset.layout === "wallet-paypal" ? (() => {
      const f = SRC.querySelector("[data-wallet-entry]");
      return { label: txt(f.querySelector("label")), placeholder: f.querySelector("textarea").getAttribute("placeholder") || "", photo: txt(f.querySelector("[data-wallet-photo]")),
        photoLabel: f.querySelector("[data-wallet-photo]").getAttribute("aria-label") || "", go: txt(f.querySelector("[data-wallet-go]")) };
    })() : null,
    // /.wallet/paypal/split/ (#static-landing[data-layout=wallet-split]): the split app, then the planned plain-language entry (disabled)
    split: SRC.dataset.layout === "wallet-split" ? (() => {
      const f = SRC.querySelector("[data-planned] [data-wallet-entry]");
      return { tag: txt(SRC.querySelector("[data-planned] .planned-tag")), label: txt(f.querySelector("label")), placeholder: f.querySelector("textarea").getAttribute("placeholder") || "",
        photo: txt(f.querySelector("[data-wallet-photo]")), go: txt(f.querySelector("[data-wallet-go]")) };
    })() : null,
    // /.wallet/ (#static-landing[data-layout=wallet-landing]): groups (Coins, Providers), one card each; a .coin without an href is not wired yet
    groups: SRC.dataset.layout === "wallet-landing" ? [...SRC.querySelectorAll(".group")].map((g) => ({ label: txt(g.querySelector(".group-label")),
      coins: [...g.querySelectorAll(".coin")].map((c) => ({ href: c.getAttribute("href") || "", name: txt(c.querySelector(".name")), tag: txt(c.querySelector(".tag")), src: c.querySelector("img").getAttribute("src") })) })) : null,
  };
  page.walletQR = !!(page.wallet || page.groups || page.cards || page.split);

  // ── icons: inline SVG (no icon font) ──
  const ICONS = {
    settings: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
    code: "M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z",
    grid: "M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z",
    palette: "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
    moon: "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z",
    sun: "M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z",
    search: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
    down: "M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z",
    github: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z",
  };
  const Ico = ({ kind, size = 18, off }) => h("svg", { viewBox: kind === "github" ? "0 0 16 16" : "0 0 24 24", width: size, height: size, fill: "currentColor", "aria-hidden": "true", focusable: "false", style: { display: "block", flex: "none" } },
    h("path", { d: ICONS[kind] }), off ? h("path", { d: "M3 3 21 21", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" }) : null);

  // ── search: the .GUI SearchBar (GUI.Components.SearchBar, the one on the neurons.me index / All.This) over the site
  //    index (absolute URLs, so it works from either repo). A magnifier until opened ("/" opens it too); Escape closes it,
  //    and so does leaving it while empty. On phones the open bar overlays the topbar, full width. ──
  const SEARCH_SRC = "https://neurons-me.github.io/index.json";
  // The SearchBar paints itself with fixed inline colours; re-skin it from the active theme (same rules as the index).
  const searchSkin = (t) => {
    const P = t.palette, I = (v) => `${v} !important`, shadow = (t.shadows && t.shadows[8]) || "none";
    return {
      "& > div > div:first-of-type": { background: I(P.background.paper), borderColor: I(P.divider), color: I(P.text.primary), padding: I("6px 12px"), transition: "border-color 120ms ease" },
      "& > div > div:first-of-type:focus-within": { borderColor: I(P.primary.main) },
      "& input": { color: I(P.text.primary), caretColor: P.primary.main },
      "& input::placeholder": { color: P.text.secondary, opacity: 1 },
      "& [role=listbox]": { background: I(P.background.paper), borderColor: I(P.divider), boxShadow: I(shadow), color: P.text.primary },
      "& [role=listbox] > div": { color: I(P.text.secondary) },
      "& [role=option]": { color: I(P.text.primary), borderColor: I(P.divider) },
      "& [role=option]:hover, & [role=option][aria-selected=true]": { background: I(P.action.hover) },
      "& [role=option] > span:nth-of-type(2) > span:nth-of-type(2), & [role=option] > span:nth-of-type(3)": { color: I(P.text.secondary) },
    };
  };
  function TopSearch() {
    const SB = G.Components && G.Components.SearchBar;
    const [open, setOpen] = React.useState(false), box = React.useRef(null), btn = React.useRef(null);
    React.useEffect(() => { if (open) { const i = box.current && box.current.querySelector("input"); if (i) i.focus(); } }, [open]);
    React.useEffect(() => {
      if (open) return undefined;
      const k = (e) => { const t = e.target; if (e.key === "/" && !e.metaKey && !e.ctrlKey && !(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))) { e.preventDefault(); setOpen(true); } };
      window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
    }, [open]);
    if (!SB) return null;
    const close = (refocus) => { setOpen(false); if (refocus) setTimeout(() => btn.current && btn.current.focus(), 0); };
    if (!open) return h(G.Atoms.IconButton, { ref: btn, id: "site-search-open", size: "small", "aria-label": "Search", title: "Search (/)", onClick: () => setOpen(true), sx: { color: "text.secondary", p: { xs: .25, sm: .625 } } }, h(Ico, { kind: "search", size: 18 }));
    return h(G.Atoms.Box, { ref: box, id: "site-search", role: "search",
      onKeyDown: (e) => { if (e.key === "Escape") { e.preventDefault(); close(true); } },
      onBlur: (e) => { const nx = e.relatedTarget; if (nx && box.current && box.current.contains(nx)) return; const i = box.current && box.current.querySelector("input"); if (!i || !i.value.trim()) close(false); },
      sx: (t) => ({ zIndex: 1200, width: 300, minWidth: 0, flexShrink: 1, [t.breakpoints.down("sm")]: { position: "absolute", left: 8, right: 8, top: "50%", transform: "translateY(-50%)", width: "auto" },
        "& > div": { maxWidth: "none !important" }, ...searchSkin(t) }) },
      h(SB, { src: SEARCH_SRC, placeholder: "Search in All.This", themeMode: "auto", enableSlashShortcut: false }));
  }
  // ── topbar (same as ContextLab): logo, me:// path, Docs, GitHub, theme picker, light/dark, gear ──
  const LOGO = "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760629064/neurons.me_b50f6a.png";
  function ThemePicker() {
    const [anchor, setAnchor] = React.useState(null), { themeId } = G.useThemeContext(), close = () => setAnchor(null);
    return h(React.Fragment, null,
      h(Button, { id: "theme-picker", size: "small", variant: "outlined", "aria-label": `Theme: ${themeId}`, "aria-haspopup": "true", "aria-expanded": anchor ? "true" : "false", onClick: (e) => setAnchor(e.currentTarget),
        sx: { minWidth: 0, py: { xs: .5, sm: .25 }, px: { xs: .5, sm: .75 }, gap: .5, fontFamily: MONO, fontSize: 11, textTransform: "none", color: "text.secondary", borderColor: { xs: "transparent", sm: "divider" }, whiteSpace: "nowrap", "& .lbl": { display: { xs: "none", sm: "inline" } } } },
        h(Ico, { kind: "palette", size: 15 }), h(Box, { component: "span", className: "lbl" }, themeId), h(Box, { component: "span", className: "lbl" }, h(Ico, { kind: "down", size: 14 }))),
      h(Menu, { id: "theme-menu", anchorEl: anchor, open: !!anchor, onClose: close, anchorOrigin: { vertical: "bottom", horizontal: "right" }, transformOrigin: { vertical: "top", horizontal: "right" }, "data-gui-inspector-control": "true",
        slotProps: { list: { "aria-label": "Themes", dense: true }, paper: { sx: { width: 220, p: .5, mt: .5 } } } },
        h(G.ThemesCatalog, { sidebarView: "expanded", onThemeSelect: close })));
  }
  function ModeToggle() {
    const { mode, toggleMode } = G.useThemeContext(), dark = mode === "dark";
    return h(IconButton, { id: "theme-mode-toggle", size: "small", onClick: () => toggleMode(), "aria-label": dark ? "Switch to light mode" : "Switch to dark mode", title: dark ? "Light mode" : "Dark mode", sx: { color: "text.secondary", p: { xs: .5, sm: .625 } } }, h(Ico, { kind: dark ? "moon" : "sun", size: 18 }));
  }
  function SettingsMenu() {
    const sel = G.useOptionalSelection ? G.useOptionalSelection() : null;
    const [anchor, setAnchor] = React.useState(null), close = () => setAnchor(null);
    React.useEffect(() => { if (sel && params.get("grid") === "1" && !sel.gridEnabled) sel.setGridEnabled(true); }, []);
    const insp = Boolean(G.getInspectorEnabled()), grid = Boolean(sel && sel.gridEnabled);
    const items = [
      { key: "inspector", label: insp ? "Inspector · ON" : "Inspector · OFF", icon: h(Ico, { kind: "code", off: !insp }), onClick: () => G.toggleInspector() },
      sel && { key: "grid", label: grid ? "Grid Layout · ON" : "Grid Layout · OFF", icon: h(Ico, { kind: "grid", off: !grid }), onClick: () => sel.setGridEnabled(!grid) },
    ].filter(Boolean);
    return h(React.Fragment, null,
      h(IconButton, { id: "gui-settings", "aria-label": "GUI settings", title: "GUI settings", size: "small", onClick: (e) => setAnchor(e.currentTarget), sx: { color: "text.secondary", p: { xs: .5, sm: .625 } } }, h(Ico, { kind: "settings", size: 18 })),
      h(Menu, { id: "settings-menu", anchorEl: anchor, open: !!anchor, onClose: close, "data-gui-inspector-control": "true", anchorOrigin: { vertical: "bottom", horizontal: "right" }, transformOrigin: { vertical: "top", horizontal: "right" } },
        ...items.map((it) => h(MenuItem, { key: it.key, "data-settings-item": it.key, onClick: () => { close(); it.onClick(); } }, h(ListItemIcon, null, it.icon), h(ListItemText, null, it.label)))));
  }
  // ── Cleaker's compact QRme in the topbar of both pages (neurons-me/Cleaker landing-gui.js, commits ac6babf + 7b598e8). The same rules as there:
  //    label "cleaker.me @ <window.location.host>" (surfaceToken) with the tightened "@", line padlock (closed on https, open + warning on http,
  //    transportInfo), QR value per the library's NRP rule (the namespace's own address; the page's host stays in the label, not in the QR).
  //    Difference: the library's "topbar" QRme (40px, the one its own top bar uses) draws no perimeter label, so the label and the padlock sit
  //    beside the QR (label from sm up; on a phone the QR and the padlock) instead of on the QR's perimeter (variant "xl" in Cleaker). ──
  const CLEAKER_NAMESPACE = "cleaker.me";
  const CLEAKER_QR_VALUE = "https://" + CLEAKER_NAMESPACE;
  // surfaceToken (positionExpression.ts): a bare host[:port]; quoted with its scheme only for http on a non-loopback host or an IPv6 literal.
  function surfaceToken(loc) {
    const host = String(loc.host || "").trim().toLowerCase();
    if (!host) return "";
    const scheme = String(loc.protocol || "http:").toLowerCase().replace(/:?$/, ":");
    const loopback = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|[^.:\s]+\.localhost)(?::\d+)?$/i.test(host);
    return (scheme === "http:" && !loopback) || host.charAt(0) === "[" ? '"' + scheme + "//" + host + '"' : host;
  }
  // Transport security as the browser itself reports it, nothing more: https: in a secure context means the browser accepted a
  // certificate; http: means there is none. Issuer and expiry are not readable from a page, so none is claimed.
  function transportInfo() {
    const proto = String(location.protocol || "").toLowerCase();
    const secure = proto === "https:" && window.isSecureContext === true;
    return { secure, title: secure ? "HTTPS \u00b7 certificate accepted by browser" : proto === "http:" ? "HTTP \u00b7 no certificate" : proto === "https:" ? "HTTPS \u00b7 not a secure context" : String(proto.replace(":", "")).toUpperCase() + " \u00b7 no certificate" };
  }
  // Line icon, currentColor, 24-box: a closed padlock, or the same padlock with its shackle lifted.
  function LockGlyph(p) {
    return h("svg", { viewBox: "0 0 24 24", width: p.size, height: p.size, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", "data-lock": p.secure ? "closed" : "open" },
      h("rect", { x: 5, y: 11, width: 14, height: 9.5, rx: 2 }),
      h("path", { d: p.secure ? "M8 11V8a4 4 0 0 1 8 0v3" : "M8 11V8a4 4 0 0 1 7.6-1.7" }));
  }
  function WalletQR(p) {
    const loc = typeof window !== "undefined" ? window.location : { host: "", protocol: "https:", origin: "" };
    const surface = surfaceToken(loc);
    const label = surface ? CLEAKER_NAMESPACE + " @ " + surface : CLEAKER_NAMESPACE;
    const full = loc.host ? CLEAKER_NAMESPACE + ' @ "' + String(loc.protocol).toLowerCase() + "//" + String(loc.host).toLowerCase() + '"' : CLEAKER_NAMESPACE;
    const tr = React.useMemo(transportInfo, []), id = p["data-gui-node-id"];
    return h(Box, { sx: { display: "inline-flex", alignItems: "center", gap: .75, flexShrink: 0, minWidth: 0 } },
      h(Box, { component: "a", href: (loc.origin || "") + "/", title: full, "aria-label": full, "data-position-expression": full,
        sx: { display: "inline-flex", lineHeight: 0, color: "inherit", textDecoration: "none", "&:focus": { outline: "none" }, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 3, borderRadius: 2 } } },
        h(G.QRme, { variant: "topbar", value: CLEAKER_QR_VALUE, perimeterLabel: label, perimeterRootLabel: CLEAKER_NAMESPACE, clickFlip: false, hoverFlip: false, cursor: "pointer", "data-gui-node-id": id })),
      h(Box, { component: "span", title: tr.title, "data-gui-node-id": id + ".transport", "data-transport": tr.secure ? "https" : "insecure",
        sx: { display: "inline-flex", lineHeight: 0, color: tr.secure ? "text.secondary" : "warning.main" } }, h(LockGlyph, { size: 14, secure: tr.secure })),
      // the label is monospace, so " @ " is three full cells; word-spacing pulls the two spaces in (presentation only, the text is unchanged)
      h(Box, { component: "span", "data-gui-node-id": id + ".label", sx: { display: { xs: "none", sm: "inline" }, fontFamily: MONO, fontSize: 11.5, lineHeight: 1.2, color: "text.secondary", whiteSpace: "nowrap", wordSpacing: "-0.36em" } }, label));
  }
  function LandingTopBar(p) {
    // when the path doesn't fit (deep pages on phones), the middle segments collapse to "…" (a link to the parent), so the last one shows in full
    const P = page.path, last = P.length - 1, [mode, setMode] = React.useState("measure"), col = mode === "col", pathRef = React.useRef(null);
    React.useEffect(() => { const re = () => setMode("measure"); window.addEventListener("resize", re); if (document.fonts && document.fonts.ready) document.fonts.ready.then(re); return () => window.removeEventListener("resize", re); }, []);
    React.useEffect(() => { const b = pathRef.current; if (mode === "measure" && b) setMode(b.scrollWidth > b.clientWidth + 1 ? "col" : "full"); }, [mode]);
    const mids = P.slice(1, last).map((x) => x.text).join(" / ");
    const seg = (s, i) => { const hide = col && i > 0 && i < last, ell = col && i === last && last > 1;
      return [i > 0 && !P[i - 1].text.endsWith("://") && !hide && !ell ? h(Box, { component: "span", key: `sep${i}`, sx: { color: "text.disabled", mx: .15 } }, "/") : null,
      ell ? h(Link, { key: "ell", href: P[last - 1].href, underline: "hover", title: mids, "aria-label": mids, sx: { color: "primary.main", fontFamily: MONO, fontSize: { xs: 12, sm: 13 } } }, "…") : null,
      ell ? h(Box, { component: "span", key: "ellsep", sx: { color: "text.disabled", mx: .15 } }, "/") : null,
      hide ? null : s.href ? h(Link, { key: s.text, href: s.href, underline: "hover", title: s.title, sx: { color: "primary.main", fontFamily: MONO, fontSize: { xs: 12, sm: 13 } } }, s.text)
        : h(Box, { component: "span", key: s.text, "aria-current": "page", sx: { color: "text.primary", fontFamily: MONO, fontSize: { xs: 12, sm: 13 }, fontWeight: 600, flexShrink: 0 } }, s.text)]; };
    return h(Box, { component: "nav", "aria-label": "me path", "data-gui-node-id": p["data-gui-node-id"], sx: { position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", gap: { xs: .5, sm: 1.25 }, px: { xs: .75, sm: 2.5 }, minHeight: 48, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" } },
      h(Link, { href: "https://neurons-me.github.io/", title: "neurons.me", underline: "none", sx: { display: "inline-flex", lineHeight: 0, flexShrink: 0 } }, h("img", { src: LOGO, alt: "neurons.me", width: 28, height: 28, style: { display: "block", objectFit: "contain" } })),
      h(Box, { ref: pathRef, sx: { display: "inline-flex", alignItems: "center", minWidth: 0, overflowX: "auto", whiteSpace: "nowrap", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } } }, ...page.path.flatMap(seg)),
      h(Box, { sx: { ml: "auto", display: "inline-flex", alignItems: "center", gap: { xs: .25, sm: 1.25 }, flexShrink: 0 } },
        page.walletQR && h(WalletQR, { "data-gui-node-id": "GUI.window.layout.bars.top.qr" }),
        h(TopSearch),
        page.docs && h(Link, { href: page.docs, underline: "hover", sx: { fontFamily: MONO, fontSize: 12, color: "text.secondary", mx: { xs: 1, sm: 0 } } }, "Docs"),
        page.github && h(Link, { href: page.github, underline: "none", target: "_blank", rel: "noopener", title: "GitHub · " + page.github.replace(/^https?:\/\/github\.com\//, ""), "aria-label": "GitHub", sx: { display: "inline-flex", lineHeight: 0, color: "text.secondary", "&:hover": { color: "text.primary" } } }, h(Ico, { kind: "github", size: 18 })),
        h(Box, { "data-gui-inspector-control": "true", sx: { display: "inline-flex", alignItems: "center", gap: .25 } }, h(ThemePicker), h(ModeToggle), h(SettingsMenu))));
  }
  // ── /.wallet/paypal/ hero: one entry, UI only (nothing is sent anywhere yet): the text area for "who paid what", a receipt-photo button
  //    (the browser's file picker; the chosen file only shows its name here) and a primary button that stays disabled while there is nothing to send. ──
  const LINE = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  const CameraGlyph = () => h("svg", { viewBox: "0 0 24 24", width: 18, height: 18, "aria-hidden": "true", focusable: "false", style: { display: "block", flex: "none" }, ...LINE },
    h("path", { d: "M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.3-2h5.4L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" }), h("circle", { cx: 12, cy: 12.5, r: 3.2 }));
  const ArrowGlyph = () => h("svg", { viewBox: "0 0 24 24", width: 18, height: 18, "aria-hidden": "true", focusable: "false", style: { display: "block", flex: "none" }, ...LINE },
    h("path", { d: "M5 12h14M13 6l6 6-6 6" }));
  function WalletEntry(p) {
    const W = page.wallet, [text, setText] = React.useState(""), [file, setFile] = React.useState(""), pick = React.useRef(null), ready = text.trim() !== "" || file !== "";
    const id = p["data-gui-node-id"];
    return h(Box, { component: "form", "data-gui-node-id": id, "aria-label": W.label, onSubmit: (e) => e.preventDefault(),
      sx: { border: 1, borderColor: "divider", borderRadius: "14px", bgcolor: "background.paper", p: { xs: 1.5, sm: 2 }, transition: "border-color .15s", "&:focus-within": { borderColor: "primary.main" } } },
      h(Box, { component: "label", htmlFor: "wallet-who-paid-what", sx: { position: "absolute", top: 0, left: 0, m: "-1px", p: 0, border: 0, width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" } }, W.label),
      h(G.Atoms.TextField, { id: "wallet-who-paid-what", multiline: true, minRows: 4, maxRows: 10, fullWidth: true, variant: "standard", placeholder: W.placeholder, value: text, onChange: (e) => setText(e.target.value),
        slotProps: { input: { disableUnderline: true, "data-gui-node-id": id + ".text" } }, sx: { "& .MuiInputBase-root": { fontSize: "1.05rem", lineHeight: 1.6, alignItems: "flex-start" } } }),
      h(Box, { sx: { display: "flex", alignItems: "center", gap: 1, mt: 1.5 } },
        h("input", { ref: pick, type: "file", accept: "image/*", hidden: true, "data-gui-node-id": id + ".file", onChange: (e) => setFile((e.target.files && e.target.files[0] && e.target.files[0].name) || "") }),
        h(Button, { type: "button", size: "small", variant: "outlined", "aria-label": W.photoLabel || W.photo, "data-gui-node-id": id + ".photo", onClick: () => pick.current && pick.current.click(),
          startIcon: h(CameraGlyph), sx: { textTransform: "none", color: "text.primary", borderColor: "divider", borderRadius: "10px", px: 1.5, py: .75, flexShrink: 0, "&:hover": { borderColor: "primary.main" } } }, W.photo),
        file && h(Box, { component: "span", title: file, sx: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: MONO, fontSize: 12, color: "text.secondary" } }, file),
        h(Button, { type: "submit", variant: "contained", disabled: !ready, "data-gui-node-id": id + ".go", endIcon: h(ArrowGlyph),
          sx: { ml: "auto", textTransform: "none", borderRadius: "10px", px: 2, py: .75, flexShrink: 0, boxShadow: "none" } }, W.go)));
  }

  // ── /.wallet/paypal/split/: the split app over the .me model (assets/split/split-me.js). Every number shown is read from the kernel;
  //    the only JS arithmetic is the transfer suggestion (SplitMe.settle) and cents formatting. Starts empty: no example data. ──
  const inputSx = { font: "inherit", fontSize: 14, color: "inherit", bgcolor: "transparent", border: 1, borderColor: "divider", borderRadius: "8px", px: 1, py: .5, minWidth: 0, outline: 0, "&:focus": { borderColor: "primary.main" }, "&:disabled": { opacity: .5 } };
  const In = (props) => h(Box, { component: "input", ...props, sx: { ...inputSx, ...(props.sx || {}) } });
  const Btn = (props, label) => h(Button, { size: "small", variant: "outlined", ...props, sx: { textTransform: "none", borderRadius: "8px", color: "text.primary", borderColor: "divider", "&:hover": { borderColor: "primary.main" }, flexShrink: 0, ...(props.sx || {}) } }, label);
  const Panel = (id, label, ...kids) => h(Box, { component: "section", "data-gui-node-id": id, "aria-label": label, sx: { border: 1, borderColor: "divider", borderRadius: "14px", bgcolor: "background.paper", p: { xs: 1.5, sm: 2 }, mb: 1.5 } },
    h(Box, { component: "p", sx: { fontSize: ".72rem", letterSpacing: ".06em", textTransform: "uppercase", color: "text.secondary", m: 0, mb: 1.25 } }, label), ...kids);
  const Muted = (t) => h(Box, { component: "p", sx: { color: "text.secondary", fontSize: 14, m: 0 } }, t);
  const Num = (c, sx) => h(Box, { component: "span", sx: { fontFamily: MONO, fontSize: 13, textAlign: "right", whiteSpace: "nowrap", ...(sx || {}) } }, c);
  function SplitApp(p) {
    const id = p["data-gui-node-id"];
    const model = React.useMemo(() => window.SplitMe && window.Me ? window.SplitMe(window.Me, { currency: "USD" }) : null, []);
    const [, bump] = React.useState(0), redraw = () => bump((x) => x + 1);
    const [name, setName] = React.useState(""), [err, setErr] = React.useState("");
    const blank = () => ({ editing: null, title: "", paid: {}, inSplit: {}, weight: {}, weights: false });
    const [f, setF] = React.useState(blank);
    const [why, setWhy] = React.useState(null);
    if (!model) return Panel(id, "Split", Muted("The .me kernel did not load."));
    // the Meta slot (PlannedEntry) hands over validated, parsed expenses; .me computes everything from here
    window.__walletSplit = model;
    React.useEffect(() => { const on = (ev) => { const P = window.MetaParse; if (!P) return; const { members: ms, specs } = P.toSplitSpecs(ev.detail);
      tryDo(() => { const have = new Set(model.members().map((m) => m.id)); for (const m of ms) if (!have.has(m.id)) model.addMember(m.id, m.name); for (const sp of specs) model.addExpense(sp); }); };
      window.addEventListener("wallet:parsed", on); return () => window.removeEventListener("wallet:parsed", on); }, []);
    const S = model, cur = S.currency, money = (c) => S.fmt(c) + " " + cur, mem = S.members(), nm = Object.fromEntries(mem.map((m) => [m.id, m.name]));
    const tryDo = (fn) => { try { fn(); setErr(""); redraw(); return true; } catch (e) { setErr(e.message); return false; } };
    const addMember = (e) => { e.preventDefault(); const n = name.trim(); if (!n) return;
      let base = n.toLowerCase().replace(/[^a-z0-9]/g, "") || "m"; if (!/^[a-z]/.test(base)) base = "m" + base; let mid = base, i = 2; while (nm[mid]) mid = base + i++;
      if (tryDo(() => S.addMember(mid, n))) { setName(""); setF((x) => ({ ...x, inSplit: { ...x.inSplit, [mid]: true } })); } };
    const inSplit = (m) => f.inSplit[m] !== false && (f.inSplit[m] || !f.editing && f.inSplit[m] === undefined);
    const submit = (e) => { e.preventDefault();
      const paid = {}; for (const m of mem) { const v = (f.paid[m.id] || "").trim(); if (v && Number(v) !== 0) paid[m.id] = v; }
      const split = f.weights ? Object.fromEntries(mem.filter((m) => inSplit(m.id)).map((m) => [m.id, Number(f.weight[m.id] || 1)])) : mem.filter((m) => inSplit(m.id)).map((m) => m.id);
      const spec = { title: f.title.trim(), paid, split };
      if (tryDo(() => (f.editing ? S.editExpense(f.editing, spec) : S.addExpense(spec)))) setF(blank()); };
    const edit = (x) => { const w = Array.isArray(x.split) ? Object.fromEntries(x.split.map((m) => [m, 1])) : x.split;
      setF({ editing: x.id, title: x.title, paid: Object.fromEntries(Object.entries(x.paid).map(([k, v]) => [k, String(v)])), inSplit: Object.fromEntries(mem.map((m) => [m.id, !!w[m.id]])),
        weight: Object.fromEntries(Object.entries(w).map(([k, v]) => [k, String(v)])), weights: !Array.isArray(x.split) }); };
    const exps = S.expenses(), bals = S.balances(), moves = S.settle(), grid = { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto auto", columnGap: 2, rowGap: .75, alignItems: "center" };
    const members = Panel(id + ".members", "Members",
      h(Box, { component: "form", onSubmit: addMember, sx: { display: "flex", gap: 1 } },
        In({ value: name, onChange: (e) => setName(e.target.value), placeholder: "Name", "aria-label": "Member name", "data-gui-node-id": id + ".members.name", sx: { flex: 1 } }),
        Btn({ type: "submit", "data-gui-node-id": id + ".members.add" }, "+ Add")),
      mem.length ? h(Box, { sx: { display: "flex", flexWrap: "wrap", gap: .75, mt: 1.25 } }, ...mem.map((m) => h(Box, { key: m.id, component: "span", sx: { fontFamily: MONO, fontSize: 13, border: 1, borderColor: "divider", borderRadius: "999px", px: 1.25, py: .25 } }, m.name))) : null);
    const form = mem.length ? Panel(id + ".expense", f.editing ? "Edit expense" : "Add expense",
      h(Box, { component: "form", onSubmit: submit },
        In({ value: f.title, onChange: (e) => setF({ ...f, title: e.target.value }), placeholder: "What for", "aria-label": "What for", "data-gui-node-id": id + ".expense.title", sx: { width: "100%", mb: 1.25 } }),
        h(Box, { sx: { display: "grid", gridTemplateColumns: f.weights ? "minmax(0,1fr) 96px 56px 64px" : "minmax(0,1fr) 96px 56px", columnGap: 1, rowGap: .75, alignItems: "center", fontSize: 14 } },
          h(Box, { component: "span", sx: { color: "text.secondary", fontSize: 12 } }, ""), h(Box, { component: "span", sx: { color: "text.secondary", fontSize: 12 } }, "Paid " + cur), h(Box, { component: "span", sx: { color: "text.secondary", fontSize: 12, textAlign: "center" } }, "In"),
          f.weights && h(Box, { component: "span", sx: { color: "text.secondary", fontSize: 12 } }, "Weight"),
          ...mem.flatMap((m) => [
            h(Box, { key: m.id + "n", component: "span", sx: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, m.name),
            In({ key: m.id + "p", inputMode: "decimal", value: f.paid[m.id] || "", placeholder: "0.00", "aria-label": m.name + " paid", onChange: (e) => setF({ ...f, paid: { ...f.paid, [m.id]: e.target.value } }), sx: { fontFamily: MONO, textAlign: "right" } }),
            h(Box, { key: m.id + "s", sx: { textAlign: "center" } }, h("input", { type: "checkbox", checked: inSplit(m.id), "aria-label": m.name + " is in", onChange: (e) => setF({ ...f, inSplit: { ...f.inSplit, [m.id]: e.target.checked } }) })),
            f.weights && In({ key: m.id + "w", inputMode: "numeric", value: f.weight[m.id] || "1", disabled: !inSplit(m.id), "aria-label": m.name + " weight", onChange: (e) => setF({ ...f, weight: { ...f.weight, [m.id]: e.target.value } }), sx: { fontFamily: MONO, textAlign: "right" } }),
          ].filter(Boolean))),
        h(Box, { sx: { display: "flex", alignItems: "center", gap: 1, mt: 1.5, flexWrap: "wrap" } },
          h(Box, { component: "label", sx: { display: "inline-flex", alignItems: "center", gap: .5, fontSize: 13, color: "text.secondary" } }, h("input", { type: "checkbox", checked: f.weights, onChange: (e) => setF({ ...f, weights: e.target.checked }) }), "Uneven (weights)"),
          f.editing && Btn({ type: "button", onClick: () => setF(blank()) }, "Cancel"),
          h(Button, { type: "submit", variant: "contained", "data-gui-node-id": id + ".expense.save", sx: { ml: "auto", textTransform: "none", borderRadius: "8px", boxShadow: "none" } }, f.editing ? "Save" : "Add expense")),
        err && h(Box, { component: "p", role: "alert", sx: { color: "error.main", fontSize: 13, m: 0, mt: 1 } }, err))) : null;
    const list = exps.length ? Panel(id + ".expenses", "Expenses",
      ...exps.map((x) => h(Box, { key: x.id, sx: { display: "flex", alignItems: "center", gap: 1, py: .5, borderTop: 1, borderColor: "divider", "&:first-of-type": { borderTop: 0 } } },
        h(Box, { sx: { flex: 1, minWidth: 0 } }, h(Box, { sx: { fontSize: 14 } }, x.title || x.id),
          h(Box, { sx: { fontSize: 12, color: "text.secondary" } }, "paid by " + Object.keys(x.paid).map((m) => nm[m]).join(", ") + " · in: " + (Array.isArray(x.split) ? x.split : Object.keys(x.split).filter((m) => x.split[m] > 0)).map((m) => nm[m]).join(", "))),
        Num(money(x.amount)),
        Btn({ onClick: () => edit(x), "aria-label": "Edit " + (x.title || x.id) }, "Edit"),
        Btn({ onClick: () => tryDo(() => { S.removeExpense(x.id); if (f.editing === x.id) setF(blank()); }), "aria-label": "Remove " + (x.title || x.id), sx: { px: 1, minWidth: 0 } }, "×")))) : null;
    const whyBox = (m) => { const x = S.explain(m), line = (t, v) => h(Box, { sx: { display: "flex", gap: 1 } }, h(Box, { component: "code", sx: { flex: 1, minWidth: 0, overflowWrap: "anywhere" } }, t), v === undefined ? null : Num(S.fmt(v)));
      return h(Box, { "data-gui-node-id": id + ".balances." + m + ".explain", sx: { gridColumn: "1 / -1", fontFamily: MONO, fontSize: 12, color: "text.secondary", border: 1, borderColor: "divider", borderRadius: "8px", p: 1, mb: .5, display: "grid", gap: .25 } },
        line("net = " + x.net.expr, x.net.value), ...x.net.inputs.map((i) => line("  " + i.path + " (" + i.status + ")", i.value)),
        line("paid = " + x.paid.expr, x.paid.value), line("owed = " + x.owed.expr, x.owed.value),
        ...x.expenses.map((e) => line("  " + (e.title || e.id) + ": owe = " + e.owe.expr, e.owe.value)),
        h(Box, { sx: { mt: .5 } }, "me.explain() from the kernel; amounts in " + cur + "."));
    };
    const balances = mem.length ? Panel(id + ".balances", "Balances",
      exps.length ? h(Box, { sx: grid },
        h(Box, { component: "span", sx: { fontSize: 12, color: "text.secondary" } }, ""), Num("paid", { color: "text.secondary", fontFamily: "inherit", fontSize: 12 }), Num("owed", { color: "text.secondary", fontFamily: "inherit", fontSize: 12 }), Num("net", { color: "text.secondary", fontFamily: "inherit", fontSize: 12 }),
        ...bals.flatMap((b) => [
          h(Box, { key: b.id + "n", sx: { display: "flex", alignItems: "center", gap: 1, minWidth: 0 } }, h(Box, { component: "span", sx: { overflow: "hidden", textOverflow: "ellipsis" } }, b.name),
            h(Box, { component: "button", type: "button", onClick: () => setWhy(why === b.id ? null : b.id), "aria-expanded": why === b.id ? "true" : "false", "data-gui-node-id": id + ".balances." + b.id + ".why",
              sx: { font: "inherit", fontSize: 12, color: "text.secondary", bgcolor: "transparent", border: 0, p: 0, cursor: "pointer", textDecoration: "underline", "&:hover": { color: "text.primary" } } }, why === b.id ? "hide" : "why")),
          Num(S.fmt(b.paid), { key: b.id + "p" }), Num(S.fmt(b.owed), { key: b.id + "o" }), Num((b.net > 0 ? "+" : "") + S.fmt(b.net), { key: b.id + "t", fontWeight: 600 }),
          why === b.id ? h(React.Fragment, { key: b.id + "x" }, whyBox(b.id)) : null,
        ].filter(Boolean)),
        h(Box, { sx: { gridColumn: "1 / -1", fontSize: 12, color: "text.secondary", mt: .5 } }, "Sum of nets: " + S.fmt(S.check()) + " " + cur)) : Muted("No expenses yet.")) : null;
    const transfers = exps.length ? Panel(id + ".transfers", "Suggested transfers",
      moves.length ? h(Box, { sx: { display: "grid", gap: .5 } }, ...moves.map((t, i) => h(Box, { key: i, sx: { display: "flex", alignItems: "center", gap: 1, fontSize: 14 } }, h("span", null, nm[t.from]), h(Box, { component: "span", sx: { color: "text.secondary" } }, "→"), h("span", null, nm[t.to]), Num(money(t.cents), { ml: "auto" }))))
        : Muted("Everyone is even."), h(Box, { component: "p", sx: { fontSize: 12, color: "text.secondary", m: 0, mt: 1 } }, "Nothing is sent from here.")) : null;
    return h(Box, { "data-gui-node-id": id }, members, form, list, balances, transfers);
  }
  // the plain-language entry: live only when the local Meta parse server (tools/meta-parse-server.mjs) answers /health with a key;
  //   otherwise it stays disabled with an honest label. The model only parses; the key never reaches the page.
  const META_URL = (window.__walletMetaParseUrl || "http://127.0.0.1:8787").replace(/\/$/, "");
  function PlannedEntry(p) {
    const W = page.split, id = p["data-gui-node-id"];
    const [st, setSt] = React.useState({ live: false, tag: W.tag + " · checking local parse server…" });
    const [text, setText] = React.useState(""), [img, setImg] = React.useState(null), [busy, setBusy] = React.useState(false), [msg, setMsg] = React.useState("");
    const fileRef = React.useRef(null);
    React.useEffect(() => { let off = false;
      fetch(META_URL + "/health").then((r) => r.json()).then((j) => { if (off) return;
        setSt(j.ok && j.keyConfigured ? { live: true, tag: "Meta model · " + j.model + " via local server" } : { live: false, tag: W.tag + " · local server has no META_API_KEY" }); })
        .catch(() => !off && setSt({ live: false, tag: W.tag + " · off: run node tools/meta-parse-server.mjs locally" }));
      return () => { off = true; }; }, []);
    const go = async (e) => { e.preventDefault(); if (!st.live || busy || !window.MetaParse) return; setBusy(true); setMsg("");
      try { const S = window.__walletSplit, members = S ? S.members().map((m) => m.name) : [];
        const r = await fetch(META_URL + "/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, members, speaker: members[0] || "", image: img }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || "parse failed");
        const v = window.MetaParse.validate(j); // validated again on the page before .me sees it
        window.dispatchEvent(new CustomEvent("wallet:parsed", { detail: v })); setText(""); setImg(null); setMsg("Added " + v.expenses.length + " expense(s); .me computed the split.");
      } catch (err) { setMsg(err.message); } finally { setBusy(false); } };
    const pick = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => setImg(rd.result); rd.readAsDataURL(f); };
    const live = st.live;
    return h(Box, { component: "form", onSubmit: go, "data-gui-node-id": id, "aria-disabled": live ? "false" : "true", sx: { mt: 3 } },
      h(Box, { component: "p", sx: { fontSize: ".72rem", letterSpacing: ".06em", textTransform: "uppercase", color: "text.secondary", m: 0, mb: 1 } }, st.tag),
      h(Box, { sx: { border: 1, borderStyle: live ? "solid" : "dashed", borderColor: "divider", borderRadius: "14px", p: { xs: 1.5, sm: 2 }, opacity: live ? 1 : .6 } },
        h(Box, { component: "label", htmlFor: "wallet-who-paid-what", sx: { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" } }, W.label),
        h(Box, { component: "textarea", id: "wallet-who-paid-what", disabled: !live || busy, rows: 2, value: text, onChange: (e) => setText(e.target.value), placeholder: W.placeholder, sx: { display: "block", width: "100%", resize: "none", border: 0, bgcolor: "transparent", color: "inherit", font: "inherit", fontSize: "1rem" } }),
        h("input", { ref: fileRef, type: "file", accept: "image/png,image/jpeg,image/webp", hidden: true, onChange: pick }),
        h(Box, { sx: { display: "flex", gap: 1, mt: 1 } },
          h(Button, { size: "small", variant: "outlined", disabled: !live || busy, onClick: () => fileRef.current && fileRef.current.click(), startIcon: h(CameraGlyph), sx: { textTransform: "none", borderRadius: "10px" } }, img ? "Receipt ✓" : W.photo),
          h(Button, { type: "submit", size: "small", variant: "contained", disabled: !live || busy || (!text.trim() && !img), endIcon: h(ArrowGlyph), sx: { ml: "auto", textTransform: "none", borderRadius: "10px", boxShadow: "none" } }, busy ? "Parsing…" : W.go)),
        msg && h(Box, { component: "p", role: "status", sx: { fontSize: 13, color: "text.secondary", m: 0, mt: 1 } }, msg)));
  }
  // ── content spec (registry types), same layout as the static page ──
  const cardSx = { display: "block", textDecoration: "none", color: "inherit", borderRadius: "14px", bgcolor: "background.paper", transition: "border-color .15s, box-shadow .15s",
    "&:hover": { borderColor: "primary.main", textDecoration: "none" } };
  const T = (text, sx, props) => N("Typography", { ...(props || {}), sx }, [].concat(text));
  const title = (t) => T(t, { fontWeight: 600, fontSize: "1.02rem", lineHeight: 1.6, color: "text.primary" });
  const desc = (t) => T(t, { color: "text.secondary", fontSize: ".9rem", lineHeight: 1.6, mt: .5 });
  // a currency logo straight on the card (contained, no plate), in a 16:9 box
  const media = (img) => N("Box", { role: "img", "aria-label": img.alt, sx: { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", aspectRatio: "16 / 9", mb: 1.5 } },
    [N("Box", { component: "img", src: img.src, alt: "", sx: { display: "block", maxWidth: "62%", maxHeight: "72%", width: "auto", height: "auto", objectFit: "contain" } })]);
  // ids on the .GUI layout tree, GUI.window.layout.{bars.top, content}; no left / right bars. The topbar is the same LandingTopBar as every docs page.
  const L = "GUI.window.layout", LC = L + ".content", HERO = LC + ".hero";
  const walletSpec = () => N("Box", { "data-gui-node-id": L, sx: { minHeight: "100vh", bgcolor: "background.default", color: "text.primary", lineHeight: 1.6 } }, [
    N("LandingTopBar", { "data-gui-node-id": L + ".bars.top" }),
    N("Box", { component: "main", "data-gui-node-id": LC, sx: { display: "flex", justifyContent: "center", px: { xs: 2, sm: 3 }, pt: { xs: 7, sm: 14 }, pb: 10 } }, [
      N("Box", { component: "section", "data-gui-node-id": HERO, sx: { width: "100%", maxWidth: 640 } }, [
        N("Typography", { component: "h1", "data-gui-node-id": HERO + ".title", sx: { fontSize: "clamp(2.2rem, 6vw, 3.4rem)", lineHeight: 1.05, letterSpacing: "-.03em", fontWeight: 800, m: 0, mb: 1.5 } }, [page.h1]),
        page.lead && N("Typography", { component: "p", "data-gui-node-id": HERO + ".line", sx: { fontSize: "1rem", color: "text.secondary", m: 0, mb: 4 } }, [page.lead]),
        N("WalletEntry", { "data-gui-node-id": HERO + ".entry" }),
        page.note && T(page.note, { fontSize: ".8rem", color: "text.secondary", lineHeight: 1.6, mt: 1.75, mx: .25 }, { component: "p", "data-gui-node-id": HERO + ".note" }),
      ].filter(Boolean)),
    ]),
  ]);
  // the landing: a card per currency, same cards as neurons-me.github.io/smart-cities/ (logo variant of the 16:9 media box)
  const coinCard = (c, gid) => N("Card", { component: c.href ? "a" : "div", ...(c.href ? { href: c.href } : { "aria-disabled": "true" }), variant: "outlined", "data-gui-node-id": gid + "." + c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    sx: { ...cardSx, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", p: "12px 12px 16px", ...(c.href ? {} : { opacity: .55, "&:hover": { borderColor: "divider" } }) } }, [
    media({ logo: true, src: c.src, alt: c.name }), title(c.name), c.tag && T(c.tag, { fontSize: ".72rem", letterSpacing: ".06em", textTransform: "uppercase", color: "text.secondary", lineHeight: 1.6, mt: .25 }, { component: "span" })].filter(Boolean));
  const walletLandingSpec = () => N("Box", { "data-gui-node-id": L, sx: { minHeight: "100vh", bgcolor: "background.default", color: "text.primary", lineHeight: 1.6 } }, [
    N("LandingTopBar", { "data-gui-node-id": L + ".bars.top" }),
    N("Box", { component: "main", "data-gui-node-id": LC, sx: { display: "flex", justifyContent: "center", px: { xs: 2, sm: 3 }, pt: { xs: 5, sm: 9 }, pb: 10 } }, [
      N("Box", { component: "section", "data-gui-node-id": HERO, sx: { width: "100%", maxWidth: 760 } }, [
        N("Typography", { component: "h1", "data-gui-node-id": HERO + ".title", sx: { fontSize: "clamp(2.2rem, 6vw, 3.4rem)", lineHeight: 1.05, letterSpacing: "-.03em", fontWeight: 800, m: 0, mb: 3.5 } }, [page.h1]),
        ...page.groups.map((g) => { const gid = LC + "." + g.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          return N("Box", { component: "section", "data-gui-node-id": gid, sx: { mb: 4 } }, [
            T(g.label, { fontSize: ".78rem", textTransform: "uppercase", letterSpacing: ".08em", color: "text.secondary", m: 0, mb: 1.5 }, { component: "p" }),
            N("Box", { "data-gui-node-id": gid + ".cards", sx: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", alignItems: "stretch", [WIDE]: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } } }, g.coins.map((c) => coinCard(c, gid))),
          ]); }),
      ]),
    ]),
  ]);
  // a short page of cards (the PayPal integration page, its demos): h1, one line, then the cards
  const textCard = (c) => N("Card", { component: "a", href: c.href, variant: "outlined", "data-gui-node-id": LC + ".cards." + c.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    sx: { ...cardSx, p: "16px 20px" } }, [title(c.title), c.desc && desc(c.desc), c.tag && T(c.tag, { display: "block", fontSize: ".72rem", letterSpacing: ".06em", textTransform: "uppercase", color: "text.secondary", lineHeight: 1.6, mt: 1.25 }, { component: "span" })].filter(Boolean));
  const walletCardsSpec = () => N("Box", { "data-gui-node-id": L, sx: { minHeight: "100vh", bgcolor: "background.default", color: "text.primary", lineHeight: 1.6 } }, [
    N("LandingTopBar", { "data-gui-node-id": L + ".bars.top" }),
    N("Box", { component: "main", "data-gui-node-id": LC, sx: { display: "flex", justifyContent: "center", px: { xs: 2, sm: 3 }, pt: { xs: 5, sm: 9 }, pb: 10 } }, [
      N("Box", { component: "section", "data-gui-node-id": HERO, sx: { width: "100%", maxWidth: 760 } }, [
        N("Typography", { component: "h1", "data-gui-node-id": HERO + ".title", sx: { fontSize: "clamp(2.2rem, 6vw, 3.4rem)", lineHeight: 1.05, letterSpacing: "-.03em", fontWeight: 800, m: 0, mb: 1.5 } }, [page.h1]),
        page.lead && N("Typography", { component: "p", "data-gui-node-id": HERO + ".line", sx: { fontSize: "1rem", color: "text.secondary", m: 0, mb: 4 } }, [page.lead]),
        N("Box", { "data-gui-node-id": LC + ".cards", sx: { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "10px", alignItems: "stretch", [WIDE]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } } }, page.cards.map(textCard)),
      ].filter(Boolean)),
    ]),
  ]);
  const walletSplitSpec = () => N("Box", { "data-gui-node-id": L, sx: { minHeight: "100vh", bgcolor: "background.default", color: "text.primary", lineHeight: 1.6 } }, [
    N("LandingTopBar", { "data-gui-node-id": L + ".bars.top" }),
    N("Box", { component: "main", "data-gui-node-id": LC, sx: { display: "flex", justifyContent: "center", px: { xs: 2, sm: 3 }, pt: { xs: 5, sm: 9 }, pb: 10 } }, [
      N("Box", { component: "section", "data-gui-node-id": HERO, sx: { width: "100%", maxWidth: 640 } }, [
        N("Typography", { component: "h1", "data-gui-node-id": HERO + ".title", sx: { fontSize: "clamp(2.2rem, 6vw, 3.4rem)", lineHeight: 1.05, letterSpacing: "-.03em", fontWeight: 800, m: 0, mb: 1.5 } }, [page.h1]),
        page.lead && N("Typography", { component: "p", "data-gui-node-id": HERO + ".line", sx: { fontSize: "1rem", color: "text.secondary", m: 0, mb: 4 } }, [page.lead]),
        N("SplitApp", { "data-gui-node-id": LC + ".split" }),
        N("PlannedEntry", { "data-gui-node-id": LC + ".planned" }),
        page.note && T(page.note, { fontSize: ".8rem", color: "text.secondary", lineHeight: 1.6, mt: 1.75, mx: .25 }, { component: "p", "data-gui-node-id": HERO + ".note" }),
      ].filter(Boolean)),
    ]),
  ]);
  const spec = page.split ? walletSplitSpec() : page.groups ? walletLandingSpec() : page.cards ? walletCardsSpec() : walletSpec();

  // ── theme (page-scoped keys from window.__thisGuiThemeScope; neurons.me, dark by default) + mount ──
  const scope = window.__thisGuiThemeScope || {};
  let mode = "dark"; try { mode = params.get("mode") || localStorage.getItem(scope.themeModeKey) || "dark"; if (params.get("mode")) localStorage.setItem(scope.themeModeKey, mode); } catch (e) {}
  const PageTheme = ({ children }) => h(G.Theme, { initialThemeId: "neurons.me", initialMode: mode }, children);
  const INSPECTOR_ON = params.get("inspector") === "1";
  if (G.getInspectorEnabled() !== INSPECTOR_ON) G.setInspectorEnabled(INSPECTOR_ON);
  G.mount(spec, ROOT, {
    gui: { ...G, Theme: PageTheme, registry: { ...(G.Registry || G.registry), LandingTopBar, WalletEntry, SplitApp, PlannedEntry } },
    devtools: { enabled: true, inspector: INSPECTOR_ON, adminView: false, inspectorToggleVisible: false },
  });
  html.classList.add("gui-on");
  SRC.remove();
  }
})();
