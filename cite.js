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
  const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
  const KEY_INSPECT = IS_MAC ? "⌘⇧ F" : "Ctrl+Shift+F";
  const KEY_COPY = "C";
  const KEY_SAVE = IS_MAC ? "⌘↵" : "Ctrl+Enter";
  const CAPTURE_VERSION = 2;
  const TEXT_LIMIT = 160;
  const TITLE_LIMIT = 120;
  const HTML_LIMIT = 1200;
  const ATTRIBUTE_LIMIT = 200;
  const TARGET_SEL = [
    "a[href]",
    "button",
    "input",
    "textarea",
    "select",
    "summary",
    '[role="button"]',
    '[role="link"]',
    "h1",
    "h2",
    "h3",
    "h4",
    "img",
    "label",
    "li",
    "p",
    "article",
    "section",
    "aside",
    "[data-testid]",
    "[data-test]",
  ].join(",");
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "LINK", "META", "HEAD", "BR", "WBR"]);

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
  const BASE_STYLE_KEYS = [
    "display",
    "position",
    "boxSizing",
    "width",
    "height",
    "margin",
    "padding",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "textAlign",
    "color",
    "backgroundColor",
    "border",
    "borderRadius",
  ];
  const CONDITIONAL_STYLE_KEYS = [
    "minWidth",
    "minHeight",
    "maxWidth",
    "maxHeight",
    "fontStyle",
    "letterSpacing",
    "textDecoration",
    "textTransform",
    "backgroundImage",
    "boxShadow",
    "outline",
    "opacity",
    "overflow",
    "gap",
    "flex",
    "zIndex",
    "transform",
  ];
  const FLEX_STYLE_KEYS = [
    "gap",
    "flexDirection",
    "flexWrap",
    "alignItems",
    "justifyContent",
  ];
  const GRID_STYLE_KEYS = [
    "gap",
    "alignItems",
    "justifyContent",
    "gridTemplateColumns",
    "gridTemplateRows",
  ];
  const SENSITIVE_ATTRIBUTE = /(?:^|[-_:])(?:auth(?:orization)?|cookie|credential|nonce|pass(?:word|wd)?|secret|session|token|api[-_]?key)(?:$|[-_:])/i;
  const URL_ATTRIBUTES = new Set([
    "action",
    "background",
    "cite",
    "classid",
    "codebase",
    "dynsrc",
    "formaction",
    "href",
    "itemid",
    "longdesc",
    "lowsrc",
    "manifest",
    "poster",
    "profile",
    "src",
    "usemap",
  ]);
  const URL_LIST_ATTRIBUTES = new Set(["archive", "attributionsrc", "itemtype", "ping"]);
  const URL_CANDIDATE_ATTRIBUTES = new Set(["imagesrcset", "srcset"]);
  const URL_FUNCTION_ATTRIBUTES = new Set([
    "clip-path",
    "color-profile",
    "cursor",
    "fill",
    "filter",
    "marker",
    "marker-end",
    "marker-mid",
    "marker-start",
    "mask",
    "stroke",
  ]);
  const HTML_CONTEXT_ATTRIBUTES = new Set([
    "aria-label",
    "class",
    "data-test",
    "data-testid",
    "id",
    "name",
    "role",
    "type",
  ]);

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

  function safeText(value, max = TEXT_LIMIT) {
    return truncate(collapse(value), max);
  }

  function stripUrlDetails(value) {
    const text = collapse(value);
    if (!text) return "";
    if (/^(?:blob|data|javascript):/i.test(text)) return "[redacted]";
    try {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(text)) {
        const parsed = new URL(text, location.href);
        parsed.username = "";
        parsed.password = "";
        parsed.search = "";
        parsed.hash = "";
        return truncate(parsed.href, ATTRIBUTE_LIMIT);
      }
    } catch (_) {
      /* fall through to a conservative string cleanup */
    }
    return truncate(text.replace(/[?#].*$/, ""), ATTRIBUTE_LIMIT);
  }

  function sanitizeUrlList(value, allowPropertyNames = false) {
    const tokens = collapse(value).split(/\s+/).filter(Boolean);
    const sanitized = tokens.map((token) => {
      const isUrl =
        /^(?:[a-z][a-z\d+.-]*:|\/\/|\/|\.\.?(?:\/|$)|[?#])/i.test(token) ||
        /[?#]/.test(token);
      return allowPropertyNames && !isUrl
        ? truncate(token, ATTRIBUTE_LIMIT)
        : stripUrlDetails(token);
    });
    return truncate(sanitized.join(" "), ATTRIBUTE_LIMIT);
  }

  function sanitizeUrlFunctions(value) {
    return String(value).replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (_match, _quote, url) => {
      return `url("${stripUrlDetails(url)}")`;
    });
  }

  function safePageUrl(value) {
    try {
      const parsed = new URL(value || location.href, location.href);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return truncate(`${parsed.origin}${parsed.pathname}`, 400);
      }
      return truncate(parsed.pathname || parsed.protocol, 400);
    } catch (_) {
      return truncate(collapse(value).replace(/[?#].*$/, ""), 400);
    }
  }

  function safePath(value) {
    return truncate(collapse(value || location.pathname).replace(/[?#].*$/, ""), 300);
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
      el.getAttribute("placeholder");
    if (labeled) return safeText(labeled);

    const tag = el.tagName.toLowerCase();
    if (tag === "input") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      return ["button", "reset", "submit"].includes(type) ? safeText(el.value) : "";
    }
    if (tag === "select" || tag === "textarea") return "";
    return safeText(el.innerText || el.textContent || "");
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
      styles[key] = sanitizeStyleValue(key, computed[key]);
    }
    return styles;
  }

  function sanitizeStyleValue(key, value) {
    let text = collapse(value);
    if (!text) return "";
    if (key === "backgroundImage" || /url\(/i.test(text)) {
      text = sanitizeUrlFunctions(text);
    }
    return truncate(text, ATTRIBUTE_LIMIT);
  }

  function sanitizeHtmlTree(root) {
    root.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((node) => node.remove());
    const nodes = root.nodeType === 1 ? [root, ...root.querySelectorAll("*")] : [...root.querySelectorAll("*")];
    for (const node of nodes) {
      const tag = node.tagName.toLowerCase();
      if (tag === "textarea") node.textContent = "";
      if (["button", "input", "option", "select", "textarea"].includes(tag)) {
        node.removeAttribute("value");
        node.removeAttribute("selected");
      }
      for (const attr of [...node.attributes]) {
        const qualifiedName = attr.name.toLowerCase();
        const name = (attr.localName || attr.name).toLowerCase();
        if (
          /^on/i.test(name) ||
          name === "srcdoc" ||
          name === "style" ||
          URL_CANDIDATE_ATTRIBUTES.has(name) ||
          SENSITIVE_ATTRIBUTE.test(qualifiedName)
        ) {
          node.removeAttribute(attr.name);
          continue;
        }
        if (URL_LIST_ATTRIBUTES.has(name)) {
          attr.value = sanitizeUrlList(attr.value);
          continue;
        }
        if (name === "itemprop") {
          attr.value = sanitizeUrlList(attr.value, true);
          continue;
        }
        if (URL_ATTRIBUTES.has(name) || (tag === "object" && name === "data")) {
          attr.value = stripUrlDetails(attr.value);
          continue;
        }
        if (URL_FUNCTION_ATTRIBUTES.has(name)) {
          if (attr.value.includes("\\")) {
            node.removeAttribute(attr.name);
          } else if (/url\(/i.test(attr.value)) {
            attr.value = truncate(sanitizeUrlFunctions(attr.value), ATTRIBUTE_LIMIT);
          } else {
            attr.value = truncate(attr.value, ATTRIBUTE_LIMIT);
          }
          continue;
        }
        if (/url\(/i.test(attr.value)) {
          attr.value = truncate(sanitizeUrlFunctions(attr.value), ATTRIBUTE_LIMIT);
          continue;
        }
        attr.value = truncate(attr.value, ATTRIBUTE_LIMIT);
      }
    }
    return root;
  }

  function compactSerializedHtml(root) {
    return root.outerHTML.replace(/\s+/g, " ").trim();
  }

  function trimAttributesToFit(treeRoot, element, max) {
    if (compactSerializedHtml(treeRoot).length <= max) return true;
    const attributes = [...element.attributes].sort((a, b) => {
      const aPriority = HTML_CONTEXT_ATTRIBUTES.has((a.localName || a.name).toLowerCase()) ? 1 : 0;
      const bPriority = HTML_CONTEXT_ATTRIBUTES.has((b.localName || b.name).toLowerCase()) ? 1 : 0;
      return aPriority - bPriority;
    });
    for (const attr of attributes) {
      element.removeAttribute(attr.name);
      if (compactSerializedHtml(treeRoot).length <= max) return true;
    }
    return compactSerializedHtml(treeRoot).length <= max;
  }

  function appendHtmlPrefix(sourceParent, targetParent, treeRoot, max) {
    for (const sourceNode of sourceParent.childNodes) {
      if (sourceNode.nodeType === Node.TEXT_NODE) {
        const text = document.createTextNode(sourceNode.data);
        targetParent.appendChild(text);
        if (compactSerializedHtml(treeRoot).length <= max) continue;

        let low = 0;
        let high = sourceNode.data.length;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          text.data = sourceNode.data.slice(0, middle);
          if (compactSerializedHtml(treeRoot).length <= max) low = middle;
          else high = middle - 1;
        }
        text.data = sourceNode.data.slice(0, low);
        if (low < sourceNode.data.length) {
          let prefixLength = low;
          text.data = `${sourceNode.data.slice(0, prefixLength)}…`;
          while (compactSerializedHtml(treeRoot).length > max && prefixLength > 0) {
            prefixLength -= 1;
            text.data = `${sourceNode.data.slice(0, prefixLength)}…`;
          }
          if (compactSerializedHtml(treeRoot).length > max) text.data = "";
        }
        if (!text.data) text.remove();
        return false;
      }

      if (sourceNode.nodeType !== Node.ELEMENT_NODE) continue;
      const element = sourceNode.cloneNode(false);
      targetParent.appendChild(element);
      if (!trimAttributesToFit(treeRoot, element, max)) {
        element.remove();
        return false;
      }
      if (!appendHtmlPrefix(sourceNode, element, treeRoot, max)) return false;
    }
    return true;
  }

  function serializeSanitizedHtml(root, max) {
    const bounded = root.cloneNode(false);
    if (!trimAttributesToFit(bounded, bounded, max)) return "";
    appendHtmlPrefix(root, bounded, bounded, max);
    return compactSerializedHtml(bounded);
  }

  function serializeHtml(el, max) {
    const clone = el.cloneNode(true);
    sanitizeHtmlTree(clone);
    return serializeSanitizedHtml(clone, max);
  }

  function sanitizeStoredHtml(html) {
    if (!html) return "";
    const template = document.createElement("template");
    template.innerHTML = String(html);
    const target = template.content.firstElementChild;
    if (!target || ["script", "style", "link", "meta"].includes(target.tagName.toLowerCase())) {
      return "";
    }
    sanitizeHtmlTree(target);
    return serializeSanitizedHtml(target, HTML_LIMIT);
  }

  function nearbyLabel(el) {
    if (!el) return "";
    const text = visibleText(el);
    return safeText(`${shortName(el)}${text ? ` ${JSON.stringify(text)}` : ""}`, 240);
  }

  function nearbyContext(el) {
    const parent = el.parentElement;
    const prev = el.previousElementSibling;
    const next = el.nextElementSibling;
    return {
      parent: parent ? safeText(shortName(parent), 120) : "",
      previous: nearbyLabel(prev),
      next: nearbyLabel(next),
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
      styles: computedStyles(el),
      html: serializeHtml(el, HTML_LIMIT),
      nearby: nearbyContext(el),
      url: safePageUrl(location.href),
      path: safePath(location.pathname),
      title: safeText(document.title, TITLE_LIMIT),
    };
  }

  function isNeutralStyle(key, value) {
    if (!value) return true;
    const exact = {
      backgroundImage: "none",
      boxShadow: "none",
      flex: "0 1 auto",
      fontStyle: "normal",
      gap: "normal",
      letterSpacing: "normal",
      maxHeight: "none",
      maxWidth: "none",
      minHeight: "0px",
      minWidth: "0px",
      opacity: "1",
      overflow: "visible",
      textDecoration: "none",
      textTransform: "none",
      transform: "none",
      zIndex: "auto",
    };
    if (key === "outline") return value === "none" || /\bnone\b/.test(value);
    return exact[key] === value;
  }

  function relevantStyleEntries(styles) {
    const keys = new Set(BASE_STYLE_KEYS);
    for (const key of CONDITIONAL_STYLE_KEYS) {
      if (!isNeutralStyle(key, styles[key])) keys.add(key);
    }
    const display = styles.display || "";
    if (display.includes("flex")) FLEX_STYLE_KEYS.forEach((key) => keys.add(key));
    if (display.includes("grid")) GRID_STYLE_KEYS.forEach((key) => keys.add(key));
    return [...keys]
      .filter((key) => styles[key])
      .map((key) => [key, styles[key]]);
  }

  function formatStyles(styles) {
    return relevantStyleEntries(styles)
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
      "### Relevant CSS",
      "```css",
      formatStyles(target.styles),
      "```",
      "",
      "### Nearby elements",
      target.nearby.parent ? `Parent: ${target.nearby.parent}` : null,
      target.nearby.previous ? `Previous: ${target.nearby.previous}` : null,
      target.nearby.next ? `Next: ${target.nearby.next}` : null,
    ]
      .filter((line) => line !== null)
      .join("\n");
  }

  function formatBundle(annotations) {
    const safeAnnotations = annotations.map((annotation) => normalizeAnnotation(annotation)).filter(Boolean);
    if (!safeAnnotations.length) return "";
    const first = safeAnnotations[0].target;
    const header = [
      "The following are visual change requests captured from a web page.",
      "Apply each request to the matching element.",
      "The selector and rendered context describe the page at the captured viewport.",
      "",
      `Page: ${first.path}`,
      `Title: ${first.title}`,
      `URL: ${first.url}`,
      "",
      "",
    ];
    return `${header.join("\n")}${safeAnnotations.map(formatAnnotation).join("\n\n")}\n`;
  }

  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : 0;
  }

  function normalizeStyles(styles) {
    const normalized = {};
    for (const key of STYLE_KEYS) {
      if (styles && styles[key] != null) normalized[key] = sanitizeStyleValue(key, styles[key]);
    }
    return normalized;
  }

  function normalizeTarget(target, { dropNearbySiblings = false } = {}) {
    if (!target || typeof target !== "object") return null;
    const tag = safeText(target.tag, 32).toLowerCase();
    const role = safeText(target.role, 64).toLowerCase();
    const formValue = tag === "textarea" || tag === "select" || (tag === "input" && !["button", "reset", "submit"].includes(role));
    const nearby = target.nearby && typeof target.nearby === "object" ? target.nearby : {};
    const rect = target.rect && typeof target.rect === "object" ? target.rect : {};
    const page = target.page && typeof target.page === "object" ? target.page : null;
    const viewport = target.viewport && typeof target.viewport === "object" ? target.viewport : {};
    return {
      tag,
      name: safeText(target.name || tag || "element", 240),
      id: safeText(target.id, 160),
      classes: Array.isArray(target.classes)
        ? target.classes.slice(0, 3).map((name) => safeText(name, 120))
        : [],
      role,
      text: formValue ? "" : safeText(target.text),
      selector: String(target.selector || "").trim(),
      trail: safeText(target.trail, 240),
      rect: {
        x: safeNumber(rect.x),
        y: safeNumber(rect.y),
        width: safeNumber(rect.width),
        height: safeNumber(rect.height),
      },
      page: page
        ? {
            x: safeNumber(page.x),
            y: safeNumber(page.y),
          }
        : null,
      viewport: {
        width: safeNumber(viewport.width),
        height: safeNumber(viewport.height),
      },
      styles: normalizeStyles(target.styles),
      html: sanitizeStoredHtml(target.html),
      nearby: {
        parent: safeText(nearby.parent, 120),
        previous: dropNearbySiblings ? "" : safeText(nearby.previous, 240),
        next: dropNearbySiblings ? "" : safeText(nearby.next, 240),
      },
      url: safePageUrl(target.url),
      path: safePath(target.path),
      title: safeText(target.title, TITLE_LIMIT),
    };
  }

  function normalizeAnnotation(annotation, { migrateLegacy = false } = {}) {
    if (!annotation || typeof annotation !== "object") return null;
    const target = normalizeTarget(annotation.target, {
      dropNearbySiblings: migrateLegacy && Number(annotation.captureVersion) !== CAPTURE_VERSION,
    });
    const request = collapse(annotation.request);
    if (!target || !request) return null;
    return {
      id: safeText(annotation.id || uid(), 200),
      createdAt: safeText(annotation.createdAt, 80),
      captureVersion: CAPTURE_VERSION,
      request,
      target,
    };
  }

  function loadAnnotations() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const normalized = parsed
        .map((annotation) => normalizeAnnotation(annotation, { migrateLegacy: true }))
        .filter(Boolean);
      const next = JSON.stringify(normalized);
      if (next !== raw) {
        try {
          localStorage.setItem(storageKey, next);
        } catch (_) {
          /* migration persistence is best-effort */
        }
      }
      return normalized;
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
    .dock {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 7;
      pointer-events: auto;
    }
    .fab {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 999px;
      background: var(--bg);
      color: var(--text);
      font-family: var(--mono);
      font-size: 14px;
      font-weight: 500;
      font-variant-ligatures: none;
      letter-spacing: -0.04em;
      line-height: 1;
      box-shadow:
        0 0 0 1px oklch(1 0 0 / 0.08),
        0 10px 30px oklch(0 0 0 / 0.28);
      transition: background-color 140ms ease, transform 140ms var(--ease);
    }
    .fab:hover { background: var(--bg-hover); }
    .fab:active { transform: scale(0.97); }
    .fab-count {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 999px;
      background: var(--accent);
      color: var(--accent-text);
      font-size: 10px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      line-height: 16px;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 4px;
      border-radius: 999px;
      background: var(--bg);
      box-shadow:
        0 0 0 1px oklch(1 0 0 / 0.08),
        0 10px 30px oklch(0 0 0 / 0.28);
    }
    .dock:not(.is-open) .toolbar { display: none; }
    .dock.is-open .fab { display: none; }
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
    kbd {
      font: inherit;
      color: var(--subtle);
      margin-left: 8px;
      letter-spacing: 0.06em;
    }
    .toolbar button:hover { background: var(--bg-hover); color: var(--text); }
    .toolbar button:active { transform: scale(0.97); }
    .toolbar button.is-on {
      background: var(--accent);
      color: var(--accent-text);
    }
    .toolbar button.is-on kbd {
      color: var(--accent-text);
      background: oklch(0.22 0.04 75 / 0.1);
      padding: 3px 6px;
      border-radius: 5px;
      letter-spacing: 0.08em;
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
      right: 16px;
      bottom: 64px;
      z-index: 7;
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
    .help {
      position: fixed;
      right: 16px;
      bottom: 64px;
      z-index: 8;
      width: min(340px, calc(100vw - 24px));
      padding: 12px 14px;
      border-radius: var(--radius);
      background: var(--bg);
      box-shadow:
        0 0 0 1px oklch(1 0 0 / 0.08),
        0 16px 40px oklch(0 0 0 / 0.32);
      pointer-events: auto;
      font-size: 12px;
      line-height: 1.45;
    }
    .help h3 {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .help dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 3px 16px;
      margin: 0;
    }
    .help dt {
      color: var(--accent);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .help dd {
      margin: 0;
      color: var(--muted);
    }
    .composer-keys {
      margin-right: auto;
      color: var(--subtle);
      font-size: 11px;
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
      right: 16px;
      bottom: 64px;
      z-index: 8;
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
      .toolbar kbd, .composer-keys { display: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .toolbar button, .btn, .icon-btn, .fab { transition: none; }
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
    help: false,
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
        <div class="dock">
          <button type="button" class="fab" data-act="open" aria-label="Open Cite" aria-keyshortcuts="Control+Shift+F Meta+Shift+F">=><span class="fab-count" hidden>0</span></button>
          <div class="toolbar" role="toolbar" aria-label="Cite">
            <button type="button" data-act="inspect" aria-pressed="false" aria-keyshortcuts="Control+Shift+F Meta+Shift+F">Feedback <kbd></kbd></button>
            <span class="sep"></span>
            <button type="button" class="count" data-act="panel" aria-label="Open annotations">0</button>
            <span class="sep"></span>
            <button type="button" class="primary" data-act="copy" aria-keyshortcuts="c">Copy Feedback <kbd></kbd></button>
          </div>
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
              <span class="composer-keys"></span>
              <button type="button" class="btn" data-act="cancel">Cancel</button>
              <button type="submit" class="btn btn-primary" data-el="save">Save</button>
            </div>
          </form>
          <div class="list" data-el="list"></div>
          <div class="empty" data-el="empty" hidden></div>
          <footer class="panel-foot">
            <button type="button" class="btn btn-primary" data-act="copy">Copy Feedback</button>
          </footer>
        </aside>
        <div class="help" hidden></div>
        <div class="toast" hidden></div>
      </div>
    `;
    els.veil = shadow.querySelector(".veil");
    els.highlight = shadow.querySelector(".highlight");
    els.label = shadow.querySelector(".label");
    els.marks = shadow.querySelector(".marks");
    els.hint = shadow.querySelector(".hint");
    els.dock = shadow.querySelector(".dock");
    els.fab = shadow.querySelector(".fab");
    els.fabCount = shadow.querySelector(".fab-count");
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
    els.help = shadow.querySelector(".help");
    els.toast = shadow.querySelector(".toast");
    els.inspectKbd = els.inspect.querySelector("kbd");
    els.copyKbd = shadow.querySelector(".toolbar [data-act='copy'] kbd");
    els.composerKeys = shadow.querySelector(".composer-keys");
    if (els.inspectKbd) els.inspectKbd.textContent = KEY_INSPECT;
    if (els.copyKbd) els.copyKbd.textContent = KEY_COPY;
    if (els.composerKeys) els.composerKeys.textContent = `${KEY_SAVE} save · Esc cancel`;

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
      toolbar.innerHTML = copied
        ? "Copied"
        : `Copy Feedback <kbd>${KEY_COPY}</kbd>`;
    }
    if (panel) panel.textContent = copied ? "Copied" : "Copy Feedback";
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
    if (next) ensureHover();
    else paintHighlight(null);
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
      els.empty.textContent = `Press ${KEY_INSPECT}, then cite anything on the page.`;
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
    if (state.toast || state.help) {
      els.hint.hidden = true;
      return;
    }
    if (state.inspect) {
      els.hint.hidden = false;
      els.hint.textContent = `Tab next · Enter cite · ${KEY_INSPECT} inspect · ? keys`;
      return;
    }
    els.hint.hidden = true;
  }

  function paintDock() {
    const open = state.inspect || state.panel || Boolean(state.draft) || state.help;
    els.dock.classList.toggle("is-open", open);
    const n = state.annotations.length;
    if (els.fabCount) {
      els.fabCount.hidden = !n || open;
      els.fabCount.textContent = String(n);
    }
  }

  function paintHelp() {
    if (!els.help) return;
    els.help.hidden = !state.help;
    if (!state.help) return;
    els.help.innerHTML = `
      <h3>Keys</h3>
      <dl>
        <dt>${escapeHtml(KEY_INSPECT)}</dt><dd>Inspect</dd>
        <dt>Tab ⇧Tab</dt><dd>Next / previous element</dd>
        <dt>↑ ↓ ← →</dt><dd>Move</dd>
        <dt>Enter</dt><dd>Cite this element</dd>
        <dt>${escapeHtml(KEY_SAVE)}</dt><dd>Save request</dd>
        <dt>${escapeHtml(KEY_COPY)}</dt><dd>Copy and resolve</dd>
        <dt>${escapeHtml(IS_MAC ? "⌥P" : "Alt+P")}</dt><dd>Annotations</dd>
        <dt>J K</dt><dd>Next / previous annotation</dd>
        <dt>?</dt><dd>This list</dd>
        <dt>Esc</dt><dd>Back</dd>
      </dl>
    `;
  }

  function sync() {
    paintMarks();
    paintList();
    paintComposer();
    paintHint();
    paintHelp();
    paintDock();
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

  function copyAndResolve(annotations) {
    if (!annotations.length) {
      showToast("Nothing to copy yet");
      return;
    }
    const bundle = formatBundle(annotations);
    const ids = new Set(annotations.map((item) => item.id));
    state.annotations = state.annotations.filter((item) => !ids.has(item.id));
    if (ids.has(state.activeId)) state.activeId = null;
    persistAnnotations(state.annotations);
    sync();
    copyText(bundle);
  }

  function onUiClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const act = button.dataset.act;
    if (act === "open") {
      toggleInspect();
      return;
    }
    if (act === "inspect") {
      toggleInspect();
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
      copyAndResolve(state.annotations);
      return;
    }
    if (act === "copy-one") {
      const annotation = state.annotations.find((item) => item.id === button.dataset.id);
      if (annotation) copyAndResolve([annotation]);
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
      focusAnnotation(button.dataset.id);
    }
  }

  function onSave(event) {
    event.preventDefault();
    if (!state.draft) return;
    const request = collapse(els.textarea.value);
    if (!request) return;
    const annotation = normalizeAnnotation({
      id: uid(),
      createdAt: new Date().toISOString(),
      request,
      target: state.draft.target,
    });
    if (!annotation) return;
    state.annotations.push(annotation);
    persistAnnotations(state.annotations);
    state.draft = null;
    state.activeId = state.annotations[state.annotations.length - 1].id;
    els.textarea.value = "";
    els.textarea.blur();
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

  function isCiteable(el) {
    if (!(el instanceof Element)) return false;
    if (SKIP_TAGS.has(el.tagName)) return false;
    if (el === root || el.id === ROOT_ID || (el.closest && el.closest(`#${ROOT_ID}`))) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width >= 8 && rect.height >= 8;
  }

  function collectTargets() {
    const nodes = [...document.querySelectorAll(TARGET_SEL)].filter(isCiteable);
    nodes.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      if (Math.abs(ar.top - br.top) > 10) return ar.top - br.top;
      return ar.left - br.left;
    });
    return nodes;
  }

  function ensureHover() {
    if (state.hovered && document.contains(state.hovered) && isCiteable(state.hovered)) return;
    const targets = collectTargets();
    const inView = targets.find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    });
    state.hovered = inView || targets[0] || null;
  }

  function revealHover() {
    if (!state.hovered) return;
    state.hovered.scrollIntoView({ block: "nearest", inline: "nearest" });
    paintHighlight(state.hovered);
  }

  function moveTarget(delta) {
    const targets = collectTargets();
    if (!targets.length) return;
    let index = state.hovered ? targets.indexOf(state.hovered) : -1;
    if (index < 0) index = delta > 0 ? -1 : 0;
    index = (index + delta + targets.length) % targets.length;
    state.hovered = targets[index];
    revealHover();
  }

  function moveTargetDir(dx, dy) {
    const targets = collectTargets();
    if (!targets.length) return;
    ensureHover();
    if (!state.hovered) {
      state.hovered = targets[0];
      revealHover();
      return;
    }
    const origin = state.hovered.getBoundingClientRect();
    const ox = origin.left + origin.width / 2;
    const oy = origin.top + origin.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of targets) {
      if (el === state.hovered) continue;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const vx = cx - ox;
      const vy = cy - oy;
      const along = vx * dx + vy * dy;
      if (along <= 4) continue;
      const across = Math.abs(vx * dy + vy * dx);
      const score = along + across * 3;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (!best) {
      moveTarget(dx + dy > 0 ? 1 : -1);
      return;
    }
    state.hovered = best;
    revealHover();
  }

  function citeElement(el) {
    if (!el) return;
    dismissHint();
    state.help = false;
    state.draft = { target: captureTarget(el) };
    state.hovered = el;
    els.textarea.value = "";
    setPanel(true);
    setInspect(false);
    sync();
    els.textarea.focus();
  }

  function focusAnnotation(id) {
    const annotation = state.annotations.find((item) => item.id === id);
    if (!annotation) return;
    state.activeId = id;
    setPanel(true);
    setInspect(false);
    try {
      document.querySelector(annotation.target.selector)?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    } catch (_) {
      /* ignore */
    }
    sync();
  }

  function moveAnnotation(delta) {
    if (!state.annotations.length) return;
    const ids = state.annotations.map((item) => item.id);
    let index = ids.indexOf(state.activeId);
    if (index < 0) index = delta > 0 ? -1 : 0;
    index = Math.max(0, Math.min(ids.length - 1, index + delta));
    focusAnnotation(ids[index]);
  }

  function toggleInspect() {
    dismissHint();
    state.help = false;
    setInspect(!state.inspect);
    if (!state.inspect && !state.annotations.length && !state.draft) setPanel(false);
    sync();
  }

  function toggleHelp() {
    state.help = !state.help;
    paintHelp();
    paintHint();
  }

  function selectAt(event) {
    const el = elementFromPoint(event);
    if (el) citeElement(el);
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

  function inComposer(event) {
    const path = event.composedPath ? event.composedPath() : [event.target];
    return path.includes(els.textarea);
  }

  function hostTyping(event) {
    if (event.altKey || event.metaKey || event.ctrlKey) return false;
    if (inComposer(event)) return true;
    const el = event.target;
    if (!(el instanceof HTMLElement)) return false;
    if (el.isContentEditable) return true;
    return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
  }

  function physicalLetter(event) {
    const code = event.code || "";
    if (code.length === 4 && code.startsWith("Key")) return code[3].toLowerCase();
    const key = event.key || "";
    if (key.length === 1) return key.toLowerCase();
    return "";
  }

  function onKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (state.help) {
        state.help = false;
        sync();
        return;
      }
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

    const key = event.key;
    const letter = physicalLetter(event);

    if (
      (event.metaKey || event.ctrlKey) &&
      event.shiftKey &&
      !event.altKey &&
      letter === "f"
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toggleInspect();
      return;
    }

    if (inComposer(event)) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        els.composer.requestSubmit();
      }
      return;
    }

    if (event.altKey && !event.metaKey && !event.ctrlKey && letter === "p") {
      event.preventDefault();
      setPanel(!state.panel);
      if (state.panel) setInspect(false);
      sync();
      return;
    }

    if (hostTyping(event)) return;

    if (key === "?" || (event.shiftKey && key === "/")) {
      if (state.inspect || state.panel || state.help) {
        event.preventDefault();
        toggleHelp();
      }
      return;
    }

    if (state.inspect) {
      if (key === "Tab") {
        event.preventDefault();
        moveTarget(event.shiftKey ? -1 : 1);
        return;
      }
      if (key === "ArrowDown" || letter === "j") {
        event.preventDefault();
        if (key === "ArrowDown") moveTargetDir(0, 1);
        else moveTarget(1);
        return;
      }
      if (key === "ArrowUp" || letter === "k") {
        event.preventDefault();
        if (key === "ArrowUp") moveTargetDir(0, -1);
        else moveTarget(-1);
        return;
      }
      if (key === "ArrowRight") {
        event.preventDefault();
        moveTargetDir(1, 0);
        return;
      }
      if (key === "ArrowLeft") {
        event.preventDefault();
        moveTargetDir(-1, 0);
        return;
      }
      if (key === "Enter" || key === " ") {
        event.preventDefault();
        ensureHover();
        citeElement(state.hovered);
        return;
      }
      if (letter === "c") {
        event.preventDefault();
        copyAndResolve(state.annotations);
        return;
      }
    }

    if (state.panel && !state.draft) {
      if (letter === "j" || key === "ArrowDown") {
        event.preventDefault();
        moveAnnotation(1);
        return;
      }
      if (letter === "k" || key === "ArrowUp") {
        event.preventDefault();
        moveAnnotation(-1);
        return;
      }
      if (letter === "c") {
        event.preventDefault();
        copyAndResolve(state.annotations);
        return;
      }
      if (letter === "d" || key === "Backspace") {
        if (!state.activeId) return;
        event.preventDefault();
        state.annotations = state.annotations.filter((item) => item.id !== state.activeId);
        state.activeId = state.annotations[0] ? state.annotations[0].id : null;
        persistAnnotations(state.annotations);
        sync();
        return;
      }
      if (letter === "i") {
        event.preventDefault();
        toggleInspect();
      }
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
