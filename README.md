# Cite

Click anything on a web page. Tell a coding agent what to change.

Cite is a single embeddable script. It injects an isolated overlay (Shadow DOM), captures the clicked element, and copies a compact bundle — selector, HTML, relevant rendered CSS, nearby elements, and the written request — ready to paste into Claude, Cursor, or Codex.

No accounts. No backend. No build step.

## Embed

```html
<script
  src="https://cite.wipds.com/cite.js"
  data-project="abc123"
></script>
```

`data-project` only namespaces localStorage. It is optional.

Site: [cite.wipds.com](https://cite.wipds.com). Cite is loaded on that page.

## Astro (dev only)

In the root layout, at the end of `<body>`:

```astro
---
const cite = import.meta.env.DEV;
---

<html>
  <body>
    <slot />
    {cite && (
      <script
        is:inline
        src="https://cite.wipds.com/cite.js"
        data-project="your-site"
      />
    )}
  </body>
</html>
```

`import.meta.env.DEV` is true only under `astro dev`. `astro build` drops the tag, so Cite never ships to production.

`is:inline` keeps Astro from bundling the script.

To vendor the file, copy `cite.js` into `public/` and set `src="/cite.js"`.

To load on `astro preview` as well (the tag ships, then no-ops off localhost):

```html
<script is:inline>
  if (["localhost", "127.0.0.1"].includes(location.hostname)) {
    const s = document.createElement("script");
    s.src = "https://cite.wipds.com/cite.js";
    s.dataset.project = "your-site";
    document.body.append(s);
  }
</script>
```

## Chrome

Use Cite on any site without embedding the script.

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. **Load unpacked** and choose the `extension/` folder in this repo.

Click the Cite icon (or press Cmd+Shift+F / Ctrl+Shift+F) to inspect the current tab. The overlay, keys, and bundle are the same as the embed. Chrome may reserve that shortcut; set it under `chrome://extensions/shortcuts` if it does not bind.

The extension asks for the current tab only when you click. It does not run on every page.

Chrome cannot load files outside `extension/`, so `extension/cite.js` is a hard link to the repo-root script. After a fresh clone, run `npm run extension` if they have drifted.

## Local

```bash
npx wrangler dev
```

Or `python3 -m http.server 4173`. Open [http://localhost:4173/](http://localhost:4173/).

## Deploy

```bash
npm run deploy
```

Serves `cite.js` at [cite.wipds.com/cite.js](https://cite.wipds.com/cite.js).

## Use

1. Press `Cmd+Shift+F` (or click the `=>` button).
2. `Tab` / arrows to an element. `Enter` cites it. Click still works.
3. Write the change. `Enter` copies it to your clipboard. `Shift+Enter` adds a line. `Esc` backs up.

`?` opens the shortcut list while Cite is active.

Each request copies straight to your clipboard — nothing is stored.

Cite omits live form values, URL query strings and fragments, and sensitive HTML attributes from copied bundles.

## Bundle

The copied text looks like this:

```text
Visual change requests from a web page. Apply each request to the matching element.

Page: /
Title: Cite — click anything, tell the agent what to change
URL: https://cite.wipds.com/
Viewport: 1280×720
Design: text rgb(34, 34, 34) · bg rgb(255, 255, 255) · 16px · system-ui · --brand: #6d28d9

## Annotation 1

Element: a.btn.btn-hero.cta-primary
Selector: a.cta-primary
Classes: btn btn-hero cta-primary px-4 py-2 rounded-xl
Text: "Start building"
Location: Pricing hero → Plans → a.btn.btn-hero.cta-primary
Box: 220×48 at 530,310

Request:
Make this button smaller and use the same radius as the cards.

### HTML
...

### Relevant CSS
...

### Nearby elements
...
```
