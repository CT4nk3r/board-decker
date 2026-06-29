import { describe, it, expect } from "vitest";
import { sanitizeAdoHtml } from "./sanitize";

describe("sanitizeAdoHtml", () => {
  it("keeps presentational markup", () => {
    const out = sanitizeAdoHtml('<p>Hello <b>world</b> <a href="https://x.com">link</a></p>');
    expect(out).toContain("<b>world</b>");
    expect(out).toContain('href="https://x.com"');
  });

  it("strips <script> tags", () => {
    const out = sanitizeAdoHtml('<p>ok</p><script>fetch("https://evil.com")</script>');
    expect(out).toContain("<p>ok</p>");
    expect(out.toLowerCase()).not.toContain("<script");
  });

  it("drops inline event handlers", () => {
    const out = sanitizeAdoHtml('<img src="https://x/y.png" onerror="alert(1)">');
    expect(out.toLowerCase()).not.toContain("onerror");
  });

  it("removes javascript: URLs", () => {
    const out = sanitizeAdoHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });

  it("removes iframes and forms", () => {
    const out = sanitizeAdoHtml("<iframe src='https://e'></iframe><form><input></form>");
    expect(out.toLowerCase()).not.toContain("<iframe");
    expect(out.toLowerCase()).not.toContain("<form");
    expect(out.toLowerCase()).not.toContain("<input");
  });
});
