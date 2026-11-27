import { cleanup, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const [initError, setInitError] = createSignal<{ message?: string } | null>(
  null,
);

vi.mock("../../../../src/ts/states/test", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../src/ts/states/test")>()),
  getTestInitError: () => initError(),
  isTestRestarting: () => false,
}));

vi.mock("../../../../src/features/typing/components/TestConfig", () => ({
  TestConfig: () => null,
}));
vi.mock("../../../../src/features/typing/components/TestInitFailed", () => ({
  TestInitFailed: () => null,
}));
vi.mock("../../../../src/features/typing/components/CapsWarning", () => ({
  CapsWarning: () => null,
}));
vi.mock("../../../../src/features/typing/components/FunboxTimer", () => ({
  FunboxTimers: () => null,
}));
vi.mock(
  "../../../../src/features/typing/components/modes-notice/TestModesNotice",
  () => ({ TestModesNotice: () => null }),
);
vi.mock(
  "../../../../src/features/typing/components/live-stats/LiveStatsTextTop",
  () => ({ LiveStatsTextTop: () => null }),
);
vi.mock(
  "../../../../src/features/typing/components/live-stats/LiveStatsMini",
  () => ({ LiveStatsMini: () => null }),
);
vi.mock("../../../../src/features/typing/components/OutOfFocusWarning", () => ({
  OutOfFocusWarning: () => null,
}));
vi.mock("../../../../src/features/typing/components/words/Caret", () => ({
  Caret: () => null,
}));
vi.mock("../../../../src/features/typing/components/Words", () => ({
  Words: () => null,
}));
vi.mock(
  "../../../../src/features/typing/components/CompositionDisplay",
  () => ({ CompositionDisplay: () => null }),
);
vi.mock("../../../../src/features/typing/components/Keymap", () => ({
  Keymap: () => null,
}));
vi.mock("../../../../src/features/typing/components/RestartTestButton", () => ({
  RestartTestButton: () => null,
}));
vi.mock("../../../../src/features/typing/components/FinishZenButton", () => ({
  FinishZenButton: () => null,
}));
vi.mock(
  "../../../../src/features/typing/components/SaveProgressButton",
  () => ({
    SaveProgressButton: () => null,
  }),
);
vi.mock("../../../../src/features/typing/components/EndTestButton", () => ({
  EndTestButton: () => null,
}));
vi.mock(
  "../../../../src/features/typing/components/live-stats/LiveStatsTextBottom",
  () => ({ LiveStatsTextBottom: () => null }),
);
vi.mock("../../../../src/features/typing/components/TestPageLifecycle", () => ({
  TestPageLifecycle: () => null,
}));
vi.mock("../../../../src/features/typing/components/TypingEvents", () => ({
  TypingEvents: () => null,
}));
vi.mock("../../../../src/features/typing/components/TestLoading", () => ({
  TestLoading: () => null,
}));
vi.mock(
  "../../../../src/features/typing/components/result/ResultAnnouncement",
  () => ({ ResultAnnouncement: () => null }),
);
vi.mock("../../../../src/features/typing/components/result/LazyResult", () => ({
  LazyResult: () => null,
}));
vi.mock("../../../../src/features/typing/components/GuestScores", () => ({
  GuestScores: () => null,
}));
vi.mock(
  "../../../../src/features/typing/components/hooks/useWordsInputScroll",
  () => ({ useWordsInputScroll: vi.fn() }),
);
vi.mock(
  "../../../../src/features/typing/components/words/wrapper-sizing",
  () => ({ useWordsWrapperSizing: vi.fn() }),
);
vi.mock("../../../../src/features/typing/runtime/test/ui", () => ({
  focusWords: vi.fn(),
}));

import { TestPage } from "../../../../src/features/typing/components/TestPage";

describe("TestPage", () => {
  beforeEach(() => {
    setInitError(null);
  });

  afterEach(() => {
    setInitError(null);
    cleanup();
  });

  it("hides via a wrapper on init error without clobbering imperative hidden class on #typingTest", () => {
    const { container } = render(() => <TestPage />);
    const typingTest = container.querySelector<HTMLDivElement>("#typingTest");
    expect(typingTest).not.toBeNull();
    const wrapper = typingTest?.parentElement;
    expect(wrapper).not.toBeNull();

    // Imperative callers (finish.ts / lifecycle.ts) toggle `hidden` directly on #typingTest.
    typingTest?.classList.add("hidden");
    expect(wrapper?.classList.contains("hidden")).toBe(false);
    expect(typingTest?.classList.contains("hidden")).toBe(true);

    // Init error hides the wrapper, leaving #typingTest's class list untouched.
    setInitError({ message: "language fetch failed" });
    expect(wrapper?.classList.contains("hidden")).toBe(true);
    expect(typingTest?.classList.contains("hidden")).toBe(true);

    // Clearing the init error on restart reveals the wrapper without un-hiding
    // #typingTest prematurely before fadeInAfterRestart runs.
    setInitError(null);
    expect(wrapper?.classList.contains("hidden")).toBe(false);
    expect(typingTest?.classList.contains("hidden")).toBe(true);
  });
});
