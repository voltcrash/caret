import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import { showPsas } from "../../../src/features/announcements/psas.client";
import { getQueryClient } from "../../../src/ts/queries";
import { getBanners, removeBanner } from "../../../src/ts/states/banners";
import { getPsas, type AlertPsa } from "../../../src/ts/states/psas";
import {
  mockOperation,
  ok,
  resetOperations,
} from "../../__harness__/operations";

const alerts = (): AlertPsa[] => getPsas().map((alert) => ({ ...alert }));

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

it("lists announcements and banners each one once across refetches", async () => {
  mockOperation("psas.get", () =>
    ok([
      psa("aaaaaaaaaaaaaaaaaaaaaaaa", "maintenance"),
      psa("bbbbbbbbbbbbbbbbbbbbbbbb", "new", 1),
    ]),
  );
  const bannered = new Set<string>();
  await showPsas(bannered);
  await showPsas(bannered);

  expect(alerts()).toEqual([
    { message: "maintenance", level: 0 },
    { message: "new", level: 1 },
  ]);
  expect(getBanners().map((banner) => banner.text)).toEqual([
    "maintenance",
    "new",
  ]);
});

it("skips confirmed announcements and clears the list when none remain", async () => {
  localStorage.setItem(
    "confirmedPSAs",
    JSON.stringify(["aaaaaaaaaaaaaaaaaaaaaaaa"]),
  );
  mockOperation("psas.get", () =>
    ok([psa("aaaaaaaaaaaaaaaaaaaaaaaa", "seen")]),
  );
  await showPsas(new Set());
  expect(alerts()).toEqual([{ message: "seen", level: 0 }]);
  expect(getBanners()).toHaveLength(0);

  getQueryClient().clear();
  mockOperation("psas.get", () => ok([]));
  await showPsas(new Set());
  expect(alerts()).toEqual([]);
  expect(localStorage.getItem("confirmedPSAs")).toBe("[]");
});
