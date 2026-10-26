import { afterEach, expect, it } from "vite-plus/test";

import { themeBootstrap } from "../../src/app/theme-bootstrap";

afterEach(() => {
  document.getElementById("themeBootstrap")?.remove();
  localStorage.removeItem("themeColors");
});

function run(): void {
  const script = document.createElement("script");
  script.textContent = themeBootstrap;
  document.head.appendChild(script);
  script.remove();
}

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
  run();
  expect(document.getElementById("themeBootstrap")?.textContent).toBe(
    ":root:root{--bg-color:#112233;--text-color:rgb(1, 2, 3);}",
  );
});

it.each(["{", "null", "42"])(
  "ignores malformed stored palettes (%s)",
  (value) => {
    localStorage.setItem("themeColors", value);
    expect(() => {
      run();
    }).not.toThrow();
    expect(document.getElementById("themeBootstrap")).toBeNull();
  },
);

it("leaves first visits on the stylesheet's azure default", () => {
  run();
  expect(document.getElementById("themeBootstrap")).toBeNull();
});
