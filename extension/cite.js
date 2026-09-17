/**
 * cite.js — click any element, describe the change, copy a bundle for a coding agent.
 *
 *   <script src="https://cite.wipds.com/cite.js" data-project="abc123"></script>
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
  const CAPTURE_VERSION = 5;
  const TEXT_LIMIT = 160;
  const TITLE_LIMIT = 120;
  const HTML_LIMIT = 800;
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
  const SENSITIVE_ATTRIBUTE = /(?:^|[-_:])(?:anti[-_]?forgery(?:token)?|auth(?:orization)?|cookie|credential|csrf(?:middlewaretoken|token)?|nonce|pass(?:word|wd)?|requestverificationtoken|secret|session|token|xsrf(?:token)?|api[-_]?key)(?:$|[-_:])/i;
  const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
  const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";
  const FORM_VALUE_TAGS = new Set(["button", "input", "option", "select", "textarea"]);
  const SERIALIZED_FORM_STRUCTURE_TAGS = new Set(["OPTION", "OPTGROUP"]);
  const URL_ATTRIBUTES = new Set([
    "action",
    "about",
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
    "resource",
    "src",
    "usemap",
    "vocab",
  ]);
  const URL_LIST_ATTRIBUTES = new Set(["archive", "attributionsrc", "itemtype", "ping"]);
  const URL_CANDIDATE_ATTRIBUTES = new Set(["imagesrcset", "srcset"]);
  const URL_NAMED_ATTRIBUTE = /(?:^|[-_:])(?:endpoint|href|resource|src|url|uri)(?:$|[-_:])/i;
  const RDFa_URL_LIST_ATTRIBUTES = new Set(["datatype", "prefix", "property", "rel", "rev", "typeof"]);
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

  function textFromSanitizedHtml(html) {
    if (!html) return "";
    const template = document.createElement("template");
    template.innerHTML = html;
    const element = template.content.firstElementChild;
    if (!element) return "";
    const label =
      element.getAttribute("aria-label") ||
      element.getAttribute("alt") ||
      element.getAttribute("title") ||
      element.getAttribute("placeholder");
    return safeText(label || element.textContent);
  }

  function safeNearbyText(value, { drop = false, scrubFormValue = false } = {}) {
    if (drop) return "";
    const text = safeText(value, 120);
    if (!scrubFormValue) return text;
    return /^(?:button|input|option|select|textarea)(?:[#.\s]|$)/i.test(text) ? "" : text;
  }

  function hasBlockingRenderState(el) {
    let node = el;
    while (node && node instanceof Element) {
      const style = getComputedStyle(node);
      if (
        style.display === "none" ||
        Number(style.opacity) === 0 ||
        style.contentVisibility === "hidden"
      ) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  function hasVisibleBox(el) {
    if (hasBlockingRenderState(el)) return false;
    const visibility = getComputedStyle(el).visibility;
    if (visibility === "hidden" || visibility === "collapse") return false;
    return [...el.getClientRects()].some((rect) => rect.width > 0 && rect.height > 0);
  }

  function isRenderedTextNode(textNode) {
    if (!collapse(textNode && textNode.nodeValue)) return false;
    const parent = textNode.parentElement;
    if (!parent || SKIP_TAGS.has(parent.tagName) || hasBlockingRenderState(parent)) return false;
    const visibility = getComputedStyle(parent).visibility;
    if (visibility === "hidden" || visibility === "collapse") return false;
    const range = document.createRange();
    range.selectNodeContents(textNode);
    return [...range.getClientRects()].some((rect) => rect.width > 0 && rect.height > 0);
  }

  function renderedTextFromRanges(el) {
    const parts = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
      if (isRenderedTextNode(textNode)) parts.push(textNode.nodeValue);
      textNode = walker.nextNode();
    }
    return safeText(parts.join(" "));
  }

  function visibleRenderedText(el) {
    if (hasVisibleBox(el) && typeof el.innerText === "string") {
      return safeText(el.innerText);
    }
    return renderedTextFromRanges(el);
  }

  function isRenderedElement(el) {
    if (!(el instanceof Element) || SKIP_TAGS.has(el.tagName) || hasBlockingRenderState(el)) {
      return false;
    }
    if (hasVisibleBox(el) || visibleRenderedText(el)) return true;
    return [...el.querySelectorAll("*")].some(hasVisibleBox);
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
    return visibleRenderedText(el);
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

  function fullClassList(el) {
    if (!el.classList) return [];
    return [...el.classList].slice(0, 12).map((name) => safeText(name, 120));
  }

  function ancestorCrumbs(el) {
    const crumbs = [];
    let node = el.parentElement;
    while (node && node !== document.body && crumbs.length < 3) {
      crumbs.unshift(safeText(shortName(node), 120));
      node = node.parentElement;
    }
    return crumbs;
  }

  function keyStyleSnapshot(el) {
    const computed = getComputedStyle(el);
    return {
      color: sanitizeStyleValue("color", computed.color),
      backgroundColor: sanitizeStyleValue("backgroundColor", computed.backgroundColor),
      fontSize: sanitizeStyleValue("fontSize", computed.fontSize),
      fontWeight: sanitizeStyleValue("fontWeight", computed.fontWeight),
      borderRadius: sanitizeStyleValue("borderRadius", computed.borderRadius),
    };
  }

  function keyStyleBits(styles) {
    const bits = [];
    if (styles.color) bits.push(styles.color);
    if (styles.backgroundColor && !isNeutralStyle("backgroundColor", styles.backgroundColor)) {
      bits.push(`on ${styles.backgroundColor}`);
    }
    if (styles.fontSize) bits.push(styles.fontSize);
    if (styles.fontWeight && !isNeutralStyle("fontWeight", styles.fontWeight)) {
      bits.push(`weight ${styles.fontWeight}`);
    }
    if (styles.borderRadius && !isNeutralStyle("borderRadius", styles.borderRadius)) {
      bits.push(`radius ${styles.borderRadius}`);
    }
    return bits.join(" · ");
  }

  let snapCacheEl = null;
  let snapCache = null;

  function elementSnapshot(el) {
    if (el === snapCacheEl && snapCache) return snapCache;
    snapCacheEl = el;
    snapCache = {
      classes: fullClassList(el),
      styles: keyStyleSnapshot(el),
      crumbs: ancestorCrumbs(el),
    };
    return snapCache;
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
      const heading =
        node.querySelectorAll &&
        [...node.querySelectorAll("h1, h2, h3")].find(isRenderedElement);
      if (heading && heading !== el) {
        const text = visibleText(heading);
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
        ? visibleText(node)
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

  function hasHiddenInlineStyle(node, includeVisibility = true) {
    const { display, visibility, opacity, contentVisibility } = node.style;
    return (
      display === "none" ||
      (includeVisibility && (visibility === "hidden" || visibility === "collapse")) ||
      (opacity !== "" && Number(opacity) === 0) ||
      contentVisibility === "hidden"
    );
  }

  function sanitizeHtmlTree(root, { renderedPruned = false } = {}) {
    root.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((node) => node.remove());
    if (root.hasAttribute("hidden") || hasHiddenInlineStyle(root, !renderedPruned)) root.replaceChildren();
    root.querySelectorAll("[hidden], [style]").forEach((node) => {
      if (node.hasAttribute("hidden") || hasHiddenInlineStyle(node, !renderedPruned)) node.remove();
    });
    const nodes = root.nodeType === 1 ? [root, ...root.querySelectorAll("*")] : [...root.querySelectorAll("*")];
    for (const node of nodes) {
      const tag = node.tagName.toLowerCase();
      if (tag === "textarea") node.textContent = "";
      if (FORM_VALUE_TAGS.has(tag) || tag.includes("-")) {
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
        if (name === "itemprop" || RDFa_URL_LIST_ATTRIBUTES.has(name)) {
          attr.value = sanitizeUrlList(attr.value, true);
          continue;
        }
        const isXmlBase =
          qualifiedName === "xml:base" &&
          (attr.namespaceURI === null || attr.namespaceURI === XML_NAMESPACE);
        const isXmlnsUrl =
          qualifiedName === "xmlns" ||
          qualifiedName.startsWith("xmlns:") ||
          attr.namespaceURI === XMLNS_NAMESPACE;
        if (
          URL_ATTRIBUTES.has(name) ||
          URL_NAMED_ATTRIBUTE.test(qualifiedName) ||
          (tag === "object" && name === "data") ||
          isXmlBase ||
          isXmlnsUrl
        ) {
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

  function cloneRenderedSubtree(el) {
    const clone = el.cloneNode(true);
    const sourceTextNodes = [];
    const cloneTextNodes = [];
    const sourceTextWalker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const cloneTextWalker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    let sourceTextNode = sourceTextWalker.nextNode();
    let cloneTextNode = cloneTextWalker.nextNode();
    while (sourceTextNode && cloneTextNode) {
      sourceTextNodes.push(sourceTextNode);
      cloneTextNodes.push(cloneTextNode);
      sourceTextNode = sourceTextWalker.nextNode();
      cloneTextNode = cloneTextWalker.nextNode();
    }
    for (let index = sourceTextNodes.length - 1; index >= 0; index -= 1) {
      const parent = sourceTextNodes[index].parentElement;
      if (
        !isRenderedTextNode(sourceTextNodes[index]) &&
        !SERIALIZED_FORM_STRUCTURE_TAGS.has(parent && parent.tagName)
      ) {
        cloneTextNodes[index].remove();
      }
    }
    const sourceNodes = [el, ...el.querySelectorAll("*")];
    const cloneNodes = [clone, ...clone.querySelectorAll("*")];
    for (let index = sourceNodes.length - 1; index > 0; index -= 1) {
      const source = sourceNodes[index];
      if (!isRenderedElement(source) && !SERIALIZED_FORM_STRUCTURE_TAGS.has(source.tagName)) {
        cloneNodes[index].remove();
      }
    }
    return clone;
  }

  function serializeHtml(el, max) {
    const clone = cloneRenderedSubtree(el);
    sanitizeHtmlTree(clone, { renderedPruned: true });
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
    if (!isRenderedElement(el)) return "";
    const text = visibleText(el);
    return safeText(`${shortName(el)}${text ? ` ${JSON.stringify(text)}` : ""}`, 120);
  }

  function renderedSibling(el, direction) {
    let sibling = el[direction];
    while (sibling && !isRenderedElement(sibling)) sibling = sibling[direction];
    return sibling;
  }

  function nearbyContext(el) {
    const parent = el.parentElement;
    const prev = renderedSibling(el, "previousElementSibling");
    const next = renderedSibling(el, "nextElementSibling");
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
      fullClasses: fullClassList(el),
      crumbs: ancestorCrumbs(el),
      role: el.getAttribute("role") || el.getAttribute("type") || "",
      inputType: el.tagName.toLowerCase() === "input" ? el.getAttribute("type") || "" : "",
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
    if (key === "border") return value === "none" || value.startsWith("0px");
    if (key === "outline") return value === "none" || /\bnone\b/.test(value);
    const exact = {
      alignItems: "normal",
      backgroundColor: "rgba(0, 0, 0, 0)",
      backgroundImage: "none",
      borderRadius: "0px",
      boxShadow: "none",
      boxSizing: "border-box",
      flex: "0 1 auto",
      flexDirection: "row",
      flexWrap: "nowrap",
      fontStyle: "normal",
      fontWeight: "400",
      gap: "normal",
      gridTemplateColumns: "none",
      gridTemplateRows: "none",
      justifyContent: "normal",
      letterSpacing: "normal",
      lineHeight: "normal",
      margin: "0px",
      maxHeight: "none",
      maxWidth: "none",
      minHeight: "0px",
      minWidth: "0px",
      opacity: "1",
      overflow: "visible",
      padding: "0px",
      position: "static",
      textAlign: "start",
      textDecoration: "none",
      textTransform: "none",
      transform: "none",
      zIndex: "auto",
    };
    return exact[key] === value;
  }

  const ALWAYS_STYLE_KEYS = new Set(["display", "width", "height", "fontFamily", "fontSize", "color"]);

  function relevantStyleEntries(styles) {
    const keys = new Set();
    for (const key of BASE_STYLE_KEYS) {
      if (ALWAYS_STYLE_KEYS.has(key) || !isNeutralStyle(key, styles[key])) keys.add(key);
    }
    for (const key of CONDITIONAL_STYLE_KEYS) {
      if (!isNeutralStyle(key, styles[key])) keys.add(key);
    }
    const display = styles.display || "";
    if (display.includes("flex")) {
      for (const key of FLEX_STYLE_KEYS) {
        if (!isNeutralStyle(key, styles[key])) keys.add(key);
      }
    }
    if (display.includes("grid")) {
      for (const key of GRID_STYLE_KEYS) {
        if (!isNeutralStyle(key, styles[key])) keys.add(key);
      }
    }
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

  function collectRootVars(rules, take, depth) {
    if (!rules || depth > 1) return;
    for (const rule of rules) {
      if (rule.selectorText && /(?:^|[^\w-])(?::root|html)(?:$|[^\w-])/.test(rule.selectorText)) {
        const style = rule.style;
        if (style) {
          for (let index = 0; index < style.length; index += 1) {
            const name = style[index];
            if (name && name.startsWith("--")) take(name, style.getPropertyValue(name));
          }
        }
      } else if (rule.cssRules && (rule.type === 4 || rule.type === 12)) {
        collectRootVars(rule.cssRules, take, depth + 1);
      }
    }
  }

  function rootCustomProps() {
    const found = new Map();
    const take = (name, value) => {
      const clean = String(name || "").trim().slice(0, 40);
      if (!clean.startsWith("--") || SENSITIVE_ATTRIBUTE.test(clean) || found.has(clean)) return;
      if (found.size >= 12) return;
      const sanitized = truncate(sanitizeStyleValue("customProperty", value), 80);
      if (sanitized) found.set(clean, sanitized);
    };
    try {
      const inline = document.documentElement.style;
      for (let index = 0; index < inline.length && found.size < 12; index += 1) {
        const name = inline[index];
        if (name && name.startsWith("--")) take(name, inline.getPropertyValue(name));
      }
    } catch (_) {
      /* inline :root props are best-effort */
    }
    const sheets = document.styleSheets ? [...document.styleSheets] : [];
    for (const sheet of sheets) {
      if (found.size >= 12) break;
      let rules = null;
      try {
        rules = sheet.cssRules;
      } catch (_) {
        continue;
      }
      collectRootVars(rules, take, 0);
    }
    return [...found.entries()];
  }

  function pageDesignLine() {
    const parts = [];
    try {
      if (document.body) {
        const body = getComputedStyle(document.body);
        const color = sanitizeStyleValue("color", body.color);
        const bg = sanitizeStyleValue("backgroundColor", body.backgroundColor);
        const size = sanitizeStyleValue("fontSize", body.fontSize);
        const font = sanitizeStyleValue("fontFamily", body.fontFamily);
        if (color) parts.push(`text ${color}`);
        if (bg && !isNeutralStyle("backgroundColor", bg)) parts.push(`bg ${bg}`);
        if (size) parts.push(size);
        if (font) parts.push(truncate(font.split(",")[0].replace(/["']/g, "").trim(), 40));
      }
    } catch (_) {
      /* body styles are best-effort */
    }
    for (const [name, value] of rootCustomProps()) {
      parts.push(`${name}: ${value}`);
    }
    return truncate(parts.join(" · "), 300);
  }

  function formatAnnotation(annotation, index, cssText) {
    const target = annotation.target;
    const n = index + 1;
    return [
      `## Annotation ${n}`,
      "",
      `Element: ${target.name}`,
      `Selector: ${target.selector}`,
      target.fullClasses && target.fullClasses.length
        ? `Classes: ${truncate(target.fullClasses.join(" "), 240)}`
        : null,
      target.role ? `Role: ${target.role}` : null,
      target.text ? `Text: ${JSON.stringify(target.text)}` : null,
      `Location: ${target.trail}`,
      `Box: ${target.rect.width}×${target.rect.height} at ${target.rect.x},${target.rect.y}`,
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
      cssText !== undefined ? cssText : formatStyles(target.styles),
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
    const design = pageDesignLine();
    const header = [
      "Visual change requests from a web page. Apply each request to the matching element.",
      "",
      `Page: ${first.path}`,
      `Title: ${first.title}`,
      `URL: ${first.url}`,
      `Viewport: ${first.viewport.width}×${first.viewport.height}`,
      design ? `Design: ${design}` : null,
      "",
      "",
    ].filter((line) => line !== null);
    const seenStyles = new Map();
    const bodies = safeAnnotations.map((annotation, index) => {
      const css = formatStyles(annotation.target.styles);
      if (seenStyles.has(css)) {
        return formatAnnotation(annotation, index, `(same as Annotation ${seenStyles.get(css)})`);
      }
      seenStyles.set(css, index + 1);
      return formatAnnotation(annotation, index);
    });
    return `${header.join("\n")}${bodies.join("\n\n")}\n`;
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

  function normalizeTarget(
    target,
    { dropLegacyValueText = false, dropLegacyNearby = false, scrubLegacyNearby = false } = {},
  ) {
    if (!target || typeof target !== "object") return null;
    const tag = safeText(target.tag, 32).toLowerCase();
    const role = safeText(target.role, 64).toLowerCase();
    const inputType = safeText(target.inputType, 32).toLowerCase();
    const html = sanitizeStoredHtml(target.html);
    const formValue =
      tag === "textarea" ||
      tag === "select" ||
      (dropLegacyValueText && ["button", "input", "option"].includes(tag)) ||
      (tag === "input" && !["button", "reset", "submit"].includes(inputType));
    const recoveredLegacyLabel =
      dropLegacyValueText && ["button", "option"].includes(tag)
        ? textFromSanitizedHtml(html)
        : "";
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
      fullClasses: Array.isArray(target.fullClasses)
        ? target.fullClasses.slice(0, 12).map((name) => safeText(name, 120))
        : [],
      crumbs: Array.isArray(target.crumbs)
        ? target.crumbs.slice(0, 3).map((name) => safeText(name, 120))
        : [],
      role,
      inputType: tag === "input" ? inputType : "",
      text: formValue ? recoveredLegacyLabel : safeText(target.text),
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
      html,
      nearby: {
        parent: safeText(nearby.parent, 120),
        previous: safeNearbyText(nearby.previous, {
          drop: dropLegacyNearby,
          scrubFormValue: scrubLegacyNearby,
        }),
        next: safeNearbyText(nearby.next, {
          drop: dropLegacyNearby,
          scrubFormValue: scrubLegacyNearby,
        }),
      },
      url: safePageUrl(target.url),
      path: safePath(target.path),
      title: safeText(target.title, TITLE_LIMIT),
    };
  }

  function normalizeAnnotation(annotation, { migrateLegacy = false } = {}) {
    if (!annotation || typeof annotation !== "object") return null;
    const version = Number(annotation.captureVersion);
    const isLegacy = migrateLegacy && version !== CAPTURE_VERSION;
    const hasAmbiguousValueText = isLegacy && (!Number.isFinite(version) || version < 3);
    const target = normalizeTarget(annotation.target, {
      dropLegacyValueText: hasAmbiguousValueText,
      dropLegacyNearby: isLegacy,
      scrubLegacyNearby: isLegacy,
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
      flex-direction: column;
      align-items: stretch;
      gap: 2px;
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
    .label-main {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .label-main b { font-weight: 500; color: var(--accent); }
    .label-main span { color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
    .label-main i {
      font-style: normal;
      color: var(--subtle);
      font-variant-numeric: tabular-nums;
    }
    .label-sub {
      color: var(--subtle);
      font-size: 10px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
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
    .fab.is-on {
      background: var(--accent);
      color: var(--accent-text);
    }
    .fab.is-on:hover { background: oklch(0.86 0.13 80); }
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
    .composer {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 14px;
    }
    .popover {
      position: fixed;
      z-index: 9;
      width: 320px;
      max-width: calc(100vw - 24px);
      border-radius: var(--radius);
      background: var(--bg);
      box-shadow:
        0 0 0 1px oklch(1 0 0 / 0.08),
        0 16px 40px oklch(0 0 0 / 0.32);
      pointer-events: auto;
      overflow: hidden;
    }
    .popover textarea {
      min-height: 72px;
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
    .detail {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-family: var(--mono);
      font-size: 10px;
      line-height: 1.4;
      color: var(--subtle);
    }
    .detail div {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .starter {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .starter button[data-act="starter"] {
      flex: 1;
      min-width: 0;
      text-align: left;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .starter button[data-act="starter"]:hover { color: var(--accent); }
    .starter .dismiss {
      flex: none;
      color: var(--subtle);
      font-size: 14px;
      line-height: 1;
      padding: 2px 4px;
    }
    .starter .dismiss:hover { color: var(--text); }
    .meta {
      color: var(--subtle);
      font-size: 11px;
      line-height: 1.3;
      font-variant-numeric: tabular-nums;
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
      .hint { display: none; }
      .composer-keys { display: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .btn, .fab { transition: none; }
    }
  `;

  const state = {
    inspect: false,
    draft: null,
    hovered: null,
    annotations: loadAnnotations(),
    toast: "",
    hint: !sessionStorage.getItem("cite-hint"),
    help: false,
    starter: sessionStorage.getItem("cite-starter") !== "0",
  };

  let root;
  let shadow;
  let els = {};
  let toastTimer = 0;
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
        <div class="hint" hidden></div>
        <div class="dock">
          <button type="button" class="fab" data-act="open" aria-label="Open Cite" aria-pressed="false" aria-keyshortcuts="Control+Shift+F Meta+Shift+F">=></button>
        </div>
        <div class="popover" hidden>
          <form class="composer">
            <div class="chip">
              <code data-el="chipName"></code>
              <small data-el="chipText"></small>
            </div>
            <div class="detail" data-el="chipDetail" hidden></div>
            <div class="starter" data-el="starter" hidden>
              <button type="button" data-act="starter" title="Click to insert"></button>
              <button type="button" class="dismiss" data-act="starter-dismiss" aria-label="Dismiss starter">×</button>
            </div>
            <label class="sr-only" for="cite-request" hidden>Change request</label>
            <textarea id="cite-request" name="request" rows="4" placeholder="Make this button smaller and use the same radius as the cards."></textarea>
            <div class="meta" data-el="estimate" hidden></div>
            <div class="row">
              <span class="composer-keys"></span>
              <button type="button" class="btn" data-act="cancel">Cancel</button>
              <button type="submit" class="btn btn-primary" data-el="save">Copy</button>
            </div>
          </form>
        </div>
        <div class="help" hidden></div>
        <div class="toast" hidden></div>
      </div>
    `;
    els.veil = shadow.querySelector(".veil");
    els.highlight = shadow.querySelector(".highlight");
    els.label = shadow.querySelector(".label");
    els.hint = shadow.querySelector(".hint");
    els.fab = shadow.querySelector(".fab");
    els.popover = shadow.querySelector(".popover");
    els.composer = shadow.querySelector(".composer");
    els.chipName = shadow.querySelector('[data-el="chipName"]');
    els.chipText = shadow.querySelector('[data-el="chipText"]');
    els.chipDetail = shadow.querySelector('[data-el="chipDetail"]');
    els.starter = shadow.querySelector('[data-el="starter"]');
    els.starterBtn = shadow.querySelector('[data-act="starter"]');
    els.estimate = shadow.querySelector('[data-el="estimate"]');
    els.textarea = shadow.querySelector("textarea");
    els.save = shadow.querySelector('[data-el="save"]');
    els.help = shadow.querySelector(".help");
    els.toast = shadow.querySelector(".toast");
    els.composerKeys = shadow.querySelector(".composer-keys");
    if (els.composerKeys) els.composerKeys.textContent = "Enter copy · Shift+Enter newline · Esc cancel";

    shadow.addEventListener("click", onUiClick);
    els.composer.addEventListener("submit", onSave);
    els.textarea.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      els.composer.requestSubmit();
    });
    els.textarea.addEventListener("input", () => {
      paintComposerDynamic();
    });
    els.veil.addEventListener("mousemove", onPointerMove);
    els.veil.addEventListener("click", (event) => {
      event.preventDefault();
      selectAt(event);
    });
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
    snapCacheEl = null;
    snapCache = null;
    document.documentElement.style.cursor = next ? "crosshair" : "";
    els.veil.hidden = !next;
    if (next) ensureHover();
    else paintHighlight(null);
  }

  function paintHighlight(el, showLabel = true) {
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
    if (!showLabel) {
      els.label.hidden = true;
      return;
    }

    const name = shortName(el);
    const size = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
    const text = visibleText(el);
    const snap = elementSnapshot(el);
    const subBits = [];
    if (snap.classes.length) subBits.push(truncate(snap.classes.join(" "), 96));
    const styleBits = keyStyleBits(snap.styles);
    if (styleBits) subBits.push(styleBits);
    const sub = subBits.join(" · ");
    els.label.innerHTML = `<div class="label-main"><b>${escapeHtml(name)}</b>${
      text ? `<span>${escapeHtml(truncate(text, 42))}</span>` : ""
    }<i>${size}</i></div>${sub ? `<div class="label-sub">${escapeHtml(sub)}</div>` : ""}`;
    els.label.hidden = false;
    const labelHeight = els.label.offsetHeight || 28;
    const labelTop = rect.top >= labelHeight + 4 ? rect.top - labelHeight - 4 : rect.bottom + 6;
    const labelLeft = Math.min(Math.max(8, rect.left), window.innerWidth - 240);
    Object.assign(els.label.style, {
      left: `${labelLeft}px`,
      top: `${labelTop}px`,
    });
  }

  function starterInsertText(target) {
    const classes = target.fullClasses && target.fullClasses.length
      ? ` (${target.fullClasses.slice(0, 4).join(" ")})`
      : "";
    return `Change ${target.name}${classes} to `;
  }

  function paintDetail() {
    if (!state.draft) {
      els.chipDetail.hidden = true;
      return;
    }
    const target = state.draft.target;
    const rows = [];
    if (target.fullClasses && target.fullClasses.length) {
      rows.push(`classes: ${truncate(target.fullClasses.join(" "), 140)}`);
    }
    const styleBits = keyStyleBits(target.styles || {});
    if (styleBits) rows.push(`style: ${styleBits}`);
    if (target.crumbs && target.crumbs.length) {
      rows.push(`in: ${target.crumbs.join(" › ")}`);
    }
    if (target.rect) {
      rows.push(`box: ${target.rect.width}×${target.rect.height}`);
    }
    els.chipDetail.hidden = !rows.length;
    els.chipDetail.innerHTML = rows.map((row) => `<div>${escapeHtml(row)}</div>`).join("");
  }

  function paintComposerDynamic() {
    if (!state.draft) return;
    els.save.disabled = !collapse(els.textarea.value);
    const showStarter = state.starter && !collapse(els.textarea.value);
    els.starter.hidden = !showStarter;
    if (showStarter) {
      els.starterBtn.textContent = starterInsertText(state.draft.target);
    }
    const request = collapse(els.textarea.value) || "(your request)";
    const body = formatAnnotation({ request, target: state.draft.target }, 0);
    const tokens = Math.max(1, Math.ceil((body.length + 400) / 4));
    els.estimate.hidden = false;
    els.estimate.textContent = `~${tokens} tokens`;
  }

  function paintPopover() {
    if (!state.draft) {
      els.popover.hidden = true;
      return;
    }
    els.popover.hidden = false;
    els.chipName.textContent = state.draft.target.name;
    els.chipText.textContent = state.draft.target.text
      ? `“${state.draft.target.text}”`
      : state.draft.target.trail;
    paintDetail();
    paintComposerDynamic();
    if (window.innerWidth <= 520) {
      Object.assign(els.popover.style, {
        left: "8px",
        right: "8px",
        top: "auto",
        bottom: "64px",
        width: "auto",
      });
      return;
    }
    els.popover.style.right = "";
    els.popover.style.bottom = "";
    els.popover.style.width = "";
    const w = els.popover.offsetWidth;
    const h = els.popover.offsetHeight;
    const px = state.draft.x - window.scrollX;
    const py = state.draft.y - window.scrollY;
    let left = px + 12;
    let top = py + 12;
    if (left + w > window.innerWidth - 8) left = px - w - 12;
    if (top + h > window.innerHeight - 8) top = py - h - 12;
    els.popover.style.left = `${Math.max(8, Math.min(left, window.innerWidth - w - 8))}px`;
    els.popover.style.top = `${Math.max(8, Math.min(top, window.innerHeight - h - 8))}px`;
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
    const open = state.inspect || Boolean(state.draft) || state.help;
    els.fab.classList.toggle("is-on", open);
    els.fab.setAttribute("aria-pressed", String(open));
    els.fab.setAttribute("aria-label", open ? "Close Cite" : "Open Cite");
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
        <dt>Enter</dt><dd>Cite, then copy</dd>
        <dt>⇧Enter</dt><dd>New line</dd>
        <dt>?</dt><dd>This list</dd>
        <dt>Esc</dt><dd>Back</dd>
      </dl>
    `;
  }

  function sync() {
    paintPopover();
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
    paintHighlight(locked, !state.draft);
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
    if (act === "cancel") {
      state.draft = null;
      els.textarea.value = "";
      setInspect(true);
      sync();
      return;
    }
    if (act === "starter") {
      if (!state.draft) return;
      els.textarea.value = starterInsertText(state.draft.target);
      els.textarea.focus();
      paintComposerDynamic();
      return;
    }
    if (act === "starter-dismiss") {
      state.starter = false;
      try {
        sessionStorage.setItem("cite-starter", "0");
      } catch (_) {
        /* dismiss persistence is best-effort */
      }
      sync();
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
    els.textarea.value = "";
    els.textarea.blur();
    setInspect(true);
    copyAndResolve([annotation]);
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
    if (!isRenderedElement(el)) return false;
    if (el === root || el.id === ROOT_ID || (el.closest && el.closest(`#${ROOT_ID}`))) return false;
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

  function citeElement(el, point) {
    if (!el) return;
    dismissHint();
    state.help = false;
    const rect = el.getBoundingClientRect();
    const anchor = point || {
      x: rect.right + window.scrollX,
      y: rect.top + window.scrollY,
    };
    state.draft = {
      target: captureTarget(el),
      x: Math.round(anchor.x),
      y: Math.round(anchor.y),
    };
    state.hovered = el;
    els.textarea.value = "";
    setInspect(false);
    sync();
    els.textarea.focus();
  }

  function toggleInspect() {
    dismissHint();
    state.help = false;
    setInspect(!state.inspect);
    sync();
  }

  function toggleHelp() {
    state.help = !state.help;
    paintHelp();
    paintHint();
  }

  function selectAt(event) {
    const el = elementFromPoint(event);
    if (el) citeElement(el, { x: event.clientX + window.scrollX, y: event.clientY + window.scrollY });
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

    if (hostTyping(event)) return;

    if (key === "?" || (event.shiftKey && key === "/")) {
      if (state.inspect || state.draft || state.help) {
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
  if (state.annotations.length) {
    const cleared = state.annotations.length;
    state.annotations = [];
    persistAnnotations(state.annotations);
    sync();
    showToast(`Cleared ${cleared} unsent annotation${cleared === 1 ? "" : "s"} from an older version`);
  }

  window.__cite = {
    inspect() {
      toggleInspect();
    },
  };
})();
