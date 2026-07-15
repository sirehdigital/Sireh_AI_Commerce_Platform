import { describe, expect, it } from "vitest";

import { HtmlVerificationNormalizer } from "./html-verification-normalizer.js";

describe("HtmlVerificationNormalizer", () => {
  const normalizer = new HtmlVerificationNormalizer();

  it("passes identical raw HTML", () => {
    const result = normalizer.compare("<p>Hello world</p>", "<p>Hello world</p>");
    expect(result).toEqual(expect.objectContaining({ equivalent: true, rawStringsEqual: true }));
  });

  it("passes Shopify-only whitespace and line-ending normalization", () => {
    const expected = "<section><h2>Title</h2><p>Hello   world.</p></section>";
    const actual = "<section>\r\n  <h2>Title</h2>\r\n<p>Hello world.</p>\r\n</section>";
    const result = normalizer.compare(expected, actual);
    expect(result).toEqual(
      expect.objectContaining({ equivalent: true, rawStringsEqual: false, canonicalStringsEqual: true }),
    );
  });

  it("fails when text content differs", () => {
    expect(normalizer.compare("<p>Hello</p>", "<p>Goodbye</p>").equivalent).toBe(false);
  });

  it("fails when an element is missing", () => {
    expect(normalizer.compare("<section><h2>Title</h2><p>Body</p></section>", "<section><p>Body</p></section>").equivalent).toBe(false);
  });

  it("fails when an attribute differs", () => {
    expect(normalizer.compare('<p class="lead">Body</p>', '<p class="body">Body</p>').equivalent).toBe(false);
  });

  it("fails when a URL differs", () => {
    expect(normalizer.compare('<a href="https://a.example/x">Link</a>', '<a href="https://b.example/x">Link</a>').equivalent).toBe(false);
  });

  it("fails when meaningful elements are reordered", () => {
    expect(normalizer.compare("<h2>First</h2><p>Second</p>", "<p>Second</p><h2>First</h2>").equivalent).toBe(false);
  });

  it.each(["pre", "code", "textarea", "script", "style"])(
    "keeps %s content whitespace-sensitive",
    (tag) => {
      expect(normalizer.compare(`<${tag}>a  b</${tag}>`, `<${tag}>a b</${tag}>`).equivalent).toBe(false);
    },
  );

  it("produces deterministic canonical hashes", () => {
    const first = normalizer.compare('<p id="x" class="y">Text</p>', '<p class="y" id="x">Text</p>');
    const second = normalizer.compare('<p id="x" class="y">Text</p>', '<p class="y" id="x">Text</p>');
    expect(first.expectedCanonicalHash).toBe(second.expectedCanonicalHash);
    expect(first.actualCanonicalHash).toBe(second.actualCanonicalHash);
    expect(first.equivalent).toBe(true);
  });

  it.each([
    ["unclosed element", "<section><p>Body</section>"],
    ["unclosed attribute", '<p class="lead>Body</p>'],
    ["duplicate attribute", '<p class="a" class="b">Body</p>'],
    ["processing instruction", "<?unsafe value?><p>Body</p>"],
  ])("fails closed for malformed HTML: %s", (_name, html) => {
    const result = normalizer.compare(html, html);
    expect(result.equivalent).toBe(false);
    expect(result.differenceReason).toContain("Fail-closed");
  });
});
