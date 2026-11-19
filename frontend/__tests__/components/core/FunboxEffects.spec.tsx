import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { FunboxEffects } from "../../../src/features/typing/components/FunboxEffects";
import { setCrt, setFunboxStylesheets } from "../../../src/ts/states/funbox";

afterEach(() => {
  cleanup();
  setCrt(null);
  setFunboxStylesheets([]);
});
describe("Funbox effects", () => {
  it("recreates stylesheet links on activation and removes cleared ones", () => {
    render(() => <FunboxEffects />);
    setFunboxStylesheets([{ name: "mirror" }, { name: "crt" }]);
    const links = document.head.querySelectorAll(".funBoxTheme");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "funbox/mirror.css");
    setFunboxStylesheets([{ name: "mirror" }]);
    expect(document.head.querySelectorAll(".funBoxTheme")).toHaveLength(1);
    expect(document.head.querySelector(".funBoxTheme")).not.toBe(links[0]);
    setFunboxStylesheets([]);
    expect(document.head.querySelector(".funBoxTheme")).toBeNull();
  });
  it("keeps global CSS in the body and restarts the CRT scanline", () => {
    const { container } = render(() => <FunboxEffects />);
    const link = container.querySelector("#globalFunBoxTheme");
    expect(link).toHaveAttribute("href", "");
    setCrt({});
    expect(link).toHaveAttribute("href", "funbox/crt.css");
    const scanline = container.querySelector("#scanline");
    expect(scanline).not.toBeNull();
    setCrt({});
    expect(container.querySelector("#scanline")).not.toBe(scanline);
    setCrt(null);
    expect(link).toHaveAttribute("href", "");
    expect(container.querySelector("#scanline")).toBeNull();
  });
});
