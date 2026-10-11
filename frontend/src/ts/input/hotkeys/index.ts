import { useQuickRestartHotkeys } from "./quickrestart";
import { useCommandPaletteHotkeys } from "./command-palette";
import { useKonamiHotkey } from "./konami";

export function useAppHotkeys(): void {
  useQuickRestartHotkeys();
  useCommandPaletteHotkeys();
  useKonamiHotkey();
}
