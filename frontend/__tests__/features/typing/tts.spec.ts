import { createRoot } from "solid-js";
import { beforeEach, afterEach, expect, it, vi } from "vite-plus/test";
import { mountApplication } from "../../../src/app/application";
import {
  captureTypingMount,
  mountTypingScope,
} from "../../../src/features/typing/scope";
import { useTtsEvents } from "../../../src/features/typing/runtime/tts";
import { ttsEvent } from "../../../src/ts/events/tts";
import {
  createTestApplication,
  releaseTestApplication,
} from "../../__harness__/mock-application";

const mocks = vi.hoisted(() => ({ language: vi.fn() }));
vi.mock("../../../src/ts/utils/json-data", () => ({
  getLanguage: mocks.language,
}));
releaseTestApplication();
let dispose: () => void;
let leave: () => void;
const speak = vi.fn();
const cancel = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      lang = "";
      text = "";
    },
  );
  vi.stubGlobal("speechSynthesis", { speak, cancel });
  const app = createTestApplication();
  const releaseApp = mountApplication(app.application);
  leave = mountTypingScope();
  captureTypingMount().activate();
  const stop = createRoot((dispose) => {
    useTtsEvents();
    return dispose;
  });
  dispose = () => {
    stop();
    leave();
    releaseApp();
    app.dispose();
    vi.unstubAllGlobals();
  };
});
afterEach(() => dispose());

it("cancels queued speech and ignores a language response after route disposal", async () => {
  let resolve!: (language: { bcp47: string }) => void;
  mocks.language.mockImplementation(
    async () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  ttsEvent.dispatch("old route");
  leave();
  resolve({ bcp47: "en-US" });
  await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(2));
  expect(speak).not.toHaveBeenCalled();
});

it("speaks with the language loaded for the mounted route", async () => {
  mocks.language.mockResolvedValue({ bcp47: "ja-JP" });
  ttsEvent.dispatch("hello");
  await vi.waitFor(() => expect(speak).toHaveBeenCalledOnce());
  expect(speak.mock.calls[0]?.[0]).toMatchObject({
    lang: "ja-JP",
    text: "hello",
  });
});
