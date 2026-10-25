import { formatForDisplay, HotkeyChord } from "@tanstack/solid-hotkeys";
import { JSXElement } from "solid-js";

type Props =
  | { hotkey: HotkeyChord; text?: undefined }
  | { hotkey?: undefined; text: string };

export function formatHotkey(hotkey: HotkeyChord): string {
  return formatForDisplay(hotkey, { useSymbols: false })
    .toLowerCase()
    .replace(/\+/g, " + ");
}

export function Kbd(props: Props): JSXElement {
  return <kbd>{props.hotkey ? formatHotkey(props.hotkey) : props.text}</kbd>;
}
