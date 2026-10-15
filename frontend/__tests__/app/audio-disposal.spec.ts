import { expect, it, vi } from "vite-plus/test";

const resource = vi.hoisted(() => {
  let finish: (() => void) | undefined;
  return {
    started: vi.fn(),
    construct: vi.fn(),
    pending: new Promise<void>((resolve) => {
      finish = resolve;
    }),
    finish: () => finish?.(),
  };
});
vi.mock("howler", async () => {
  resource.started();
  await resource.pending;
  return { Howl: resource.construct, Howler: { volume: vi.fn() } };
});

import { mountApplication } from "../../src/app/application";
import { previewError } from "../../src/ts/controllers/sound-controller";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/mock-application";

releaseTestApplication();
it("discards an audio resource import that finishes after its app is replaced", async () => {
  const first = createTestApplication();
  const release = mountApplication(first.application);
  const pending = previewError("1");
  await vi.waitFor(() => expect(resource.started).toHaveBeenCalledOnce());
  first.dispose();
  release();
  const next = createTestApplication();
  const releaseNext = mountApplication(next.application);
  resource.finish();
  await pending;
  expect(resource.construct).not.toHaveBeenCalled();
  next.dispose();
  releaseNext();
});
