/**
 * cite.js — click any element, describe the change, copy a bundle for a coding agent.
 *
 *   <script src="https://cite.brijr.dev/cite.js" data-project="abc123"></script>
 *
 * Local only. Annotations persist in localStorage. The script makes no network calls.
 */
(() => {
  if (window.__cite) return;
  window.__cite = true;

  const script = document.currentScript;
  const project = (script && script.dataset.project) || "local";
  const ROOT_ID = "cite-root";
  const storageKey = `cite:${project}:${location.origin}${location.pathname}`;

  const STYLE_KEYS = [
    "display",
    "position",
    "boxSizing",
    "width",
    "height",
    "minWidth",
    "minHeight",
    "maxWidth",
    "maxHeight",
    "margin",
    "padding",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "lineHeight",
    "letterSpacing",
    "textAlign",
    "textDecoration",
    "textTransform",
    "color",
    "backgroundColor",
    "backgroundImage",
    "border",
    "borderRadius",
    "boxShadow",
    "outline",
    "opacity",
    "overflow",
    "gap",
    "flexDirection",
    "flexWrap",
    "alignItems",
    "justifyContent",
    "flex",
    "gridTemplateColumns",
    "gridTemplateRows",
    "zIndex",
    "transform",
  ];

  const cssEscape =
    (window.CSS && CSS.escape) ||
    ((value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&"));

  function uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function collapse(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function truncate(value, max) {
    const text = String(value || "");
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
  }

  function isOurEvent(event) {
    const path = event.composedPath ? event.composedPath() : [];
    return path.some((node) => node && node.id === ROOT_ID);
  }

  function visibleText(el) {
    if (!el) return "";
    const labeled =
      el.getAttribute("aria-label") ||
      el.getAttribute("alt") ||
      el.getAttribute("title") ||
      el.getAttribute("placeholder") ||
      el.value;
    if (labeled) return collapse(labeled);
    return truncate(collapse(el.innerText || el.textContent || ""), 160);
  }

  function meaningfulClasses(el) {
    return [...el.classList].filter((name) => {
      if (!name) return false;
      if (/^(is-|has-|js-|css-)/.test(name)) return false;
      if (/^(sm|md|lg|xl|2xl|hover|focus|active|group|peer|dark):/.test(name)) return false;
      if (/^(css|sc|jsx)-[a-zA-Z0-9_-]{6,}$/.test(name)) return false;
      if (/_[a-zA-Z0-9]{5,}$/.test(name)) return false;
      return true;
    }).slice(0, 3);
  }

  function uniqueSelector(el) {
    if (!(el instanceof Element)) return "";

    if (el.id) {
      const idSel = `#${cssEscape(el.id)}`;
      try {
        if (document.querySelectorAll(idSel).length === 1) return idSel;
      } catch (_) {
        /* ignore invalid id */
      }
    }

    const testid = el.getAttribute("data-testid") || el.getAttribute("data-test");
    if (testid) {
      const attr = el.hasAttribute("data-testid") ? "data-testid" : "data-test";
      const sel = `[${attr}="${cssEscape(testid)}"]`;
      try {
        if (document.querySelectorAll(sel).length === 1) return sel;
      } catch (_) {
        /* ignore */
      }
    }

    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(`#${cssEscape(node.id)}`);
        break;
      }
      const classes = meaningfulClasses(node);
      if (classes.length) part += classes.map((name) => `.${cssEscape(name)}`).join("");
      const parent = node.parentElement;
      if (parent) {
        const typed = [...parent.children].filter((child) => child.tagName === node.tagName);
        if (typed.length > 1) {
          part += `:nth-of-type(${typed.indexOf(node) + 1})`;
        }
      }
      parts.unshift(part);
      node = node.parentElement;
    }

    const selector = parts.join(" > ");
    try {
      const matches = document.querySelectorAll(selector);
      if (matches.length === 1 && matches[0] === el) return selector;
    } catch (_) {
      /* fall through */
    }
    return selector;
  }

  function shortName(el) {
    const tag = el.tagName.toLowerCase();
    if (el.id) return `${tag}#${el.id}`;
    const classes = meaningfulClasses(el);
    if (classes.length) return `${tag}.${classes.join(".")}`;
    return tag;
  }

  function headingNear(el) {
    let node = el;
    while (node && node !== document.body) {
      const heading = node.querySelector && node.querySelector("h1, h2, h3");
      if (heading && heading !== el) {
        const text = collapse(heading.textContent || "");
        if (text) return truncate(text, 48);
      }
      const landmark =
        node.getAttribute &&
        (node.getAttribute("aria-label") || node.getAttribute("data-section"));
      if (landmark) return truncate(collapse(landmark), 48);
      node = node.parentElement;
    }
    return document.title || "Page";
  }

  function locationTrail(el) {
    const crumbs = [];
    let node = el;
    while (node && node !== document.body && crumbs.length < 4) {
      const heading = node.matches && node.matches("h1, h2, h3, h4")
        ? collapse(node.textContent || "")
        : "";
      const label =
        heading ||
        node.getAttribute("aria-label") ||
        node.getAttribute("data-section") ||
        (node.id ? `#${node.id}` : "") ||
        meaningfulClasses(node)[0] ||
        "";
      if (label) crumbs.unshift(truncate(collapse(label), 40));
      node = node.parentElement;
    }
    if (!crumbs.length) crumbs.push(headingNear(el));
    crumbs.push(shortName(el));
    return crumbs.join(" → ");
  }

  function computedStyles(el) {
    const computed = getComputedStyle(el);
    const styles = {};
    for (const key of STYLE_KEYS) {
      styles[key] = computed[key];
    }
    return styles;
  }

  function serializeHtml(el, max) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll("script, style, iframe, object, embed, link").forEach((node) => node.remove());
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
    const nodes = [clone];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      for (const attr of [...node.attributes]) {
        if (/^on/i.test(attr.name) || attr.name === "srcdoc") node.removeAttribute(attr.name);
      }
    }
    return truncate(clone.outerHTML.replace(/\s+/g, " ").trim(), max);
  }

  function nearbyContext(el) {
    const parent = el.parentElement;
    const prev = el.previousElementSibling;
    const next = el.nextElementSibling;
    return {
      parent: parent ? shortName(parent) : "",
      parentHtml: parent ? serializeHtml(parent, 900) : "",
      previous: prev ? `${shortName(prev)} ${JSON.stringify(visibleText(prev))}` : "",
      next: next ? `${shortName(next)} ${JSON.stringify(visibleText(next))}` : "",
    };
  }

  function captureTarget(el) {
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      name: shortName(el),
      id: el.id || "",
      classes: meaningfulClasses(el),
      role: el.getAttribute("role") || el.getAttribute("type") || "",
      text: visibleText(el),
      selector: uniqueSelector(el),
      trail: locationTrail(el),
      href: el.getAttribute("href") || "",
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      page: {
        x: Math.round(rect.left + window.scrollX),
        y: Math.round(rect.top + window.scrollY),
      },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scroll: { x: window.scrollX, y: window.scrollY },
      styles: computedStyles(el),
      html: serializeHtml(el, 1800),
      nearby: nearbyContext(el),
      url: location.href,
      path: location.pathname,
      title: document.title,
    };
  }

  function formatStyles(styles) {
    return Object.entries(styles)
      .map(([key, value]) => {
        const cssKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
        return `${cssKey}: ${value};`;
      })
      .join("\n");
  }

  function formatAnnotation(annotation, index) {
    const target = annotation.target;
    const n = index + 1;
    return [
      `## Annotation ${n}`,
      "",
      `Element: ${target.name}`,
      `Selector: ${target.selector}`,
      target.role ? `Role: ${target.role}` : null,
      target.text ? `Text: ${JSON.stringify(target.text)}` : null,
      `Location: ${target.trail}`,
      `Box: ${target.rect.width}×${target.rect.height} at ${target.rect.x},${target.rect.y} (viewport ${target.viewport.width}×${target.viewport.height})`,
      "",
      "Request:",
      annotation.request,
      "",
      "### HTML",
      "```html",
      target.html,
      "```",
      "",
      "### Computed CSS",
      "```css",
      formatStyles(target.styles),
      "```",
      "",
      "### Nearby DOM",
      target.nearby.parent ? `Parent: ${target.nearby.parent}` : null,
      target.nearby.previous ? `Previous: ${target.nearby.previous}` : null,
      target.nearby.next ? `Next: ${target.nearby.next}` : null,
      target.nearby.parentHtml
        ? ["", "```html", target.nearby.parentHtml, "```"].join("\n")
        : null,
    ]
      .filter((line) => line !== null)
      .join("\n");
  }

  function formatBundle(annotations) {
    if (!annotations.length) return "";
    const first = annotations[0].target;
    const header = [
      "The following are visual change requests captured from a web page.",
      "Apply each request to the matching element.",
      "Treat the selector, HTML, and computed CSS as ground truth for what is on the page now.",
      "",
      `Page: ${first.path}`,
      `Title: ${first.title}`,
      `URL: ${first.url}`,
      "",
      "",
    ];
    return `${header.join("\n")}${annotations.map(formatAnnotation).join("\n\n")}\n`;
  }

  function loadAnnotations() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function persistAnnotations(annotations) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(annotations));
    } catch (_) {
      /* private mode / quota */
    }
  }

  const STYLES = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    button, textarea { font: inherit; color: inherit; }
    button { appearance: none; background: none; border: 0; padding: 0; cursor: pointer; }
    .ui {
      position: fixed;
      inset: 0;
      pointer-events: none;
      color-scheme: dark;
      font-family: var(--font);
      color: var(--text);
      -webkit-font-smoothing: antialiased;
      --bg: oklch(0.18 0.012 260);
      --bg-raised: oklch(0.23 0.012 260);
      --bg-hover: oklch(0.28 0.012 260);
      --line: oklch(1 0 0 / 0.09);
      --text: oklch(0.96 0.008 260);
      --muted: oklch(0.74 0.014 260);
      --subtle: oklch(0.6 0.014 260);
      --accent: oklch(0.8 0.14 75);
      --accent-text: oklch(0.22 0.04 70);
      --danger: oklch(0.74 0.13 25);
      --radius: 12px;
      --control: 8px;
      --ease: cubic-bezier(0.23, 1, 0.32, 1);
      --font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    }
    .veil {
      position: fixed;
      inset: 0;
      z-index: 2;
      pointer-events: auto;
      cursor: crosshair;
      background: transparent;
    }
    .highlight {
      position: fixed;
      pointer-events: none;
      border: 1.5px solid var(--accent);
      background: oklch(0.8 0.14 75 / 0.12);
      border-radius: 2px;
      z-index: 3;
    }
    [hidden] { display: none !important; }
    .label {
      position: fixed;
      z-index: 4;
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: min(420px, calc(100vw - 24px));
      padding: 4px 8px;
      border-radius: 6px;
      background: var(--bg);
      box-shadow: 0 0 0 1px oklch(1 0 0 / 0.08);
      font-family: var(--mono);
      font-size: 11px;
      line-height: 1.3;
      letter-spacing: -0.01em;
      pointer-events: none;
      white-space: nowrap;
    }
    .label b { font-weight: 500; color: var(--accent); }
    .label span { color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
    .label i {
      font-style: normal;
      color: var(--subtle);
      font-variant-numeric: tabular-nums;
    }
    .marks { position: fixed; inset: 0; z-index: 5; pointer-events: none; }
    .mark {
      position: fixed;
      width: 20px;
      height: 20px;
      margin: -10px 0 0 -10px;
      border-radius: 999px;
      background: var(--accent);
      color: var(--accent-text);
      font-size: 11px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      line-height: 20px;
      text-align: center;
      pointer-events: auto;
      cursor: pointer;
      box-shadow: 0 0 0 2px oklch(0.18 0.012 260 / 0.7);
    }
    .mark:hover, .mark.is-active { background: oklch(0.88 0.13 85); }
    .toolbar {
      position: fixed;
      left: 50%;
      bottom: 16px;
      z-index: 7;
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 4px;
      border-radius: 999px;
      background: var(--bg);
      box-shadow:
        0 0 0 1px oklch(1 0 0 / 0.08),
        0 10px 30px oklch(0 0 0 / 0.28);
      pointer-events: auto;
      transform: translateX(-50%);
    }
    .toolbar button {
      height: 32px;
      padding: 0 12px;
      border-radius: 999px;
      font-size: 13px;
      line-height: 1;
      color: var(--muted);
      white-space: nowrap;
      transition: background-color 140ms ease, color 140ms ease, transform 140ms var(--ease);
    }
    .toolbar button:hover { background: var(--bg-hover); color: var(--text); }
    .toolbar button:active { transform: scale(0.97); }
    .toolbar button.is-on {
      background: var(--accent);
      color: var(--accent-text);
    }
    .toolbar button.is-on:hover { background: oklch(0.86 0.13 80); }
    .toolbar .primary {
      color: var(--text);
      font-weight: 500;
    }
    .toolbar .count {
      min-width: 32px;
      padding: 0 10px;
      font-variant-numeric: tabular-nums;
    }
    .toolbar .sep {
      width: 1px;
      height: 16px;
      margin: 0 4px;
      background: var(--line);
    }
    .hint {
      position: fixed;
      left: 50%;
      bottom: 60px;
      z-index: 7;
      transform: translateX(-50%);
      padding: 6px 10px;
      border-radius: 8px;
      background: var(--bg);
      box-shadow: 0 0 0 1px oklch(1 0 0 / 0.08);
      color: var(--muted);
      font-size: 12px;
      line-height: 1.3;
      pointer-events: none;
      white-space: nowrap;
    }
    .panel {
      position: fixed;
      top: 12px;
      right: 12px;
      bottom: 68px;
      z-index: 6;
      display: flex;
      flex-direction: column;
      width: 360px;
      max-width: calc(100vw - 24px);
      border-radius: var(--radius);
      background: var(--bg);
      box-shadow:
        0 0 0 1px oklch(1 0 0 / 0.08),
        0 16px 40px oklch(0 0 0 / 0.32);
      pointer-events: auto;
      overflow: hidden;
    }
    .panel-head, .panel-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
    }
    .panel-head {
      border-bottom: 1px solid var(--line);
    }
    .panel-foot {
      border-top: 1px solid var(--line);
    }
    .panel h2 {
      margin: 0;
      font-size: 13px;
      font-weight: 500;
      letter-spacing: -0.01em;
      text-wrap: balance;
    }
    .icon-btn {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      color: var(--muted);
      transition: background-color 140ms ease, color 140ms ease, transform 140ms var(--ease);
    }
    .icon-btn:hover { background: var(--bg-hover); color: var(--text); }
    .icon-btn:active { transform: scale(0.97); }
    .composer, .list, .empty {
      padding: 12px 14px;
    }
    .composer {
      display: flex;
      flex-direction: column;
      gap: 10px;
      border-bottom: 1px solid var(--line);
    }
    .chip {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .chip code {
      font-family: var(--mono);
      font-size: 11px;
      color: var(--accent);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chip small {
      color: var(--subtle);
      font-size: 12px;
      line-height: 1.4;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    textarea {
      width: 100%;
      min-height: 88px;
      resize: vertical;
      padding: 10px 10px;
      border: 0;
      border-radius: var(--control);
      background: var(--bg-raised);
      box-shadow: inset 0 0 0 1px var(--line);
      color: var(--text);
      font-size: 16px;
      line-height: 1.45;
      outline: none;
    }
    textarea:focus { box-shadow: inset 0 0 0 1px oklch(0.8 0.14 75 / 0.7); }
    textarea::placeholder { color: var(--subtle); }
    .row {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn {
      height: 32px;
      padding: 0 12px;
      border-radius: var(--control);
      font-size: 13px;
      line-height: 1;
      color: var(--muted);
      white-space: nowrap;
      transition: background-color 140ms ease, color 140ms ease, transform 140ms var(--ease);
    }
    .btn:hover { background: var(--bg-hover); color: var(--text); }
    .btn:active { transform: scale(0.97); }
    .btn-primary {
      background: var(--accent);
      color: var(--accent-text);
      font-weight: 500;
    }
    .btn-primary:hover { background: oklch(0.86 0.13 80); color: var(--accent-text); }
    .btn-primary:disabled {
      opacity: 0.45;
      cursor: default;
      transform: none;
    }
    .list {
      flex: 1;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
      padding: 10px;
      border-radius: var(--control);
      text-align: left;
      color: inherit;
      transition: background-color 140ms ease;
    }
    .item:hover, .item.is-active { background: var(--bg-raised); }
    .item-top {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }
    .item strong {
      font-size: 13px;
      font-weight: 500;
      line-height: 1.4;
      text-wrap: pretty;
    }
    .item code {
      font-family: var(--mono);
      font-size: 11px;
      color: var(--subtle);
    }
    .item-actions {
      display: flex;
      gap: 4px;
      margin-top: 4px;
    }
    .empty {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
      text-wrap: pretty;
    }
    .panel-foot .btn-primary { width: 100%; }
    .toast {
      position: fixed;
      left: 50%;
      bottom: 60px;
      z-index: 8;
      transform: translateX(-50%);
      padding: 7px 12px;
      border-radius: 8px;
      background: var(--bg);
      box-shadow: 0 0 0 1px oklch(1 0 0 / 0.08);
      font-size: 12px;
      color: var(--text);
      pointer-events: none;
    }
    @media (min-width: 640px) {
      textarea { font-size: 13px; }
    }
    @media (max-width: 520px) {
      .panel {
        top: auto;
        left: 8px;
        right: 8px;
        bottom: 64px;
        width: auto;
        height: min(58vh, 480px);
      }
      .hint { display: none; }
      .toolbar .wide-label { display: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .toolbar button, .btn, .icon-btn { transition: none; }
    }
  `;

  const state = {
    inspect: false,
    panel: false,
    draft: null,
    hovered: null,
    annotations: loadAnnotations(),
    activeId: null,
    toast: "",
    hint: !sessionStorage.getItem("cite-hint"),
  };

  let root;
  let shadow;
  let els = {};
  let toastTimer = 0;
  let copyTimer = 0;
  let raf = 0;

  function mount() {
    root = document.getElementById(ROOT_ID) || document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("data-cite-host", "");
    Object.assign(root.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      pointerEvents: "none",
    });
    document.documentElement.appendChild(root);
    shadow = root.shadowRoot || root.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="ui">
        <div class="veil" hidden></div>
        <div class="highlight" hidden></div>
        <div class="label" hidden></div>
        <div class="marks"></div>
        <div class="hint" hidden></div>
        <div class="toolbar" role="toolbar" aria-label="Cite">
          <button type="button" data-act="inspect" aria-pressed="false">Inspect</button>
          <span class="sep"></span>
          <button type="button" class="count" data-act="panel" aria-label="Open annotations">0</button>
          <span class="sep"></span>
          <button type="button" class="primary" data-act="copy">Copy <span class="wide-label">for agent</span></button>
        </div>
        <aside class="panel" hidden>
          <header class="panel-head">
            <h2>Annotations</h2>
            <button type="button" class="icon-btn" data-act="close" aria-label="Close">✕</button>
          </header>
          <form class="composer" hidden>
            <div class="chip">
              <code data-el="chipName"></code>
              <small data-el="chipText"></small>
            </div>
            <label class="sr-only" for="cite-request" hidden>Change request</label>
            <textarea id="cite-request" name="request" rows="4" placeholder="Make this button smaller and use the same radius as the cards."></textarea>
            <div class="row">
              <button type="button" class="btn" data-act="cancel">Cancel</button>
              <button type="submit" class="btn btn-primary" data-el="save">Save</button>
            </div>
          </form>
          <div class="list" data-el="list"></div>
          <div class="empty" data-el="empty" hidden></div>
          <footer class="panel-foot">
            <button type="button" class="btn btn-primary" data-act="copy">Copy for agent</button>
          </footer>
        </aside>
        <div class="toast" hidden></div>
      </div>
    `;
    els.veil = shadow.querySelector(".veil");
    els.highlight = shadow.querySelector(".highlight");
    els.label = shadow.querySelector(".label");
    els.marks = shadow.querySelector(".marks");
    els.hint = shadow.querySelector(".hint");
    els.toolbar = shadow.querySelector(".toolbar");
    els.inspect = shadow.querySelector('[data-act="inspect"]');
    els.count = shadow.querySelector(".count");
    els.panel = shadow.querySelector(".panel");
    els.composer = shadow.querySelector(".composer");
    els.chipName = shadow.querySelector('[data-el="chipName"]');
    els.chipText = shadow.querySelector('[data-el="chipText"]');
    els.textarea = shadow.querySelector("textarea");
    els.save = shadow.querySelector('[data-el="save"]');
    els.list = shadow.querySelector('[data-el="list"]');
    els.empty = shadow.querySelector('[data-el="empty"]');
    els.toast = shadow.querySelector(".toast");

    shadow.addEventListener("click", onUiClick);
    els.composer.addEventListener("submit", onSave);
    els.textarea.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        els.composer.requestSubmit();
      }
    });
    els.textarea.addEventListener("input", () => {
      els.save.disabled = !collapse(els.textarea.value);
    });
    els.veil.addEventListener("mousemove", onPointerMove);
    els.veil.addEventListener("click", (event) => {
      event.preventDefault();
      selectAt(event);
    });
  }

  function setCopyLabels(copied) {
    const toolbar = shadow.querySelector(".toolbar [data-act='copy']");
    const panel = shadow.querySelector(".panel-foot [data-act='copy']");
    if (toolbar) {
      toolbar.innerHTML = copied ? "Copied" : 'Copy <span class="wide-label">for agent</span>';
    }
    if (panel) panel.textContent = copied ? "Copied" : "Copy for agent";
  }

  function showToast(message) {
    state.toast = message;
    els.toast.hidden = false;
    els.toast.textContent = message;
    paintHint();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      state.toast = "";
      els.toast.hidden = true;
      paintHint();
    }, 1800);
  }

  function setInspect(next) {
    state.inspect = next;
    state.hovered = next ? state.hovered : null;
    document.documentElement.style.cursor = next ? "crosshair" : "";
    els.inspect.classList.toggle("is-on", next);
    els.inspect.setAttribute("aria-pressed", String(next));
    els.veil.hidden = !next;
    if (!next) paintHighlight(null);
  }

  function setPanel(next) {
    state.panel = next;
    els.panel.hidden = !next;
    if (!next) {
      state.draft = null;
      els.composer.hidden = true;
    }
  }

  function paintHighlight(el) {
    if (!el) {
      els.highlight.hidden = true;
      els.label.hidden = true;
      return;
    }
    const rect = el.getBoundingClientRect();
    Object.assign(els.highlight.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${Math.max(rect.width, 1)}px`,
      height: `${Math.max(rect.height, 1)}px`,
    });
    els.highlight.hidden = false;

    const name = shortName(el);
    const size = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
    const text = visibleText(el);
    els.label.innerHTML = `<b>${escapeHtml(name)}</b>${
      text ? `<span>${escapeHtml(truncate(text, 42))}</span>` : ""
    }<i>${size}</i>`;
    const labelTop = rect.top >= 32 ? rect.top - 28 : rect.bottom + 6;
    const labelLeft = Math.min(Math.max(8, rect.left), window.innerWidth - 240);
    Object.assign(els.label.style, {
      left: `${labelLeft}px`,
      top: `${labelTop}px`,
    });
    els.label.hidden = false;
  }

  function targetRect(annotation) {
    try {
      const el = document.querySelector(annotation.target.selector);
      if (el && el.isConnected) return el.getBoundingClientRect();
    } catch (_) {
      /* stale selector */
    }
    const { page, rect } = annotation.target;
    return {
      left: (page?.x ?? rect.x) - window.scrollX,
      top: (page?.y ?? rect.y) - window.scrollY,
      width: rect.width,
      height: rect.height,
      right: 0,
      bottom: 0,
    };
  }

  function paintMarks() {
    els.marks.innerHTML = state.annotations
      .map((annotation, index) => {
        const rect = targetRect(annotation);
        const x = rect.left + rect.width - 2;
        const y = rect.top + 2;
        if (y < -20 || y > window.innerHeight + 20) return "";
        const active = annotation.id === state.activeId ? " is-active" : "";
        return `<button type="button" class="mark${active}" data-act="focus" data-id="${annotation.id}" style="left:${x}px;top:${y}px" aria-label="Annotation ${index + 1}">${index + 1}</button>`;
      })
      .join("");
  }

  function paintList() {
    const items = state.annotations;
    els.count.textContent = String(items.length);
    if (!items.length) {
      els.list.innerHTML = "";
      els.empty.hidden = Boolean(state.draft);
      els.empty.textContent = "Click Inspect, then click anything on the page.";
      return;
    }
    els.empty.hidden = true;
    els.list.innerHTML = items
      .map((annotation, index) => {
        const active = annotation.id === state.activeId ? " is-active" : "";
        return `
          <div class="item${active}" data-id="${annotation.id}">
            <div class="item-top">
              <strong>${index + 1}. ${escapeHtml(truncate(annotation.request, 90))}</strong>
            </div>
            <code>${escapeHtml(annotation.target.name)}</code>
            <div class="item-actions">
              <button type="button" class="btn" data-act="copy-one" data-id="${annotation.id}">Copy</button>
              <button type="button" class="btn" data-act="delete" data-id="${annotation.id}">Delete</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function paintComposer() {
    if (!state.draft) {
      els.composer.hidden = true;
      return;
    }
    els.composer.hidden = false;
    els.chipName.textContent = state.draft.target.name;
    els.chipText.textContent = state.draft.target.text
      ? `“${state.draft.target.text}”`
      : state.draft.target.trail;
    els.save.disabled = !collapse(els.textarea.value);
  }

  function paintHint() {
    if (state.toast) {
      els.hint.hidden = true;
      return;
    }
    if (state.inspect && !state.annotations.length) {
      els.hint.hidden = false;
      els.hint.textContent = "Click an element on the page";
      return;
    }
    const showIntro = state.hint && !state.annotations.length && !state.panel;
    els.hint.hidden = !showIntro;
    els.hint.textContent = "Click anything. Describe the change. Copy for an agent.";
  }

  function sync() {
    paintMarks();
    paintList();
    paintComposer();
    paintHint();
    const locked = state.draft
      ? (() => {
          try {
            return document.querySelector(state.draft.target.selector);
          } catch (_) {
            return null;
          }
        })()
      : state.inspect
        ? state.hovered
        : null;
    paintHighlight(locked);
  }

  function dismissHint() {
    if (!state.hint) return;
    state.hint = false;
    try {
      sessionStorage.setItem("cite-hint", "1");
    } catch (_) {
      /* ignore */
    }
    paintHint();
  }

  async function copyText(text) {
    if (!text) {
      showToast("Nothing to copy yet");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.style.position = "fixed";
      helper.style.left = "-9999px";
      document.body.appendChild(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
    }
    setCopyLabels(true);
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => setCopyLabels(false), 1400);
    showToast("Copied — paste into Claude, Cursor, or Codex");
  }

  function onUiClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const act = button.dataset.act;
    if (act === "inspect") {
      dismissHint();
      setInspect(!state.inspect);
      if (!state.inspect && !state.annotations.length && !state.draft) setPanel(false);
      sync();
      return;
    }
    if (act === "panel") {
      setPanel(!state.panel);
      sync();
      return;
    }
    if (act === "close") {
      setPanel(false);
      setInspect(false);
      sync();
      return;
    }
    if (act === "cancel") {
      state.draft = null;
      els.textarea.value = "";
      setInspect(true);
      sync();
      return;
    }
    if (act === "copy") {
      copyText(formatBundle(state.annotations));
      return;
    }
    if (act === "copy-one") {
      const annotation = state.annotations.find((item) => item.id === button.dataset.id);
      if (annotation) copyText(formatBundle([annotation]));
      return;
    }
    if (act === "delete") {
      state.annotations = state.annotations.filter((item) => item.id !== button.dataset.id);
      if (state.activeId === button.dataset.id) state.activeId = null;
      persistAnnotations(state.annotations);
      sync();
      return;
    }
    if (act === "focus") {
      state.activeId = button.dataset.id;
      setPanel(true);
      setInspect(false);
      const annotation = state.annotations.find((item) => item.id === button.dataset.id);
      if (annotation) {
        try {
          document.querySelector(annotation.target.selector)?.scrollIntoView({
            block: "center",
            behavior: "smooth",
          });
        } catch (_) {
          /* ignore */
        }
      }
      sync();
    }
  }

  function onSave(event) {
    event.preventDefault();
    if (!state.draft) return;
    const request = collapse(els.textarea.value);
    if (!request) return;
    state.annotations.push({
      id: uid(),
      createdAt: new Date().toISOString(),
      request,
      target: state.draft.target,
    });
    persistAnnotations(state.annotations);
    state.draft = null;
    state.activeId = state.annotations[state.annotations.length - 1].id;
    els.textarea.value = "";
    setInspect(true);
    showToast("Saved");
    sync();
  }

  function elementFromPoint(event) {
    const previous = els.veil.style.pointerEvents;
    els.veil.style.pointerEvents = "none";
    const stack = document.elementsFromPoint(event.clientX, event.clientY);
    els.veil.style.pointerEvents = previous;
    return (
      stack.find((node) => {
        if (!(node instanceof Element)) return false;
        if (node === root || shadow.contains(node)) return false;
        if (node === document.documentElement || node === document.body) return false;
        return true;
      }) || null
    );
  }

  function onPointerMove(event) {
    if (!state.inspect) return;
    if (event.target !== els.veil && isOurEvent(event)) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      state.hovered = elementFromPoint(event);
      paintHighlight(state.hovered);
    });
  }

  function selectAt(event) {
    const el = elementFromPoint(event);
    if (!el) return;
    dismissHint();
    state.draft = { target: captureTarget(el) };
    state.hovered = el;
    els.textarea.value = "";
    setPanel(true);
    setInspect(false);
    sync();
    els.textarea.focus();
  }

  function onPointerDown(event) {
    if (!state.inspect || isOurEvent(event)) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function onClick(event) {
    if (!state.inspect || isOurEvent(event)) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    selectAt(event);
  }

  function onKey(event) {
    if (event.key === "Escape") {
      if (state.draft) {
        state.draft = null;
        els.textarea.value = "";
        setInspect(true);
        sync();
        return;
      }
      if (state.inspect) {
        setInspect(false);
        sync();
        return;
      }
      if (state.panel) {
        setPanel(false);
        sync();
      }
      return;
    }
    const typing =
      event.target instanceof HTMLElement &&
      (event.target.isContentEditable ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) ||
        (event.composedPath &&
          event.composedPath().some((node) => node === els.textarea)));
    if (typing) return;
    if (event.altKey && (event.key === "a" || event.key === "A")) {
      event.preventDefault();
      dismissHint();
      setInspect(!state.inspect);
      if (!state.inspect && !state.annotations.length && !state.draft) setPanel(false);
      sync();
    }
  }

  function onLayout() {
    sync();
  }

  mount();
  document.addEventListener("mousemove", onPointerMove, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("scroll", onLayout, true);
  window.addEventListener("resize", onLayout);
  sync();
})();
