import { runInNewContext } from "node:vm";
import { afterEach, expect, it } from "vite-plus/test";

import { themeBootstrap } from "../../src/app/theme-bootstrap";

afterEach(() => {
  document.getElementById("themeBootstrap")?.remove();
  localStorage.removeItem("themeColors");
});

it("paints only saved theme colors without touching application state", () => {
  localStorage.setItem(
    "themeColors",
    JSON.stringify({
      "bg-color": "#112233",
      "text-color": "rgb(1, 2, 3)",
      font: "evil",
      "main-color": "</style><script>alert(1)</script>",
    }),
  );
  runInNewContext(themeBootstrap, { document, localStorage });
  expect(document.getElementById("themeBootstrap")?.textContent).toBe(
    ":root:root{--bg-color:#112233;--text-color:rgb(1, 2, 3);}",
  );
});

it.each(["{", "null", "42"])(
  "ignores malformed stored palettes (%s)",
  (value) => {
    localStorage.setItem("themeColors", value);
    expect(() => {
      runInNewContext(themeBootstrap, { document, localStorage });
    }).not.toThrow();
    expect(document.getElementById("themeBootstrap")).toBeNull();
  },
);
