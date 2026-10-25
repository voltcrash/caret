import { createHotkey } from "@tanstack/solid-hotkeys";

export function useKonamiHotkey(): void {
  createHotkey(
    [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "B",
      "A",
    ],
    () => {
      window.open("https://keymash.io/", "_blank");
    },
  );
}
