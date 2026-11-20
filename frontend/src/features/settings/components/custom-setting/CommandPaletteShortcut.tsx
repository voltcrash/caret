import { createHotkeyRecorder, HotkeyChord } from "@tanstack/solid-hotkeys";
import { createSignal, For, JSXElement, Show } from "solid-js";

import { Button } from "#shared/components/common/Button.tsx";
import { formatHotkey } from "#shared/components/common/Kbd.tsx";
import { configMetadata } from "#shared/config/metadata.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { getConfig } from "#shared/config/store.ts";
import {
  DEFAULT_COMMAND_PALETTE_HOTKEY,
  getCommandPaletteHotkeyError,
} from "#shared/input/hotkeys/command-palette-hotkey.ts";

import { SearchableSetting } from "../SearchableSetting";

const PRESETS: HotkeyChord[] = [
  DEFAULT_COMMAND_PALETTE_HOTKEY,
  "Escape",
  "Tab",
];

export function CommandPaletteShortcut(): JSXElement {
  const [error, setError] = createSignal<string>();

  const isCustom = (): boolean =>
    !PRESETS.includes(getConfig.commandPaletteHotkey as HotkeyChord);

  const recorder = createHotkeyRecorder({
    // record the produced character, not the physical key, so the shortcut
    // follows the os keyboard layout
    recordBy: "key",
    validate: (hotkey) =>
      getCommandPaletteHotkeyError(hotkey, getConfig.quickRestart) ?? true,
    onRecord: (hotkey) => {
      setError(undefined);
      setConfig("commandPaletteHotkey", hotkey);
    },
    onReject: (rejection) => setError(rejection.message),
    onCancel: () => setError(undefined),
    onClear: () => setError(undefined),
  });

  const presetError = (hotkey: HotkeyChord): string | undefined =>
    getCommandPaletteHotkeyError(hotkey, getConfig.quickRestart);

  return (
    <SearchableSetting
      key="commandPaletteHotkey"
      title={
        configMetadata.commandPaletteHotkey.displayString ??
        "command palette shortcut"
      }
      fa={configMetadata.commandPaletteHotkey.fa}
      description={configMetadata.commandPaletteHotkey.description}
      extraSearchKeywords="hotkey keybind keyboard shortcut commandline"
      onReset={() => {
        recorder.cancelRecording();
        setError(undefined);
      }}
      inputs={
        <div class="grid gap-2">
          <div class="grid grid-cols-3 gap-2">
            <For each={PRESETS}>
              {(hotkey) => (
                <Button
                  text={formatHotkey(hotkey)}
                  active={getConfig.commandPaletteHotkey === hotkey}
                  disabled={presetError(hotkey) !== undefined}
                  balloon={{ text: presetError(hotkey) }}
                  onClick={() => {
                    recorder.cancelRecording();
                    setConfig("commandPaletteHotkey", hotkey);
                  }}
                />
              )}
            </For>
          </div>
          <Button
            active={recorder.isRecording() || isCustom()}
            onClick={() => {
              if (recorder.isRecording()) {
                recorder.cancelRecording();
              } else {
                setError(undefined);
                recorder.startRecording();
              }
            }}
          >
            <Show
              when={!recorder.isRecording()}
              fallback="press a shortcut (esc to cancel)"
            >
              <Show when={isCustom()} fallback="record custom shortcut">
                {formatHotkey(getConfig.commandPaletteHotkey as HotkeyChord)}
              </Show>
            </Show>
          </Button>
          <Show when={error()}>
            {(message) => (
              <div role="alert" class="text-em-xs text-error">
                {message()}
              </div>
            )}
          </Show>
        </div>
      }
    />
  );
}
