import { describe, expect, it } from "vite-plus/test";

import favicon from "../../../static/images/favicon/oxytype.svg?raw";
import {
  oxytypeIconSvg,
  oxytypeMarkPath,
} from "../../../src/components/brand/oxytype-icon";

describe("oxytypeIconSvg", () => {
  it("matches the committed static favicon", () => {
    expect(favicon.trim()).toBe(oxytypeIconSvg());
  });

  it("places the mark on a full-bleed tile for launcher icons", () => {
    const svg = oxytypeIconSvg(
      { bg: "#000", main: "#fff" },
      { radius: 0, scale: 0.5 },
    );
    expect(svg).toContain('<rect width="48" height="48" rx="0" fill="#000"/>');
    expect(svg).toContain('transform="translate(12 12) scale(0.5)"');
    expect(svg).toContain(`fill="#fff" d="${oxytypeMarkPath}"`);
  });
});
