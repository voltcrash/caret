export type PaceState = {
  wpm: number;
  cps: number;
  spc: number;
  correction: number;
  currentWordIndex: number;
  currentLetterIndex: number;
  wordsStatus: Record<number, true | undefined>;
};

export function createPaceState(wpm: number): PaceState | null {
  if (!Number.isFinite(wpm) || wpm < 1) return null;
  return {
    wpm,
    cps: (wpm * 5) / 60,
    spc: 60 / (wpm * 5),
    correction: 0,
    currentWordIndex: 0,
    currentLetterIndex: 0,
    wordsStatus: {},
  };
}
export function advancePace(
  settings: PaceState,
  getWord: (index: number) => string | undefined,
  blindMode: boolean,
): boolean {
  const length = (index: number): number => {
    const word = getWord(index);
    if (word === undefined) throw new Error("Pace caret out of words");
    return word.length;
  };

  try {
    if (settings.currentLetterIndex >= length(settings.currentWordIndex)) {
      //go to the next word
      settings.currentLetterIndex = -1;
      settings.currentWordIndex++;
    }
    settings.currentLetterIndex++;

    if (!blindMode) {
      if (settings.correction < 0) {
        while (settings.correction < 0) {
          settings.currentLetterIndex--;
          if (settings.currentLetterIndex <= -1) {
            //go to the previous word
            settings.currentLetterIndex = length(settings.currentWordIndex - 1);
            settings.currentWordIndex--;
          }
          settings.correction++;
        }
      } else if (settings.correction > 0) {
        while (settings.correction > 0) {
          settings.currentLetterIndex++;
          if (
            settings.currentLetterIndex >=
            length(settings.currentWordIndex) + 1
          ) {
            //go to the next word
            settings.currentLetterIndex = 0;
            settings.currentWordIndex++;
          }
          settings.correction--;
        }
      }
    }
  } catch {
    return false;
  }
  return true;
}

export function correctPace(
  settings: PaceState | null,
  wordIndex: number,
  correct: boolean,
  currentWord: string,
  blindMode: boolean,
): void {
  if (correct) {
    if (settings?.wordsStatus[wordIndex] === true && !blindMode) {
      settings.wordsStatus[wordIndex] = undefined;
      settings.correction -= currentWord.length;
    }
  } else {
    if (
      settings !== null &&
      settings.wordsStatus[wordIndex] === undefined &&
      !blindMode
    ) {
      settings.wordsStatus[wordIndex] = true;
      settings.correction += currentWord.length;
    }
  }
}

export type PacePosition = {
  wordIndex: number;
  letterIndex: number;
  wpm: number;
};

/** One test's pace caret. Clients schedule steps and render the caret. */
export class PaceTracker {
  private state: PaceState | null = null;
  private startMs = 0;
  private steps = 0;
  private lastWpm = 0;

  /** Starts over at the given speed; speeds below one disable the caret. */
  reset(wpm: number | null = null): boolean {
    this.state = wpm === null ? null : createPaceState(wpm);
    this.startMs = 0;
    this.steps = 0;
    return this.state !== null;
  }
  isEnabled(): boolean {
    return this.state !== null;
  }
  start(now: number): void {
    this.startMs = now;
    this.steps = 0;
  }
  /** Moves one letter, or disables the caret once it runs out of words. */
  step(
    getWord: (index: number) => string | undefined,
    blindMode: boolean,
  ): PacePosition | null {
    if (this.state === null) return null;
    if (!advancePace(this.state, getWord, blindMode)) {
      this.state = null;
      return null;
    }
    this.steps++;
    return this.getPosition();
  }
  /** Anchored to the start so per-step delays never accumulate. */
  getStepEnd(): number {
    return this.startMs + this.steps * (this.state?.spc ?? 0) * 1000;
  }
  /** Takes every step due by `now`. */
  advanceTo(
    now: number,
    getWord: (index: number) => string | undefined,
    blindMode: boolean,
  ): PacePosition | null {
    if (this.state === null) return null;
    const due = Math.floor((now - this.startMs) / (this.state.spc * 1000));
    while (this.steps < due) {
      if (this.step(getWord, blindMode) === null) return null;
    }
    return this.getPosition();
  }
  getPosition(): PacePosition | null {
    if (this.state === null) return null;
    return {
      wordIndex: this.state.currentWordIndex,
      letterIndex: this.state.currentLetterIndex,
      wpm: this.state.wpm,
    };
  }
  correct(
    wordIndex: number,
    correct: boolean,
    currentWord: string,
    blindMode: boolean,
  ): void {
    correctPace(this.state, wordIndex, correct, currentWord, blindMode);
  }
  /** Repeated tests only raise the remembered speed. */
  rememberWpm(wpm: number, repeating: boolean): void {
    if (!repeating || wpm > this.lastWpm) this.lastWpm = wpm;
  }
  getLastWpm(): number {
    return this.lastWpm;
  }
}
