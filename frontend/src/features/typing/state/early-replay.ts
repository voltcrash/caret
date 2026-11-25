import { createAppOwned } from "#app/application.ts";

const replayState = createAppOwned(() => ({ active: false }));

export function isReplayingEarlyTyping(): boolean {
  return replayState().active;
}

export function setReplayingEarlyTyping(active: boolean): void {
  replayState().active = active;
}
