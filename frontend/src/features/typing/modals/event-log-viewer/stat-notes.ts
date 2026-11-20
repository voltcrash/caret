export type MetricKind = "spacing" | "duration";

export const STAT_DEFINITIONS = {
  n: "Sample size. Shape estimates get noisy below roughly 100 values, so a short test is much weaker evidence than a long one.",
  percentiles:
    "The 10th, 50th (median) and 90th percentiles - the three markers drawn on the chart. The median is the typical value; the gap up to p90 is the tail.",
  mean: "Arithmetic average. Sits above the median when the data is right skewed, so a large mean-median gap is itself a sign of a long tail.",
  sd: "Standard deviation - absolute spread, in ms.",
  cv: "Coefficient of variation (sd/mean) - spread relative to speed. Careful: sd is dominated by pauses, so a generator with realistic pauses bolted onto unrealistically tight typing scores the same cv as a human. Trust the lo and hi halves over this.",
  spreadLow:
    "(p50-p10)/p50 - how wide the fast half of the body is, relative to the median. Built only from percentiles, so no pause can touch it, and relative so it compares across any typing speed. Kept separate from the slow half on purpose: a log that is generated for most of a test and typed for the rest has a normal looking total spread, because the real typing stretches the slow half while the generated part keeps this one pinched.",
  spreadHigh:
    "(p90-p50)/p50 - the same measure for the slow half. Mostly reflects how much the typist paused. Reading it against the fast half gives the asymmetry of the body, but that ratio is not worth thresholding: real tests land on both sides of 1 - a fast typist rolling keys measures 0.92 - and a real generator measured 1.24, so it points the wrong way.",
  acf1: "Lag-1 autocorrelation: does a slow keystroke tend to be followed by another slow one? Runs -1 to +1, computed on the logs so one long pause cannot dominate it. This is the only stat here that is not order invariant - shuffle the array and every other number on this row is unchanged while this one moves. Humans wander in runs: faster through a familiar word, slower through an awkward one, slower when tired. A generator drawing each gap fresh has no memory at all and sits at 0 by construction. The sigma figure is how far from zero that is under the independence null, whose standard error is exactly 1/sqrt(n) - so unlike every other threshold here, the generator side is exact arithmetic rather than fitted to a couple of samples.",
  runs: "Wald-Wolfowitz runs test: how many times the series crosses its own median, against how many times chance alone would. Reported as a z. Negative means fewer crossings than chance - the values clump into slow and fast patches, which is what momentum looks like. Zero means each value is independent of its neighbours. Like the autocorrelation the null here is exact, so the z is a real significance rather than a fitted threshold, and it catches clumping that lag-1 correlation can miss.",
  drift:
    "Median of the last third of the test divided by the median of the first third. People drift - warming up, tiring, settling into a rhythm - so a value sitting exactly on 1.00 means nothing changed across the whole test, which is what a generator is by construction. Above 1 means slowing down, below 1 means speeding up.",
  quantum:
    "The grid the values sit on, and how tightly, found by sweeping every period from 0.5ms to 30ms rather than testing a list of guesses. The number in brackets runs 0 to 1: under about 0.3 there is no grid and this reads as a dash, near 1 every value lands on one. Causes are both innocent and not - a 125Hz USB keyboard polls every 8ms, a display can align input to its refresh at 6.94ms or 16.67ms, and a setInterval bot lands on 10ms. Same periods either way.",
  distinct:
    "How many different values appear at all. Real timings come from subtracting two clock readings, so they are nearly all unique even after browser coarsening. A generator drawing from a small hardcoded pool gives a tiny count, and this catches it even when the pool sits on no regular grid.",
  bell: "How close the distribution is to a bell, as the correlation between the sorted values and the quantiles a normal would have put them at - a number for what the q-q chart below draws. 1.00 is exactly bell shaped. Spacing is measured on its logs, since gaps between keys are multiplicative and land near lognormal; hold times are measured as they are. This replaced excess kurtosis, which is a statement about tail weight rather than shape: a couple of surviving outliers sent one generated log to +119 while its body was a fixed interval, and real humans measured on both sides of zero, so there was no human direction left to flag.",
  skew: "Third moment - asymmetry. Driven largely by the pause tail, which is exactly why it works: a generator that never stops to think has nothing to make it positive.",
} as const;

export type StatKey = keyof typeof STAT_DEFINITIONS;

// rough reference ranges, meant for eyeballing a trace in this viewer rather
// than as thresholds
export const STAT_EXAMPLES: Record<MetricKind, Record<StatKey, string>> = {
  spacing: {
    n: "A 60s test at 100wpm gives around 500 intervals, a 15s test around 125.",
    percentiles:
      "Human median is roughly 12000/wpm ms - about 120ms at 100wpm, 60ms at 200wpm. A fixed interval generator puts all three on the same number.",
    mean: "Human: noticeably above the median, since pauses pull it up. Generated: mean and median nearly identical.",
    sd: "Human: comparable to the median, often 50-150ms. Fixed interval: 0. Jitter generators usually land 10-40ms.",
    cv: "Human: roughly 0.4-0.8, but a tight generator with pauses added measures 1.37 against a human's 1.36 - indistinguishable.",
    spreadLow:
      "Human: 0.43 and 0.49 on real tests, 0.35 to 0.55 simulated. A generator typing too consistently measures 0.15, and a log that is 70% generated still only reaches 0.20 even though its total spread looks wider than a human's.",
    spreadHigh:
      "Human: 0.45 to 0.71 on real tests, and much higher for anyone who pauses a lot. Not flagged.",
    runs: "Expect a clearly negative z from a hand and about 0 from a generator. No real measurements yet.",
    drift:
      "Expect a hand to land some way off 1.00 in either direction over a full test. A generator sits on it.",
    acf1: "No real measurements yet - this is here to gather them. Expect a generator near 0. Our own cheat typer draws every gap independently, so it should sit at 0 too despite passing every other stat on this row.",
    quantum:
      "Vertical banding in the hold vs flight scatter is this showing up visually. Check whether keyDuration reports the same period: a quantised clock reaches every difference, so if only spacing is banded the cause sits in how keydowns are scheduled rather than in the clock.",
    distinct:
      "Human: hundreds - roughly 850 of 900 on a fine clock, and still about 120 on firefox's coarser 1ms. A pool based generator gives a dozen.",
    bell: "Measured on a labelled corpus rather than simulated. Human: 0.9417 to 0.9849 across five logs from 122 to 202wpm. Every generated log in that corpus came in below 0.9235, including one built to look human on purpose. The two ends do not overlap, which no other single stat here manages.",
    skew: "Human: strongly positive, often 2+ once pauses are included. Uniform or gaussian generator: about 0.",
  },
  duration: {
    n: "One value per keypress, minus any key that was never released.",
    percentiles:
      "Human hold times are roughly 60-120ms and vary far less with speed than spacing does. Synthetic traces often reuse one constant hold.",
    mean: "Human: close to the median, hold times have a much shorter tail than spacing. Generated: identical to the median.",
    sd: "Human: roughly 15-40ms. A constant hold gives 0.",
    cv: "Human: roughly 0.2-0.4. A constant hold gives ~0.",
    runs: "Same reading as for spacing. No real measurements yet.",
    drift:
      "Hold times drift with fatigue too, though probably less than spacing does.",
    acf1: "Hold times should carry momentum for the same reason spacing does - the same hand is speeding up and slowing down - but nobody has measured it. Gathering numbers.",
    quantum:
      "Worth comparing against the spacing reading. Both banded on the same period means the clock or timer is quantised globally; only spacing banded points at keydown scheduling - polling or frame alignment - instead.",
    distinct:
      "Hold times cover a narrower range than spacing, so expect fewer distinct values, but still well into the hundreds on a fine clock.",
    spreadLow:
      "Human: 0.23 and 0.36 on real tests. A generator holding every key for near enough the same time measures 0.12. Tighter margin than the spacing version, so treat a lone flag here as weaker evidence.",
    spreadHigh: "Human: 0.35 to 0.39 on real tests. Not flagged.",
    bell: "Human: 0.8627 to 0.9783 measured. Weaker than the spacing version and it points both ways - a generator drawing holds from a clean lognormal overshoots to 0.9952, straighter than any real hand, so a low reading here is evidence while a very high one is its own kind of odd.",
    skew: "Human: mildly positive. Symmetric generator: about 0.",
  },
};

/**
 * Every one of these flags a value that is too LOW. All the shape stats point
 * the same way: generators sit below humans on all of them, and nothing above
 * the human range is suspicious - a long tail is just someone thinking.
 *
 * Numbers set between the worst human case and the best generator case on a
 * labelled corpus of ten logs, except where noted as simulated. cv and the median only catch
 * fixed intervals and impossible speeds; the real separation is spreadLow and
 * bell, which fail on different logs and so catch different generators.
 */
export type SuspicionLimits = {
  cv: number;
  spreadLow: number;
  /** flagged when fewer distinct values than this appear */
  distinct: number;
  bell: number;
  skew: number;
  /** median in ms - below this the typing is not physically possible */
  median: number;
};

// tail and sigma are deliberately not in here. they only look at p10..p90, and
// a fast typist rolls enough keys that the body of their distribution goes
// symmetric or even left leaning - real data at ~200wpm measures tail 0.92,
// lower than any generator tested, so thresholding it would flag humans
// preferentially. the pause tail the ratio ignores by design is the strongest
// human signal there is, and skew is the stat that sees it
export const SUSPICIOUS: Record<MetricKind, SuspicionLimits> = {
  spacing: {
    cv: 0.15,
    spreadLow: 0.3,
    distinct: 30,
    bell: 0.93,
    skew: 0.5,
    median: 30,
  },
  duration: {
    cv: 0.1,
    spreadLow: 0.18,
    distinct: 30,
    bell: 0.85,
    skew: 0.3,
    median: 20,
  },
};

// below this the shape stats are too noisy to accuse anyone with
export const MIN_SAMPLE_FOR_FLAGS = 100;

export function statBalloon(stat: StatKey, kind: MetricKind): string {
  return `${STAT_DEFINITIONS[stat]} ${STAT_EXAMPLES[kind][stat]}${flagNote(stat, kind)}`;
}

export function flagNote(stat: StatKey, kind: MetricKind): string {
  const limits = SUSPICIOUS[kind];
  switch (stat) {
    case "cv":
      return ` Flagged red below ${limits.cv}.`;
    case "spreadLow":
      return ` Flagged red below ${limits.spreadLow}.`;
    case "spreadHigh":
      return " Not flagged. A short test with no pauses legitimately has very little upper half, and a generator that never stops to think is already caught by skew.";
    case "runs":
    case "drift":
      return " Not flagged. Gathering numbers first.";
    case "acf1":
      return " Not flagged. The generator side of this test is exact, but whether real typists reliably sit well above zero has not been measured yet - so it reports until there are numbers to set a threshold from.";
    case "quantum":
      return " Not flagged. A 125Hz USB keyboard polls every 8ms and a display can align input to its refresh, so legitimate hardware puts real typing on exactly the kind of grid a timer driven bot would - same period, opposite verdict. Reported so it can be read, not acted on.";
    case "distinct":
      return ` Flagged red below ${limits.distinct} distinct values.`;
    case "bell":
      return ` Flagged red below ${limits.bell}, set between the lowest human and the highest generated log measured so far. Five human logs is not many, and all of them come from a handful of machines - treat a lone flag here as a reason to look, not a verdict.`;
    case "skew":
      return ` Flagged red below ${limits.skew}.`;
    case "percentiles":
      return ` Flagged red when the median is under ${limits.median}ms.`;
    case "n":
      return ` Under ${MIN_SAMPLE_FOR_FLAGS} samples the shape stats are too noisy to accuse anyone with, so nothing is flagged and this number turns amber instead.`;
    default:
      return "";
  }
}

/**
 * A small sample makes every shape number noisy, so this holds the flags
 * rather than accuse someone on 40 keystrokes.
 */
export function isLowStat(
  value: number | null,
  limit: number,
  sampleSize: number,
): boolean {
  return value !== null && sampleSize >= MIN_SAMPLE_FOR_FLAGS && value < limit;
}
