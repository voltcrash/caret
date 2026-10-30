import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import { getDefaultConfig } from "../../../src/ts/constants/default-config";
import {
  initialTypingCookie,
  previewSettings,
  readTypingPreview,
  type InitialTypingSnapshot,
} from "../../../src/features/typing/initial-snapshot";
import {
  initialTypingState,
  saveTypingPreview,
  refreshTypingPreviewSettings,
} from "../../../src/features/typing/initial-snapshot.client";

const config = { ...getDefaultConfig(), mode: "words" as const, words: 25 };
const snapshot: InitialTypingSnapshot = {
  version: 1,
  seed: 42,
  key: "a".repeat(64),
  engineHash: "b".repeat(64),
  words: ["hello", "world"],
  settings: previewSettings(config),
};
beforeEach(() => initialTypingState().initialize(snapshot));
afterEach(() => {
  document.cookie = `${initialTypingCookie}=; Path=/; Max-Age=0`;
});

it("reads a bounded, validated first-view snapshot among unrelated cookies", () => {
  expect(
    readTypingPreview(
      `other=1; ${initialTypingCookie}=${encodeURIComponent(JSON.stringify(snapshot))}`,
    ),
  ).toEqual(snapshot);
});

it.each([
  "%zz",
  "%7B",
  "x".repeat(3801),
  encodeURIComponent(JSON.stringify({ ...snapshot, version: 0 })),
  encodeURIComponent(JSON.stringify({ ...snapshot, words: ["x".repeat(257)] })),
])("ignores invalid preview data", (value) => {
  expect(readTypingPreview(`${initialTypingCookie}=${value}`)).toBeUndefined();
});

it("uses a matching generation seed only once", () => {
  expect(initialTypingState().seed("different")).toBeUndefined();
  expect(initialTypingState().seed(snapshot.key)).toBe(42);
  expect(initialTypingState().seed(snapshot.key)).toBeUndefined();
});

it("bounds the cookie while retaining complete words and preferences", () => {
  saveTypingPreview(
    config,
    7,
    snapshot.key,
    Array.from({ length: 60 }, () => "a".repeat(100)),
  );
  expect(document.cookie.length).toBeLessThan(3900);
  const restored = readTypingPreview(document.cookie);
  expect(restored?.seed).toBe(7);
  expect(restored?.settings.words).toBe(25);
  expect(restored?.words.length).toBeGreaterThan(0);
  expect(restored?.words.every((word) => word === "a".repeat(100))).toBe(true);
});

it("never sends local custom text to the server in a preview cookie", () => {
  saveTypingPreview(config, 7, snapshot.key, ["public"]);
  saveTypingPreview({ ...config, mode: "custom" }, 7, snapshot.key, [
    "private-local-text",
  ]);
  expect(readTypingPreview(document.cookie)).toBeUndefined();
  expect(document.cookie).not.toContain("private-local-text");
});

it("saves layout preferences without generating another wordset", () => {
  saveTypingPreview(config, 7, snapshot.key, ["same", "words"]);
  refreshTypingPreviewSettings({
    ...config,
    maxLineWidth: 40,
    keymapMode: "react",
    keymapLegendStyle: "blank",
  });
  const restored = readTypingPreview(document.cookie);
  expect(restored?.settings.maxLineWidth).toBe(40);
  expect(restored?.settings.keymapMode).toBe("react");
  expect(restored?.settings.keymapLegendStyle).toBe("blank");
  expect(restored?.words).toEqual(["same", "words"]);
  expect(restored?.seed).toBe(7);
  expect(restored?.key).toBe(snapshot.key);
});

it("reads previews written before keyboard preferences were included", () => {
  const added = [
    "keymapMode",
    "keymapLayout",
    "keymapStyle",
    "keymapLegendStyle",
    "keymapKeys",
    "keymapSize",
    "layout",
  ];
  const settings = Object.fromEntries(
    Object.entries(snapshot.settings).filter(([key]) => !added.includes(key)),
  );
  expect(
    readTypingPreview(
      `${initialTypingCookie}=${encodeURIComponent(JSON.stringify({ ...snapshot, settings }))}`,
    )?.words,
  ).toEqual(snapshot.words);
});
