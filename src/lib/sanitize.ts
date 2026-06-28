import DOMPurify, { type Config } from "dompurify";

/**
 * Sanitize Azure DevOps work-item HTML (descriptions, comments) before it is
 * rendered via dangerouslySetInnerHTML. ADO content is attacker-controllable,
 * so we strip scripts, inline event handlers, frames, forms and dangerous URL
 * schemes, leaving only a presentational allowlist. This is the front line for
 * the PAT-exfiltration chain: the Rust proxy and CSP are the other two.
 */
const CONFIG: Config = {
  ALLOWED_TAGS: [
    "a", "b", "strong", "i", "em", "u", "s", "strike", "br", "p", "div", "span",
    "ul", "ol", "li", "blockquote", "pre", "code", "h1", "h2", "h3", "h4", "h5",
    "h6", "table", "thead", "tbody", "tr", "th", "td", "hr", "img",
  ],
  ALLOWED_ATTR: ["href", "src", "alt", "title", "colspan", "rowspan", "target", "rel"],
  ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
  FORBID_TAGS: ["script", "style", "iframe", "form", "object", "embed", "input", "button"],
  FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
  ALLOW_DATA_ATTR: false,
};

// Keep sanitized links from navigating the app webview: force them to open
// externally and strip the opener reference. Combined with the strict CSP this
// stops attacker HTML from steering the renderer away from the local app.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

export function sanitizeAdoHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, CONFIG) as string;
}
