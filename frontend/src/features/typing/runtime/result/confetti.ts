import * as SlowTimer from "../../../../ts/states/slow-timer";

export async function showConfetti(): Promise<void> {
  if (SlowTimer.get()) return;
  const { create } = await import("canvas-confetti");
  // The default renderer creates a blob worker, blocked by our script-src CSP.
  const confetti = create(undefined, { resize: true, useWorker: false });
  const style = getComputedStyle(document.body);
  const colors = [
    style.getPropertyValue("--main-color"),
    style.getPropertyValue("--text-color"),
    style.getPropertyValue("--sub-color"),
  ];
  const duration = Date.now() + 125;

  (function f(): void {
    void confetti({
      particleCount: 5,
      angle: 60,
      spread: 75,
      origin: { x: 0 },
      colors: colors,
    });
    void confetti({
      particleCount: 5,
      angle: 120,
      spread: 75,
      origin: { x: 1 },
      colors: colors,
    });

    if (Date.now() < duration) {
      requestAnimationFrame(f);
    }
  })();
}
