# Cite

Click anything on a web page. Tell a coding agent what to change.

Cite is a single embeddable script. It injects an isolated overlay (Shadow DOM), captures the clicked element, and copies a bundle — selector, HTML, computed CSS, nearby DOM, and the written request — ready to paste into Claude, Cursor, or Codex.

No accounts. No backend. No build step.

## Embed

```html
<script
  src="https://yourtool.com/cite.js"
  data-project="abc123"
></script>
```

`data-project` only namespaces localStorage. It is optional.

## Local demo

```bash
python3 -m http.server 4173
```

Open [http://localhost:4173/demo/](http://localhost:4173/demo/).

## Use

1. Click **Inspect** (or press `Alt+A`).
2. Click an element. Links and buttons will not fire.
3. Write the change. `⌘Enter` / `Ctrl+Enter` saves. `Esc` cancels.
4. Click **Copy for agent** and paste the bundle into an agent.

Annotations persist per page in `localStorage`. Marks stay on the page so you can stack several requests, then copy them as one bundle.

## Bundle

The copied text looks like this:

```text
The following are visual change requests captured from a web page.
Apply each request to the matching element.

Page: /demo/pricing.html
Title: Pricing — Harbor
URL: http://localhost:4173/demo/pricing.html

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
