# Cite

A page-level overlay that turns a clicked DOM element and a written change request into a bundle a coding agent can act on.

## Language

**Annotation**:
A change request attached to one Target on a page.
_Avoid_: Comment, note, ticket, feedback, pin

**Target**:
The captured identity and context of a DOM element: selector, text, HTML, computed CSS, geometry, and URL.
_Avoid_: Element snapshot, payload, node

**Bundle**:
The formatted text produced from one or more Annotations, written for a coding agent to apply. Copying a Bundle removes those Annotations from the page.
_Avoid_: Prompt dump, export, snippet, report

**Inspect**:
The mode in which pointer events select page elements instead of using the page.
_Avoid_: Picker, browse, select mode

**Mark**:
The numbered indicator drawn at a Target's position on the page.
_Avoid_: Pin, badge, hotspot

**Host**:
The isolated overlay the script injects (Shadow DOM) so page CSS cannot style the tool, and the tool cannot leak styles into the page.
_Avoid_: Widget, iframe, layer
