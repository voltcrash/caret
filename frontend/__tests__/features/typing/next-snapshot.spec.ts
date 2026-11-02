import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import type { Prepare } from "@caret/typing-engine/browser.client";
import { projectEngineConfig } from "@caret/typing-engine/config";
import { encodeText } from "@caret/typing-engine/text";
import { getDefaultConfig } from "../../../src/ts/constants/default-config";
import { engineLanguage } from "../../../src/features/typing/runtime/content-assets.client";
import { saveNextTypingPreview } from "../../../src/features/typing/next-snapshot.client";
import { saveTypingPreview } from "../../../src/features/typing/initial-snapshot.client";
import {
  initialTypingCookie,
  readTypingPreview,
} from "../../../src/features/typing/initial-snapshot";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  generate: vi.fn(),
  contentDispose: vi.fn(),
  sessionDispose: vi.fn(),
  snapshot: vi.fn(),
  createContent: vi.fn(),
}));
vi.mock("../../../src/features/typing/engine.client", () => ({
  getBrowserEngine: () => ({
    api: () => ({ createContent: mocks.createContent }),
  }),
}));

const config = { ...getDefaultConfig(), mode: "words" as const, words: 25 };
const key = "a".repeat(64);
const engineHash = "b".repeat(64);
const input: Prepare = {
  config: projectEngineConfig(config),
  language: engineLanguage({ name: "english", words: ["next", "test"] }),
  random: { kind: "seeded", state: 42 },
  quotes: null,
  polyglot: [],
  selectedQuoteId: 0,
  favoriteQuoteIds: [],
  sections: [],
  custom: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generate.mockReset();
  mocks.snapshot
    .mockReset()
    .mockReturnValue({ words: [encodeText("next "), encodeText("test")] });
  mocks.createContent.mockReturnValue({
    prepare: mocks.prepare,
    generate: mocks.generate,
    dispose: mocks.contentDispose,
    createSession: () => ({
      snapshot: mocks.snapshot,
      dispose: mocks.sessionDispose,
    }),
  });
  vi.spyOn(crypto, "getRandomValues").mockReturnValue(new Uint32Array([7]));
});
afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = `${initialTypingCookie}=; Path=/; Max-Age=0`;
});

it("saves the next seed with its real engine words using disposable isolated content", () => {
  saveNextTypingPreview(config, input, key, engineHash);
  expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith({
    ...input,
    random: { kind: "seeded", state: 7 },
  });
  expect(input.random).toEqual({ kind: "seeded", state: 42 });
  expect(readTypingPreview(document.cookie)).toMatchObject({
    version: 2,
    seed: 7,
    key,
    engineHash,
    words: ["next ", "test"],
  });
  expect(mocks.sessionDispose).toHaveBeenCalledOnce();
  expect(mocks.contentDispose).toHaveBeenCalledOnce();
});

it.each(["generation", "snapshot"])(
  "clears stale words and releases resources after a %s failure",
  (stage) => {
    saveTypingPreview(config, 42, key, ["already", "played"], engineHash);
    const operation = stage === "generation" ? mocks.generate : mocks.snapshot;
    operation.mockImplementationOnce(() => {
      throw new Error("preview failed");
    });
    expect(() => saveNextTypingPreview(config, input, key, engineHash)).toThrow(
      "preview failed",
    );
    expect(readTypingPreview(document.cookie)).toBeUndefined();
    expect(mocks.contentDispose).toHaveBeenCalledOnce();
    expect(mocks.sessionDispose).toHaveBeenCalledTimes(
      stage === "snapshot" ? 1 : 0,
    );
  },
);

it.each([
  { mode: "custom" as const },
  { mode: "quote" as const },
  { funbox: ["weakspot" as const] },
])(
  "does not prepare or persist private/provider content for %o",
  (settings) => {
    saveTypingPreview(config, 42, key, ["public"], engineHash);
    saveNextTypingPreview({ ...config, ...settings }, input, key, engineHash);
    expect(mocks.createContent).not.toHaveBeenCalled();
    expect(readTypingPreview(document.cookie)).toBeUndefined();
  },
);
