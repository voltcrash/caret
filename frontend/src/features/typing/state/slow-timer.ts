import { createAppSignal } from "#app/state.ts";

const [getSlowTimer, setSlowTimer] = createAppSignal(false);

export function set(): void {
  if (getSlowTimer()) return;
  setSlowTimer(true);
  console.error("Slow timer, disabling animations");
}

export function clear(): void {
  setSlowTimer(false);
}

export function get(): boolean {
  return getSlowTimer();
}
