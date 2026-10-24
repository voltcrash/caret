import { createAppOwned } from "../../app/application";

const state = createAppOwned(() => ({
  correctShiftUsed: true,
  incorrectShiftsInARow: 0,
  awaitingNextWord: false,
  lastBailoutAttempt: -1,
  lastInsertCompositionTextData: "",
}));

export function isCorrectShiftUsed(): boolean {
  return state().correctShiftUsed;
}

export function setCorrectShiftUsed(value: boolean): void {
  state().correctShiftUsed = value;
}

export function getIncorrectShiftsInARow(): number {
  return state().incorrectShiftsInARow;
}

export function incrementIncorrectShiftsInARow(): void {
  state().incorrectShiftsInARow++;
}

export function resetIncorrectShiftsInARow(): void {
  state().incorrectShiftsInARow = 0;
}

export function isAwaitingNextWord(): boolean {
  return state().awaitingNextWord;
}

export function setAwaitingNextWord(value: boolean): void {
  state().awaitingNextWord = value;
}

export function getLastBailoutAttempt(): number {
  return state().lastBailoutAttempt;
}

export function setLastBailoutAttempt(value: number): void {
  state().lastBailoutAttempt = value;
}

export function getLastInsertCompositionTextData(): string {
  return state().lastInsertCompositionTextData;
}

export function setLastInsertCompositionTextData(value: string): void {
  state().lastInsertCompositionTextData = value;
}
