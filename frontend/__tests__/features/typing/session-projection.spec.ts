import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import type { Update } from "@oxytype/typing-engine/browser.client";
const mocks = vi.hoisted(() => {
  const empty: Update = {
    state: { wordIndex: 0, inputValue: [], active: false, ended: false },
    events: [],
    generation: 1,
    automaticPending: false,
    words: [],
    logInvalidated: false,
    awaitingContent: false,
    slowTimer: false,
  };
  return {
    empty,
    command: vi.fn(() => empty),
    snapshot: vi.fn(() => ({
      state: empty.state,
      words: [[97]],
      sectionIndexes: [0],
      allWordsGenerated: true,
      hasTab: false,
      hasNewline: false,
      currentQuote: null,
    })),
    log: vi.fn(),
    pace: vi.fn(() => ({ position: null, stepEnd: 0, lastWpm: 77 })),
    liveStats: vi.fn(() => ({
      wpm: 120,
      raw: 120,
      acc: 100,
      seconds: 1,
      timerStartMs: 100,
      timeLimitSeconds: null,
      durationMs: 1000,
      msSinceLastInput: null,
      chars: {
        allCorrect: 1,
        correctWord: 1,
        incorrect: 0,
        extra: 0,
        missed: 0,
      },
    })),
    generation: 1,
    analyze: vi.fn(),
  };
});
vi.mock("../../../src/features/typing/engine.client", () => ({
  getBrowserEngine: () => ({
    session: () => mocks,
    generation: () => mocks.generation,
    invalidateSession: () => {
      mocks.generation++;
    },
    api: () => ({ analyze: mocks.analyze }),
  }),
}));
import { mountApplication } from "../../../src/app/application";
import { getEngineSession } from "../../../src/features/typing/runtime/session.client";
import {
  createTestApplication,
  releaseTestApplication,
} from "../../__harness__/mock-application";
releaseTestApplication();
let dispose: () => void;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.command.mockReturnValue(mocks.empty);
  mocks.generation = 1;
  const app = createTestApplication();
  const release = mountApplication(app.application);
  dispose = () => {
    release();
    app.dispose();
  };
});
afterEach(() => dispose());

it("projects lossless command deltas and observations without exporting a growing log", () => {
  const session = getEngineSession();
  session.attach();
  const project = vi.fn();
  session.subscribe(project);
  mocks.command.mockReturnValueOnce({
    ...mocks.empty,
    state: { wordIndex: 0, inputValue: [0xd800], active: true, ended: false },
    events: [
      {
        type: "input",
        testMs: 0,
        data: {
          inputType: "insertText",
          data: [0xd800],
          inputValue: [0xd800],
          wordIndex: 0,
          charIndex: 0,
          correct: false,
        },
      },
    ],
  });
  session.command({
    op: "insert",
    data: [0xd800],
    now: 123.25,
    date: 456,
    automatic: null,
    isCompositionEnding: null,
    correctShiftUsed: null,
  });
  expect(session.getCurrentInput()).toBe("\ud800");
  expect(session.metadata()?.allWordsGenerated).toBe(true);
  expect(session.getInputForWord(0)).toBe("\ud800");
  expect(project.mock.calls[0]?.[2][0].data).toMatchObject({
    data: "\ud800",
    inputValue: "\ud800",
  });
  session.observe(
    {
      type: "composition",
      testMs: 0,
      data: { event: "update", data: "\udc00", wordIndex: 0 },
    },
    124.5,
  );
  expect(mocks.command).toHaveBeenLastCalledWith({
    op: "observe",
    now: 124.5,
    eventType: "composition",
    eventData: { event: "update", data: [0xdc00], wordIndex: 0 },
  });
  expect(mocks.log).not.toHaveBeenCalled();
});

it("notifies a deferred finish exactly once and acknowledges at the host completion time", () => {
  const session = getEngineSession();
  session.attach();
  const finish = vi.fn();
  session.on("finish", finish);
  mocks.command.mockReturnValue({
    ...mocks.empty,
    state: { ...mocks.empty.state, active: true },
    finish: { reason: "difficulty" },
  });
  session.command({
    op: "insert",
    now: 500,
    date: 1,
    data: [97],
    automatic: null,
    isCompositionEnding: null,
    correctShiftUsed: null,
  });
  session.command({ op: "advance", now: 501, date: 1 });
  expect(finish).toHaveBeenCalledExactlyOnceWith({ reason: "difficulty" });
  expect(session.getFinishReason()).toBe("difficulty");
  mocks.command.mockReturnValue(mocks.empty);
  session.end(550.75);
  expect(mocks.command).toHaveBeenLastCalledWith(
    expect.objectContaining({ op: "acknowledgeFinish", now: 550.75 }),
  );
  session.reset();
  expect(session.getFinishReason()).toBeUndefined();
  expect(session.getInputForWord(0)).toBe("");
});

it("does not dispatch stale completion after a projection replaces the session", () => {
  const session = getEngineSession();
  session.attach();
  const finish = vi.fn();
  session.on("finish", finish);
  session.subscribe(() => {
    mocks.generation++;
  });
  mocks.command.mockReturnValue({ ...mocks.empty, finish: {} });
  session.finish(500);
  expect(finish).not.toHaveBeenCalled();
});

it("projects cleared-next-word deletion without retaining the Firefox residue", () => {
  const session = getEngineSession();
  session.attach();
  mocks.command.mockReturnValueOnce({
    ...mocks.empty,
    events: [
      {
        type: "input",
        testMs: 1,
        data: {
          inputType: "insertText",
          data: [120],
          inputValue: [120],
          wordIndex: 1,
          charIndex: 0,
          correct: false,
        },
      },
      {
        type: "input",
        testMs: 2,
        data: {
          inputType: "deleteWordBackward",
          inputValue: [],
          wordIndex: 0,
          charIndex: 0,
          clearedNextWord: true,
        },
      },
    ],
  });
  session.command({
    op: "delete",
    now: 2,
    date: 0,
    kind: "deleteWordBackward",
    observedInput: [],
    sentinelRemoved: true,
  });
  expect(session.getInputForWord(1)).toBe("");
});

it("retains the captured tick/explicit finish clock when acknowledging a deferred timer result", () => {
  const session = getEngineSession();
  session.attach();
  mocks.command.mockReturnValue({
    ...mocks.empty,
    state: { ...mocks.empty.state, active: true },
    finish: { reason: "min accuracy" },
  });
  session.command({ op: "advance", now: 1000.25, date: 1234 });
  mocks.command.mockReturnValue(mocks.empty);
  session.end(1050);
  expect(mocks.command).toHaveBeenLastCalledWith({
    op: "acknowledgeFinish",
    now: 1000.25,
    date: 1234,
  });
});
