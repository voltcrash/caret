import { expect, it } from "vite-plus/test";

import { mountApplication } from "../../src/app/application";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/test-application";

releaseTestApplication();
import { getBrowserEngine } from "../../src/features/typing/engine.client";
import { projectEngineConfig } from "@caret/typing-engine/config";
import { getMutableConfig } from "../../src/ts/config/store";
import { encodeText } from "@caret/typing-engine/text";

it("imports typing adapters without a mounted app, then recreates and stops each session on remount", async () => {
  const { getTestSession } =
    await import("../../src/features/typing/runtime/events/data");
  const { words } =
    await import("../../src/features/typing/runtime/test-words");
  await import("../../src/features/typing/runtime/test-timer");
  const first = createTestApplication();
  const release = mountApplication(first.application);
  const engine = getBrowserEngine();
  await engine.load();
  engine.beginReplacement().prepare({
    config: projectEngineConfig(getMutableConfig()),
    language: {
      name: "english",
      words: [encodeText("hello")],
      bcp47: null,
      rightToLeft: null,
      joiningScript: false,
      originalPunctuation: false,
      noLazyMode: false,
      additionalAccents: [],
    },
    custom: null,
    quotes: null,
    polyglot: [],
    selectedQuoteId: 1,
    favoriteQuoteIds: [],
    sections: [],
    random: { kind: "seeded", state: 1 },
  });
  engine.createPreparedSession();
  const session = getTestSession();
  session.attach();
  session.start(0);
  words.push("hello ", 0);
  expect(session.isActive()).toBe(true);
  expect(words.length).toBe(1);
  first.dispose();
  release();
  expect(session.isActive()).toBe(false);
  const next = createTestApplication();
  const releaseNext = mountApplication(next.application);
  expect(getTestSession()).not.toBe(session);
  expect(getTestSession().isActive()).toBe(false);
  expect(words.length).toBe(0);
  next.dispose();
  releaseNext();
});
