type ResultDuration = {
  testDuration: number;
  incompleteTestSeconds: number;
  afkDuration: number;
};

export function getActiveTypingSeconds(results: ResultDuration[]): number {
  return results.reduce(
    (sum, result) =>
      sum +
      result.testDuration +
      result.incompleteTestSeconds -
      result.afkDuration,
    0,
  );
}

export function getLocalMidnight(date: Date): Date {
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  return midnight;
}

/** Counts time typed this session, or today once today's results are loaded. */
export class TypingTimeTracker {
  private readonly now: () => Date;
  private seconds = 0;
  private day: number | undefined;

  constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  add(seconds: number): void {
    const today = this.today();
    if (this.day !== undefined && this.day !== today) {
      this.day = today;
      this.seconds = seconds;
      return;
    }
    this.seconds += seconds;
  }
  loadToday(results: ResultDuration[]): void {
    this.day = this.today();
    this.seconds = getActiveTypingSeconds(results);
  }
  getSeconds(): number {
    return this.seconds;
  }
  isToday(): boolean {
    return this.day !== undefined;
  }

  private today(): number {
    return getLocalMidnight(this.now()).getTime();
  }
}
