import { expect, it, vi } from "vite-plus/test";

const audio = vi.hoisted(() => ({
  loaded: vi.fn(),
  listen: vi.fn(),
  code: vi.fn(),
  play: vi.fn(async () => undefined),
}));
vi.mock("../../src/app/audio.client", () => {
  audio.loaded();
  return {
    useSoundEvents: audio.listen,
    updateCurrentCode: audio.code,
    playClick: audio.play,
  };
});

import { mountApplication } from "../../src/app/application";
import { getMutableConfig } from "../../src/ts/config/store";
import {
  playClick,
  updateCurrentCode,
} from "../../src/ts/controllers/sound-controller";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/mock-application";

releaseTestApplication();

it("keeps default-off audio unloaded and never starts work after app disposal", async () => {
  const first = createTestApplication();
  const release = mountApplication(first.application);
  updateCurrentCode(new KeyboardEvent("keydown", { code: "KeyQ" }));
  await playClick();
  expect(audio.loaded).not.toHaveBeenCalled();
  getMutableConfig().playSoundOnClick = "1";
  await playClick();
  expect(audio.loaded).toHaveBeenCalledOnce();
  expect(audio.listen).toHaveBeenCalledOnce();
  expect(audio.code).toHaveBeenCalledWith({ code: "KeyQ" });
  expect(audio.play).toHaveBeenCalledOnce();
  first.dispose();
  release();

  const next = createTestApplication();
  const releaseNext = mountApplication(next.application);
  getMutableConfig().playSoundOnClick = "1";
  const pending = playClick();
  next.dispose();
  releaseNext();
  await pending;
  expect(audio.play).toHaveBeenCalledOnce();
});
