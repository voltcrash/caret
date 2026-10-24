import { afterEach, expect, it, vi } from "vite-plus/test";

import { themeBootstrap } from "../../src/app/theme-bootstrap";

afterEach(() => {
  document.getElementById("themeBootstrap")?.remove();
  localStorage.removeItem("themeColors");
  localStorage.removeItem("config");
  localStorage.removeItem("defaultTheme");
  vi.restoreAllMocks();
});

function run(random = 0): void {
  vi.spyOn(Math, "random").mockReturnValue(random);
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

it.each([
  [0, "rust", "#180d0d"],
  [0.99, "azure", "#0b0d1c"],
] as const)(
  "picks and paints a flagship theme on a first visit (%s -> %s)",
  (roll, theme, bg) => {
    run(roll);
    expect(localStorage.getItem("defaultTheme")).toBe(theme);
    expect(document.getElementById("themeBootstrap")?.textContent).toContain(
      `--bg-color:${bg};`,
    );
  },
);

it("paints the stored flagship pick without re-rolling", () => {
  localStorage.setItem("defaultTheme", "azure");
  run(0);
  expect(localStorage.getItem("defaultTheme")).toBe("azure");
  expect(document.getElementById("themeBootstrap")?.textContent).toContain(
    "--bg-color:#0b0d1c;",
  );
});

it("leaves returning visitors without saved colors on the stylesheet theme", () => {
  localStorage.setItem("config", "{}");
  run();
  expect(document.getElementById("themeBootstrap")).toBeNull();
  expect(localStorage.getItem("defaultTheme")).toBeNull();
});
