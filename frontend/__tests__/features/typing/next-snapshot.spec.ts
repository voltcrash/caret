import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { encodeText } from "@caret/typing-engine/text";
import { getDefaultConfig } from "../../../src/ts/constants/default-config";
import { saveNextTypingPreview } from "../../../src/features/typing/next-snapshot.client";
import { saveTypingPreview } from "../../../src/features/typing/initial-snapshot.client";
import {
  initialTypingCookie,
  readTypingPreview,
} from "../../../src/features/typing/initial-snapshot";

const content = { preview: vi.fn() };

const config = { ...getDefaultConfig(), mode: "words" as const, words: 25 };
const key = "a".repeat(64);
const engineHash = "b".repeat(64);
beforeEach(() => {
  content.preview
    .mockReset()
    .mockReturnValue([encodeText("next "), encodeText("test")]);
  vi.spyOn(crypto, "getRandomValues").mockReturnValue(new Uint32Array([7]));
});
afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = `${initialTypingCookie}=; Path=/; Max-Age=0`;
});

it("samples the next seed from prepared content without transferring assets", () => {
  saveNextTypingPreview(config, content, key, engineHash);
  expect(content.preview).toHaveBeenCalledExactlyOnceWith(7);
  expect(readTypingPreview(document.cookie)).toMatchObject({
    version: 2,
    seed: 7,
    key,
    engineHash,
    words: ["next ", "test"],
  });
});

it("clears a consumed preview if sampling fails", () => {
  saveTypingPreview(config, 42, key, ["already", "played"], engineHash);
  content.preview.mockImplementationOnce(() => {
    throw new Error("preview failed");
  });
  expect(() => saveNextTypingPreview(config, content, key, engineHash)).toThrow(
    "preview failed",
  );
  expect(readTypingPreview(document.cookie)).toBeUndefined();
});

it.each([
  { mode: "custom" as const },
  { mode: "quote" as const },
  { funbox: ["weakspot" as const] },
])(
  "does not prepare or persist private/provider content for %o",
  (settings) => {
    saveTypingPreview(config, 42, key, ["public"], engineHash);
    saveNextTypingPreview({ ...config, ...settings }, content, key, engineHash);
    expect(content.preview).not.toHaveBeenCalled();
    expect(readTypingPreview(document.cookie)).toBeUndefined();
  },
);
