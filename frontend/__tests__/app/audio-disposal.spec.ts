import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { mountApplication } from "../../src/app/application";
import { previewError } from "../../src/ts/controllers/sound-controller";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/test-application";

import { getMutableConfig } from "../../src/ts/config/store";
import { configEvent } from "../../src/ts/events/config";
releaseTestApplication();
it("discards a sample load that finishes after its app is replaced", async () => {
  let finish: (value: Response) => void = () => undefined;
  const pendingFetch = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const fetchSound = vi
    .spyOn(globalThis, "fetch")
    .mockReturnValue(pendingFetch);
  const decode = vi.spyOn(AudioContext.prototype, "decodeAudioData");
  const close = vi.spyOn(AudioContext.prototype, "close");
  const first = createTestApplication();
  const release = mountApplication(first.application);
  await previewError("1");
  expect(fetchSound).toHaveBeenCalled();
  first.dispose();
  release();
  expect(close).toHaveBeenCalledOnce();
  const next = createTestApplication();
  const releaseNext = mountApplication(next.application);
  const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
  const response = new Response();
  response.arrayBuffer = arrayBuffer;
  finish(response);
  await vi.waitFor(() => expect(arrayBuffer).toHaveBeenCalled());
  expect(decode).not.toHaveBeenCalled();
  next.dispose();
  releaseNext();
  vi.restoreAllMocks();
});

it("resumes a suspended context on a gesture and follows volume changes", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(null, { status: 404 }),
  );
  const gains = vi.spyOn(AudioContext.prototype, "createGain");
  const first = createTestApplication();
  const release = mountApplication(first.application);
  getMutableConfig().soundVolume = 0.4;
  await previewError("1");
  const context = gains.mock.contexts[0];
  const gain = gains.mock.results[0]?.value as GainNode;
  expect(gain.gain.value).toBeCloseTo(0.4);
  configEvent.dispatch({
    key: "soundVolume",
    newValue: 0.2,
    previousValue: 0.4,
  });
  expect(gain.gain.value).toBeCloseTo(0.2);
  if (!(context instanceof AudioContext)) {
    throw new Error("Missing audio context");
  }
  await context.suspend();
  expect(context.state).toBe("suspended");
  await userEvent.keyboard("a");
  await vi.waitFor(() => expect(context.state).toBe("running"));
  first.dispose();
  release();
  await vi.waitFor(() => expect(context.state).toBe("closed"));
  vi.restoreAllMocks();
});
