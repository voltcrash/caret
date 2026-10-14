import { describe, expect, it } from "vite-plus/test";
import { releaseNotesToHtml } from "../../src/ts/utils/release-notes";

describe("releaseNotesToHtml", () => {
  it.each(["<script>alert(1)</script>", '<img src="x" onerror="alert(1)">'])(
    "renders release input as text: %s",
    (input) => {
      const body = document.createElement("div");
      body.innerHTML = releaseNotesToHtml(input);
      expect(body.textContent).toBe(input);
      expect(body.querySelector("script, img")).toBeNull();
    },
  );

  it("renders headings, lists and paragraphs with unix newlines", () => {
    expect(
      releaseNotesToHtml(
        "### Features\n\n- add a\n- add b\n\nThanks to\neveryone\n",
      ),
    ).toBe(
      "<h3>Features</h3><ul><li>add a</li><li>add b</li></ul><p>Thanks to everyone</p>",
    );
  });

  it("handles windows newlines", () => {
    expect(releaseNotesToHtml("### Fixes\r\n\r\n- fix a\r\n")).toBe(
      "<h3>Fixes</h3><ul><li>fix a</li></ul>",
    );
  });

  it("renders links, bold and code", () => {
    expect(
      releaseNotesToHtml(
        "- **settings:** add `x` ([abc1234](https://github.com/o/r/commit/abc))",
      ),
    ).toBe(
      '<ul><li><b>settings:</b> add <code>x</code> (<a href="https://github.com/o/r/commit/abc" target="_blank" rel="noopener noreferrer">abc1234</a>)</li></ul>',
    );
  });

  it("unescapes markdown escapes without rendering them", () => {
    expect(
      releaseNotesToHtml(
        "fix \\[link\\](https://example.com) \\<img\\> \\`a\\`",
      ),
    ).toBe("<p>fix [link](https://example.com) &lt;img&gt; `a`</p>");
  });

  it("escapes html and drops comments", () => {
    expect(
      releaseNotesToHtml('<img src="x" onerror="y">\n\n<!-- marker -->\n'),
    ).toBe("<p>&lt;img src=&quot;x&quot; onerror=&quot;y&quot;&gt;</p>");
  });

  it("does not link non http urls", () => {
    expect(releaseNotesToHtml("[x](javascript:alert(1))")).toBe(
      "<p>[x](javascript:alert(1))</p>",
    );
  });
});
