# Cite

Click anything on a web page. Tell a coding agent what to change.

Cite is a single embeddable script. It injects an isolated overlay (Shadow DOM), captures the clicked element, and copies a bundle — selector, HTML, computed CSS, nearby DOM, and the written request — ready to paste into Claude, Cursor, or Codex.

No accounts. No backend. No build step.

## Embed

```html
<script
  src="https://cite.brijr.dev/cite.js"
  data-project="abc123"
></script>
```

`data-project` only namespaces localStorage. It is optional.

Site: [cite.brijr.dev](https://cite.brijr.dev). Cite is loaded on that page.

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
        src="https://cite.brijr.dev/cite.js"
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
    s.src = "https://cite.brijr.dev/cite.js";
    s.dataset.project = "your-site";
    document.body.append(s);
  }
</script>
```

## Local

```bash
npx wrangler dev
```

Or `python3 -m http.server 4173`. Open [http://localhost:4173/](http://localhost:4173/).

## Deploy

```bash
npm run deploy
```

Serves `cite.js` at [cite.brijr.dev/cite.js](https://cite.brijr.dev/cite.js).

## Use

1. Press `Cmd+Shift+F` (or click **Inspect**).
2. `Tab` / arrows to an element. `Enter` cites it. Click still works.
3. Write the change. `⌘Enter` / `Ctrl+Enter` saves. `Esc` backs up.
4. `C` copies the bundle and removes those annotations from the list.

`?` opens the shortcut list while Cite is active.

Annotations persist per page in `localStorage`. Marks stay on the page so you can stack several requests, then copy them as one bundle.

## Bundle

The copied text looks like this:

```text
The following are visual change requests captured from a web page.
Apply each request to the matching element.

Page: /
Title: Cite — click anything, tell the agent what to change
URL: https://cite.brijr.dev/

## Annotation 1

Element: a.btn.btn-hero.cta-primary
Selector: a.cta-primary
Text: "Start building"
Location: Pricing hero → Plans → a.btn.btn-hero.cta-primary

Request:
Make this button smaller and use the same radius as the cards.

### HTML
...

### Computed CSS
...

### Nearby DOM
...
```
