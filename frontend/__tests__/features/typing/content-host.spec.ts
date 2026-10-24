import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import retry from "../../../../packages/typing-fixtures/oracle/wikipedia-retry.json" with { type: "json" };
import { EngineFailure } from "@oxytype/typing-engine/failure";
import { decodeText } from "@oxytype/typing-engine/text";
const mocks = vi.hoisted(() => ({
  controller: new AbortController(),
  prepare: vi.fn(),
  generate: vi.fn(),
  supply: vi.fn(),
  failSource: vi.fn(),
  updateQuoteQueue: vi.fn(),
  quoteCatalog: vi.fn(),
  request: { id: 1, generation: 1, kind: "wikipedia", language: "english" },
  sessionCommand: vi.fn<(command: { op: string; request?: unknown }) => void>(),
  getLanguage: vi.fn(),
  cachedFetchJson: vi.fn(),
  createSession: vi.fn(),
}));
vi.mock("../../../src/features/typing/engine.client", () => ({
  getBrowserEngine: () => ({
    load: async () => undefined,
    status: () => ({ state: "ready" }),
    beginReplacement: () => ({
      prepare: mocks.prepare,
      generate: mocks.generate,
      supply: mocks.supply,
      failSource: mocks.failSource,
      request: () => mocks.request,
      metadata: () => ({ currentQuote: null }),
    }),
    captureSession: () => {
      const signal = mocks.controller.signal;
      return { signal, isCurrent: () => !signal.aborted };
    },
    createPreparedSession: mocks.createSession,
    content: () => ({
      updateQuoteQueue: mocks.updateQuoteQueue,
      quoteCatalog: mocks.quoteCatalog,
    }),
  }),
}));
vi.mock("../../../src/features/typing/runtime/session.client", () => ({
  getEngineSession: () => ({
    attach: () => ({ words: [[97]], sectionIndexes: [0] }),
    command: mocks.sessionCommand,
  }),
}));
vi.mock("../../../src/ts/utils/json-data", () => ({
  getLanguage: mocks.getLanguage,
  cachedFetchJson: mocks.cachedFetchJson,
}));
vi.mock("../../../src/ts/db", () => ({ getSnapshot: () => null }));
import { mountApplication } from "../../../src/app/application";
import { getMutableConfig } from "../../../src/ts/config/store";
import { getContentHost } from "../../../src/features/typing/runtime/content.client";
import {
  createTestApplication,
  releaseTestApplication,
} from "../../__harness__/mock-application";
releaseTestApplication();
let dispose: () => void;
const language = { name: "english", words: ["a"], bcp47: "en" } as const;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.controller = new AbortController();
  mocks.prepare.mockReset();
  mocks.supply.mockReset();
  mocks.sessionCommand.mockReset();
  mocks.generate.mockReset().mockReturnValue({
    words: [[97, 32]],
    sectionIndexes: [0],
    hasTab: false,
    hasNewline: false,
    allRightToLeft: null,
    allJoiningScript: false,
  });
  mocks.getLanguage
    .mockReset()
    .mockResolvedValue({ ...language, words: [...language.words] });
  mocks.cachedFetchJson.mockReset().mockResolvedValue({
    language: "english",
    groups: [
      [0, 10],
      [11, 20],
      [21, 30],
      [31, 100],
    ],
    quotes: [{ id: 1, text: "a quote", length: 7, source: "Source" }],
  });
  const app = createTestApplication();
  const release = mountApplication(app.application);
  dispose = () => {
    release();
    app.dispose();
  };
  Object.assign(getMutableConfig(), {
    mode: "words",
    words: 1,
    language: "english",
    funbox: ["wikipedia"],
  });
});
afterEach(() => {
  dispose();
  vi.unstubAllGlobals();
});

it("retries the same pending native request after empty cleanup, matching original fetch ordering", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (let index = 0; index < 2; index++) {
    fetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: `Article ${index + 1}`,
            author: "Writer",
            pageid: index + 1,
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            query: {
              pages: { [index + 1]: { extract: retry.extracts[index] } },
            },
          }),
        ),
      );
  }
  vi.stubGlobal("fetch", fetch);
  mocks.generate.mockImplementationOnce(() => {
    throw new EngineFailure({
      code: "contentRequired",
      message: "Content required",
      recovery: [],
    });
  });
  mocks.supply.mockImplementationOnce(() => {
    throw new EngineFailure({
      code: "emptyContent",
      message: "Section has no words",
      recovery: [],
    });
  });
  await getContentHost().prepare({ ...language, words: [...language.words] });
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(retry.requests);
  expect(mocks.supply).toHaveBeenCalledTimes(2);
  for (const [index, call] of mocks.supply.mock.calls.entries()) {
    expect(call[0]).toEqual(mocks.request);
    expect(decodeText(call[1].plainText)).toBe(retry.extracts[index]);
  }
  expect(mocks.failSource).not.toHaveBeenCalled();
  expect(mocks.createSession).toHaveBeenCalledExactlyOnceWith(false);
});

it("does not supply or report failure after a pending source was cancelled", async () => {
  const loaded = Promise.withResolvers<{
    name: string;
    words: string[];
    bcp47: string;
  }>();
  mocks.getLanguage.mockReturnValueOnce(loaded.promise);
  mocks.generate.mockImplementationOnce(() => {
    throw new EngineFailure({
      code: "contentRequired",
      message: "Content required",
      recovery: [],
    });
  });
  const pending = getContentHost().prepare({
    ...language,
    words: [...language.words],
  });
  await vi.waitFor(() => expect(mocks.getLanguage).toHaveBeenCalledOnce());
  mocks.controller.abort();
  loaded.resolve({ ...language, words: [...language.words] });
  await expect(pending).rejects.toThrow();
  expect(mocks.supply).not.toHaveBeenCalled();
  expect(mocks.failSource).not.toHaveBeenCalled();
  expect(mocks.createSession).not.toHaveBeenCalled();
});

it("refreshes quote lengths after failed selection and retains the raw cached-language asset", async () => {
  Object.assign(getMutableConfig(), { mode: "quote", funbox: [] });
  mocks.prepare.mockImplementationOnce(() => {
    throw new EngineFailure({
      code: "noQuoteLength",
      message: "No quotes found for selected quote length",
      recovery: [{ op: "setQuoteLengthAll" }],
    });
  });
  const host = getContentHost();
  await expect(
    host.prepare({ ...language, words: [...language.words] }),
  ).rejects.toThrow("No quotes found");
  host.quoteLengthsChanged([0, 1, 2, 3]);
  expect(mocks.updateQuoteQueue).toHaveBeenCalledWith(
    [0, 1, 2, 3],
    expect.objectContaining({ kind: "seeded" }),
  );
  const generated = await host.prepare({
    ...language,
    words: [...language.words],
  });
  expect(generated.words).toEqual(["a"]); // Owned session snapshot has the final separator stripped.
  expect(mocks.cachedFetchJson).toHaveBeenCalledOnce();
  expect(mocks.prepare.mock.calls[0]?.[0].quotes).toEqual(
    mocks.prepare.mock.calls[1]?.[0].quotes,
  );
});

it("shares one source fetch and one supply command for repeated observations of the same token", async () => {
  const loaded = Promise.withResolvers<{
    name: string;
    words: string[];
    bcp47: string;
  }>();
  mocks.getLanguage.mockReturnValueOnce(loaded.promise);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            { title: "Poem", author: "Writer", lines: ["raw _words"] },
          ]),
        ),
    ),
  );
  const host = getContentHost();
  const request = { ...mocks.request, kind: "poetry" };
  const first = host.supplyActive(request);
  expect(host.supplyActive(request)).toBe(first);
  expect(mocks.getLanguage).toHaveBeenCalledOnce();
  loaded.resolve({ ...language, words: [...language.words] });
  await first;
  expect(mocks.sessionCommand).toHaveBeenCalledOnce();
  expect(mocks.sessionCommand).toHaveBeenCalledWith(
    expect.objectContaining({
      op: "supplyContent",
      request,
      source: expect.objectContaining({ kind: "poem" }),
    }),
  );
});

it("shares raw quote assets with catalog readers and projects native group indices without another fetch", async () => {
  Object.assign(getMutableConfig(), { mode: "quote", funbox: [] });
  mocks.quoteCatalog.mockReturnValue({
    language: "english",
    length: 1,
    groups: [[0], [], [], []],
    quotes: [
      {
        id: 1,
        text: [0xd800],
        source: "Source",
        length: 1,
        group: 0,
        language: "english",
        textSplit: [],
      },
    ],
  });
  const host = getContentHost();
  const catalog = await host.getQuotes("english");
  expect(catalog.quotes[0]?.text).toBe("\ud800");
  expect(catalog.groups[0]?.[0]).toBe(catalog.quotes[0]);
  expect(mocks.quoteCatalog).toHaveBeenCalledWith(
    expect.any(Object),
    null,
    expect.objectContaining({ kind: "seeded" }),
  );
  await host.prepare({ ...language, words: [...language.words] });
  expect(mocks.cachedFetchJson).toHaveBeenCalledOnce();
  expect(mocks.prepare.mock.calls[0]?.[0].quotes).toEqual(
    mocks.quoteCatalog.mock.calls[0]?.[0],
  );
});

it("rejects an invalid active source through native recovery without scoring it as typing failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            { title: "Poem", author: "Writer", lines: ["raw text"] },
          ]),
        ),
    ),
  );
  const request = { ...mocks.request, kind: "poetry" };
  mocks.sessionCommand.mockImplementation((command: { op: string }) => {
    if (command.op === "supplyContent") {
      throw new EngineFailure({
        code: "invalidContent",
        message: "Content exceeds bound",
        recovery: [],
      });
    }
    throw new EngineFailure({
      code: "sourceUnavailable",
      message: "Source unavailable",
      recovery: [],
    });
  });
  await expect(getContentHost().supplyActive(request)).rejects.toMatchObject({
    code: "sourceUnavailable",
  });
  expect(
    mocks.sessionCommand.mock.calls.map(([command]) => command.op),
  ).toEqual(["supplyContent", "failContent"]);
  expect(mocks.sessionCommand.mock.calls[1]?.[0]).toEqual(
    expect.objectContaining({ request }),
  );
});
