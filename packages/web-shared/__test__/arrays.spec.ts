import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import {
  nthElementFromArray,
  randomElementFromArray,
  shuffle,
  zipfyRandomArrayIndex,
} from "../src/arrays";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shuffle", () => {
  it("keeps every element", () => {
    const arr = [1, 2, 3, 4, 5, 6];
    shuffle(arr);
    expect([...arr].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("randomElementFromArray", () => {
  it("returns an element of the array", () => {
    const arr = ["a", "b", "c"];
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(randomElementFromArray(arr));
    }
  });
});

describe("nthElementFromArray", () => {
  it("supports negative indexes", () => {
    expect(nthElementFromArray([1, 2, 3], 0)).toBe(1);
    expect(nthElementFromArray([1, 2, 3], -1)).toBe(3);
    expect(nthElementFromArray([1, 2, 3], -4)).toBeUndefined();
  });
});

describe("zipfyRandomArrayIndex", () => {
  it("stays inside the list", () => {
    for (const r of [0, 0.5, 0.999999]) {
      vi.spyOn(Math, "random").mockReturnValue(r);
      const index = zipfyRandomArrayIndex(200);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(200);
    }
  });

  it("favours low indexes", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(zipfyRandomArrayIndex(1000)).toBeLessThan(50);
  });
});
