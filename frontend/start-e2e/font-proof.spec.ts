/** Manual evidence capture, opt in with FONT_PROOF=before|repeat|after. */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { Fonts } from "../src/ts/constants/fonts";
import { test, expect } from "../e2e/fixtures";
import type { Page } from "playwright/test";

const networks = new WeakMap<Page, Promise<object>[]>();
function track(page: Page): void {
  const requests: Promise<object>[] = [];
  networks.set(page, requests);
  page.on("response", (response) => {
    if (!response.url().includes(".woff2")) return;
    requests.push(
      (async () => {
        const body = await response.body();
        const sizes = await response.request().sizes();
        return {
          url: new URL(response.url()).pathname,
          decodedBodyBytes: body.length,
          encodedBodyBytes: sizes.responseBodySize,
          transferBytes: sizes.responseBodySize + sizes.responseHeadersSize,
        };
      })(),
    );
  });
}
const phase = process.env["FONT_PROOF"];
const output = resolve(
  import.meta.dirname,
  "../../docs/font-evidence",
  phase ?? "unused",
);
test.skip(phase === undefined, "Manual font proof only");
test.use({
  serviceWorkers: "block",
  trace: "off",
  viewport: { width: 1440, height: 1000 },
  locale: "en-US",
  timezoneId: "UTC",
  colorScheme: "dark",
});

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function capture(page: Page, name: string, idle = true): Promise<void> {
  mkdirSync(output, { recursive: true });
  if (idle) {
    await settle(page);
  } else {
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const root = await cdp.send("DOM.getDocument", { depth: -1 });
  const rendered = [];
  for (const selector of [
    "#words .word",
    "#result",
    "p",
    "h1",
    '[data-ui-element="logoText"]',
    "#commandLine",
    "body",
  ]) {
    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: root.root.nodeId,
      selector,
    });
    if (nodeId) {
      rendered.push({
        selector,
        ...(await cdp.send("CSS.getPlatformFontsForNode", { nodeId })),
      });
    }
  }
  const data = await page.evaluate(() => ({
    preloads: [
      ...document.querySelectorAll<HTMLLinkElement>('link[as="font"]'),
    ].map((l) => l.getAttribute("href")),
    fonts: performance
      .getEntriesByType("resource")
      .filter((e) => e.name.includes(".woff2"))
      .map((e) => {
        const r = e as PerformanceResourceTiming;
        return {
          url: new URL(r.name).pathname,
          transferBytes: r.transferSize,
          encodedBodyBytes: r.encodedBodySize,
          decodedBodyBytes: r.decodedBodySize,
        };
      }),
    faces: [...document.fonts]
      .filter((f) => f.status === "loaded")
      .map((f) => ({
        family: f.family,
        weight: f.weight,
        style: f.style,
        display: f.display,
        unicodeRange: f.unicodeRange,
      })),
    text: document.body.innerText,
    words: document.querySelector("#words")?.textContent,
    stack: getComputedStyle(document.body).fontFamily,
  }));
  await page.screenshot({
    path: resolve(output, `${name}.png`),
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });
  writeFileSync(
    resolve(output, `${name}.json`),
    `${JSON.stringify(
      {
        baselineRevision: "7699fef52",
        nodeVersion: process.version,
        systemFontFixture: process.env["FONTCONFIG_FILE"] ?? "system defaults",
        browser: page.context().browser()?.version(),
        viewport: page.viewportSize(),
        dpr: await page.evaluate(() => devicePixelRatio),
        os: process.platform,
        arch: process.arch,
        locale: "en-US",
        timezone: "UTC",
        theme: name.startsWith("specimen-")
          ? "specimen-gray"
          : ["core-only", "extended-only"].includes(name)
            ? "browser-default"
            : "serika_dark",
        seed:
          name.startsWith("specimen-") ||
          ["core-only", "extended-only"].includes(name)
            ? null
            : 4242,
        ...data,
        fonts: await Promise.all(networks.get(page) ?? []),
        rendered,
      },
      null,
      2,
    )}\n`,
  );
  await cdp.detach();
}

test.beforeEach(async ({ page }) => {
  track(page);
  await page.clock.setFixedTime(new Date("2026-01-01T12:00:00Z"));
  await page.addInitScript(() => {
    let state = 4242;
    Math.random = () =>
      (state = (1664525 * state + 1013904223) >>> 0) / 4294967296;
    crypto.getRandomValues = <T extends ArrayBufferView | null>(
      array: T,
    ): T => {
      if (array) {
        const bytes = new Uint8Array(
          array.buffer,
          array.byteOffset,
          array.byteLength,
        );
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = [0x92, 0x10, 0, 0][i % 4] ?? 0;
        }
      }
      return array;
    };
    localStorage.setItem(
      "config",
      JSON.stringify({
        mode: "words",
        words: 15,
        quickRestart: "off",
        smoothCaret: "off",
        caretStyle: "off",
        theme: "serika_dark",
        showKeyTips: false,
      }),
    );
  });
});

for (const scenario of [
  { name: "default", route: "/" },
  {
    name: "code",
    route: "/",
    fontFamily: "Fira_Code",
    text: "const add = (a, b) => a !== b && a <= 42; // ffi -> ===",
  },
  {
    name: "accents",
    route: "/",
    text: "café naïve Ångström Őrült Łódź é Å ā co­operate non‑breaking space “quotes”—dash…",
  },
  {
    name: "arabic",
    route: "/",
    language: "arabic",
    text: "السَّلَامُ عَلَيْكُمْ لا لأ لإ آ فارسی می‌روم",
  },
  {
    name: "thai",
    route: "/",
    language: "thai",
    text: "ภาษาไทย น้ำ กิ กี่ ผู้ใหญ่ สวัสดี",
  },
  { name: "lao", route: "/", language: "lao", text: "ພາສາລາວ ສະບາຍດີ ນ້ຳ ເມືອງ" },
  {
    name: "cjk",
    route: "/",
    text: "中文 漢字 日本語 ひらがな カタカナ 한국어",
  },
  {
    name: "thai-boon",
    route: "/",
    fontFamily: "Boon",
    language: "thai",
    text: "ภาษาไทย น้ำ กิ กี่ ผู้ใหญ่ สวัสดี",
  },
  {
    name: "lao-noto",
    route: "/",
    fontFamily: "Noto_Sans_Lao",
    language: "lao",
    text: "ພາສາລາວ ສະບາຍດີ ນ້ຳ ເມືອງ",
  },
  {
    name: "arabic-naskh",
    route: "/",
    fontFamily: "Noto_Naskh_Arabic",
    language: "arabic",
    text: "السَّلَامُ عَلَيْكُمْ لا لأ لإ آ فارسی می‌روم",
  },
  { name: "settings", route: "/settings#group_appearance" },
  { name: "commands", route: "/" },
  { name: "privacy", route: "/privacy-policy.html" },
  { name: "public", route: "/about" },
  { name: "not-found", route: "/font-proof-missing" },
  { name: "loader", route: "/" },
  { name: "result", route: "/" },
]) {
  test(`font route ${scenario.name}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(
      (s) => {
        const config = JSON.parse(
          localStorage.getItem("config") ?? "{}",
        ) as Record<string, unknown>;
        if (s.text !== undefined) {
          config["mode"] = "custom";
          localStorage.setItem(
            "customTextSettings",
            JSON.stringify({
              text: s.text.split(" "),
              mode: "repeat",
              limit: { mode: "word", value: s.text.split(" ").length },
              pipeDelimiter: false,
            }),
          );
        }
        if (s.language !== undefined) config["language"] = s.language;
        if (s.fontFamily !== undefined) config["fontFamily"] = s.fontFamily;
        localStorage.setItem("config", JSON.stringify(config));
      },
      {
        text: "text" in scenario ? scenario.text : undefined,
        language: "language" in scenario ? scenario.language : undefined,
        fontFamily: "fontFamily" in scenario ? scenario.fontFamily : undefined,
      },
    );
    if (scenario.name === "result" || scenario.name === "commands") {
      await page.clock.install({ time: new Date("2026-01-01T12:00:00Z") });
      await page.clock.pauseAt(new Date("2026-01-01T12:00:01Z"));
    }
    let release = (): void => undefined;
    if (scenario.name === "loader") {
      const pending = new Promise<void>((r) => {
        release = r;
      });
      await page.route("**/assets/page.client-*.js", async (route) => {
        await pending;
        await route.continue();
      });
    }
    try {
      await page.goto(scenario.route, { waitUntil: "domcontentloaded" });
      if (scenario.route === "/" && scenario.name !== "loader") {
        await expect(page.locator("#words .word").first()).toBeVisible();
      }
      if (scenario.name === "settings") {
        await page
          .getByText("font family", { exact: true })
          .last()
          .scrollIntoViewIfNeeded();
      }
      if (scenario.name === "commands") {
        await settle(page);
        await page.locator("#words .word").first().click();
        await expect(page.locator("#wordsInput")).toBeFocused();
        await settle(page);
        await page.keyboard.press("ControlOrMeta+k");
        await page.locator("#commandLine input").fill("font family");
        await page.clock.runFor(1000);
        await expect(page.locator("#commandLine")).toBeVisible();
        await expect(page.locator("#commandLine")).toHaveCSS("opacity", "1");
        await expect(
          page
            .locator("#commandLine")
            .getByText("Boon (ไทย)", { exact: false }),
        ).toBeVisible();
      }
      if (scenario.name === "result") {
        await page.locator("#words .word").first().click();
        const words = await page.locator("#words .word").allTextContents();
        for (const character of words.join(" ")) {
          await page.keyboard.type(character);
          await page.clock.runFor(100);
        }
        await page.clock.runFor(3000);
        await expect(page.locator("#result")).toBeVisible();
      }
      if (scenario.name === "loader") {
        // Only the requested route chunk is held. The real SSR shell remains.
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        await expect(page.locator("[data-initial-typing]")).toBeVisible();
      }
      await capture(page, scenario.name, scenario.name !== "loader");
    } finally {
      release();
    }
  });
}

test("all font specimens and core/extended network isolation", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const assets = resolve(import.meta.dirname, "../dist/start/client/assets");
  const builtCss = readdirSync(assets)
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(resolve(assets, name), "utf8"))
    .join("\n");
  let css = [...builtCss.matchAll(/@font-face\s*\{[^}]+\}/g)]
    .map((match) => match[0])
    .join("\n");
  const trial = process.env["FONT_PROOF_ASSETS"];
  if (trial !== undefined) {
    const meta = JSON.parse(
      readFileSync(resolve(trial, "metadata.json"), "utf8"),
    ) as Record<
      string,
      { file: string; unicodeRange: string; split?: boolean }[]
    >;
    const entries = [
      ...Object.entries(Fonts).flatMap(([name, f]) =>
        f.systemFont
          ? []
          : [
              {
                family: name.replaceAll("_", " "),
                source: f.fileName,
                weight: f.weight ?? 400,
              },
            ],
      ),
      {
        family: "Vazirharf",
        source: "Vazirharf-NL-Regular.woff2",
        weight: 400,
      },
    ];
    css = entries
      .flatMap((font) =>
        (meta[font.source] ?? []).map(
          (part) =>
            `@font-face{font-family:'${font.family}';font-weight:${font.weight};font-style:normal;font-display:swap;src:url('/webfonts/${part.file}') format('woff2');${part.split === false ? "" : `unicode-range:${part.unicodeRange};`}}`,
        ),
      )
      .join("\n");
  }
  const fonts: { family: string; weight: number; variation?: true }[] = [
    ...Object.entries(Fonts)
      .filter(([, f]) => !f.systemFont)
      .map(([name, f]) => ({
        family: name.replaceAll("_", " "),
        weight: f.weight ?? 400,
      })),
    { family: "Vazirharf", weight: 400 },
    { family: "Adwaita Mono", weight: 400, variation: true },
    { family: "Iosevka", weight: 400, variation: true },
  ];
  const standardSample =
    "AV To Té Tě Tø VÁ AŠ Ťo Příliš fi ffi -> => !== === <= 0123456789 café Ő Ł é é Å ā ạ “quotes”—… \u2010 \u00ad \u00a0 Ελληνικά Русский لا لأ لإ السَّلَامُ فارسی می‌روم น้ำ กิ กี่ ນ້ຳ 中文 日本語 한국어";
  const browser = page.context().browser();
  if (browser === null) throw new Error("Browser required for font proof");
  for (const font of fonts) {
    if (process.env["FONT_PROOF_VARIATIONS_ONLY"] === "1" && !font.variation) {
      continue;
    }
    const sample = font.variation
      ? "0123456789 0 0\uFE00 00 0\uFE000\uFE00 AV To café é"
      : standardSample;
    if (trial !== undefined) {
      const metadata = readFileSync(resolve(trial, "metadata.json"), "utf8");
      const source =
        font.family === "Vazirharf"
          ? "Vazirharf-NL-Regular.woff2"
          : Object.entries(Fonts).find(
              ([name]) => name.replaceAll("_", " ") === font.family,
            )?.[1].fileName;
      if (
        source === undefined ||
        !(source in (JSON.parse(metadata) as Record<string, unknown>))
      ) {
        continue;
      }
    }
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      serviceWorkers: "block",
      locale: "en-US",
      timezoneId: "UTC",
    });
    const specimen = await context.newPage();
    track(specimen);
    if (trial !== undefined) {
      await specimen.route("**/webfonts/*", async (route) =>
        route.fulfill({
          path: resolve(
            trial,
            basename(new URL(route.request().url()).pathname),
          ),
        }),
      );
    }
    await specimen.route("**/font-specimen", async (route) =>
      route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html><html><head><meta charset="utf-8"><style>${css} body{margin:24px;background:#202020;color:#ddd;font-family:'${font.family}',monospace;font-weight:${font.weight}}p{margin:16px 0;line-height:1.5}</style></head><body><h1>${font.family}</h1>${[8, 9, 11, 12, 16, 24, 32, 64].map((size) => `<p style="font-size:${size}px">${sample.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}<br><span style="font-weight:300">light AV café ffi</span> <span style="font-weight:500">medium AV café ffi</span> <span style="font-weight:600">semibold AV café ffi</span><br><i>italic AV café é لا <b>bold inside italic ffi น้ำ</b></i> <b>bold AV café é لا ffi</b></p>`).join("")}</body></html>`,
      }),
    );
    await specimen.goto("http://127.0.0.1:4185/font-specimen");
    await specimen.evaluate(
      async ({ family, weight, sample }) => {
        await document.fonts.load(`${weight} 16px "${family}"`, sample);
        await document.fonts.ready;
      },
      { ...font, sample },
    );
    await capture(
      specimen,
      `specimen-${font.family.replaceAll(" ", "_")}${font.variation ? "-variation" : ""}`,
    );
    await context.close();
  }
  if (trial !== undefined) {
    const metadata = JSON.parse(
      readFileSync(resolve(trial, "metadata.json"), "utf8"),
    ) as Record<string, unknown>;
    if (!("RobotoMono-Regular.woff2" in metadata)) return;
  }
  for (const [name, text] of [
    ["core-only", "ASCII AV To -> != 123"],
    ["extended-only", "Ω"],
  ] as const) {
    const context = await browser.newContext({ serviceWorkers: "block" });
    const isolated = await context.newPage();
    track(isolated);
    if (trial !== undefined) {
      await isolated.route("**/webfonts/*", async (route) =>
        route.fulfill({
          path: resolve(
            trial,
            basename(new URL(route.request().url()).pathname),
          ),
        }),
      );
    }
    await isolated.route("**/font-specimen", async (route) =>
      route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html><meta charset="utf-8"><style>${css}body{font-family:'Roboto Mono'}</style><body>${text}</body>`,
      }),
    );
    await isolated.goto("http://127.0.0.1:4185/font-specimen");
    await capture(isolated, name);
    await context.close();
  }
});
