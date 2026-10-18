import { createAppSignal } from "../../app/state";

const [getComposingState, setComposingState] = createAppSignal(false);
const [getCompositionData, setCompositionData] = createAppSignal("");

export function getComposing(): boolean {
  return getComposingState();
}

export function setComposing(isComposing: boolean): void {
  setComposingState(isComposing);
}

export function setData(data: string): void {
  setCompositionData(data);
}

export function getData(): string {
  return getCompositionData();
}
