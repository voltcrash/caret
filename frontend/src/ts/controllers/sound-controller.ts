import {
  captureApplication,
  createAppOwned,
  requireApplication,
} from "../../app/application";
import { onCleanup, runWithOwner } from "solid-js";
import type {
  PlaySoundOnClick,
  PlaySoundOnError,
} from "@oxytype/schemas/configs";
import { getMutableConfig } from "../config/store";
import { configEvent } from "../events/config";

type Audio = typeof import("../../app/audio.client");
const audio = createAppOwned(() => {
  const app = requireApplication();
  const state = {
    code: "KeyA",
    loaded: undefined as Audio | undefined,
    pending: undefined as Promise<Audio | undefined> | undefined,
    disposed: false,
  };
  onCleanup(() => {
    state.disposed = true;
  });
  const load = async (): Promise<Audio | undefined> => {
    state.pending ??= import("../../app/audio.client").then(
      (implementation) => {
        if (state.disposed) return undefined;
        runWithOwner(app.owner, () => {
          implementation.useSoundEvents();
          implementation.updateCurrentCode({ code: state.code });
        });
        state.loaded = implementation;
        return implementation;
      },
    );
    return state.pending;
  };
  return { state, load };
});

/** Default-off sound never loads its audio resources on the typing startup path. */
export function useSoundEvents(): void {
  const current = audio();
  const preload = (): void => {
    if (getMutableConfig().playSoundOnClick !== "off") void current.load();
  };
  configEvent.useListener(({ key }) => {
    if (key === "playSoundOnClick") preload();
  });
  preload();
}
export function updateCurrentCode(event: KeyboardEvent): void {
  const current = audio();
  current.state.code = event.code;
  current.state.loaded?.updateCurrentCode(event);
}
async function withAudio(
  action: (implementation: Audio) => Promise<void>,
): Promise<void> {
  const current = audio();
  const lifetime = captureApplication();
  const implementation = await current.load();
  if (!current.state.disposed && implementation !== undefined) {
    try {
      await action(implementation);
    } catch (error) {
      if (!lifetime.signal.aborted) throw error;
    }
  }
}
export async function previewClick(value: PlaySoundOnClick): Promise<void> {
  if (value !== "off") {
    await withAudio(async (implementation) =>
      implementation.previewClick(value),
    );
  }
}
export async function previewError(value: PlaySoundOnError): Promise<void> {
  if (value !== "off") {
    await withAudio(async (implementation) =>
      implementation.previewError(value),
    );
  }
}
export async function playClick(codeOverride?: string): Promise<void> {
  if (getMutableConfig().playSoundOnClick !== "off") {
    await withAudio(async (implementation) =>
      implementation.playClick(codeOverride),
    );
  }
}
export async function playError(): Promise<void> {
  if (getMutableConfig().playSoundOnError !== "off") {
    await withAudio(async (implementation) => implementation.playError());
  }
}
export async function playTimeWarning(): Promise<void> {
  if (getMutableConfig().playTimeWarning !== "off") {
    await withAudio(async (implementation) => implementation.playTimeWarning());
  }
}
export async function playFartReverb(): Promise<void> {
  await withAudio(async (implementation) => implementation.playFartReverb());
}
export async function clearAllSounds(): Promise<void> {
  await audio().state.loaded?.clearAllSounds();
}
