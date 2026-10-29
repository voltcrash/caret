import { afterEach, expect, it } from "vite-plus/test";

import {
  appearanceBootstrap,
  themeBootstrap,
} from "../../src/app/theme-bootstrap";

afterEach(() => {
  document.getElementById("themeBootstrap")?.remove();
  localStorage.removeItem("themeColors");
  localStorage.removeItem("config");
  document.documentElement.removeAttribute("style");
});

function run(source = themeBootstrap): void {
  const script = document.createElement("script");
  script.textContent = source;
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

it("applies saved typography without waiting for browser modules", () => {
  localStorage.setItem(
    "config",
    JSON.stringify({
      fontSize: 3,
      fontFamily: "Lexend_Deca",
      showKeyTips: true,
    }),
  );
  run(appearanceBootstrap);
  const style = document.documentElement.style;
  expect(style.getPropertyValue("--startup-font-size")).toBe("3rem");
  expect(style.getPropertyValue("--font")).toContain('"Lexend Deca"');
  expect(style.getPropertyValue("--startup-keytips-display")).toBe("flex");
});

it("ignores invalid or CSS-bearing appearance preferences", () => {
  localStorage.setItem(
    "config",
    JSON.stringify({ fontSize: -10, fontFamily: 'bad";color:red;' }),
  );
  run(appearanceBootstrap);
  expect(document.documentElement.style.cssText).toBe("");
});
