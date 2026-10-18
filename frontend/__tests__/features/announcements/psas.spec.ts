import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import { showPsas } from "../../../src/features/announcements/psas.client";
import { getQueryClient } from "../../../src/ts/queries";
import { getBanners, removeBanner } from "../../../src/ts/states/banners";
import {
  mockOperation,
  ok,
  resetOperations,
} from "../../__harness__/operations";

const psa = (
  id: string,
  message: string,
  level = 0,
): { _id: string; message: string; level: number; sticky: boolean } => ({
  _id: id,
  message,
  level,
  sticky: false,
});

beforeEach(() => {
  resetOperations();
  localStorage.removeItem("confirmedPSAs");
});
afterEach(() => {
  for (const { id } of [...getBanners()]) removeBanner(id);
  getQueryClient().clear();
});

it("banners each announcement once across refetches", async () => {
  mockOperation("psas.get", () =>
    ok([
      psa("aaaaaaaaaaaaaaaaaaaaaaaa", "maintenance"),
      psa("bbbbbbbbbbbbbbbbbbbbbbbb", "new", 1),
    ]),
  );
  const bannered = new Set<string>();
  await showPsas(bannered);
  await showPsas(bannered);

  expect(getBanners().map((banner) => banner.text)).toEqual([
    "maintenance",
    "new",
  ]);
});

it("skips confirmed announcements and clears memory when none remain", async () => {
  localStorage.setItem(
    "confirmedPSAs",
    JSON.stringify(["aaaaaaaaaaaaaaaaaaaaaaaa"]),
  );
  mockOperation("psas.get", () =>
    ok([psa("aaaaaaaaaaaaaaaaaaaaaaaa", "seen")]),
  );
  await showPsas(new Set());
  expect(getBanners()).toHaveLength(0);

  getQueryClient().clear();
  mockOperation("psas.get", () => ok([]));
  await showPsas(new Set());
  expect(localStorage.getItem("confirmedPSAs")).toBe("[]");
});
