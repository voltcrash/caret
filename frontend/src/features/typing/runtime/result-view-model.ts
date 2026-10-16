import { CompletedEvent } from "@oxytype/schemas/results";
import * as Numbers from "@oxytype/util/numbers";
import { getMutableConfig } from "../../../ts/config/store";
import type { Theme } from "../../../ts/constants/themes";
import Format from "../../../ts/singletons/format";
import type {
  ResultCrownType,
  ResultSpeedStats,
  ResultStats,
} from "../../../ts/states/result";
import { blendTwoHexColors } from "../../../ts/utils/colors";
import * as DateTime from "../../../ts/utils/date-and-time";
import * as Strings from "../../../ts/utils/strings";
import { isFunboxActiveWithProperty } from "./funbox/list";

type ResultForStats = Pick<
  CompletedEvent,
  | "wpm"
  | "rawWpm"
  | "acc"
  | "consistency"
  | "keyConsistency"
  | "testDuration"
  | "afkDuration"
  | "charStats"
  | "language"
  | "mode"
  | "mode2"
  | "bailedOut"
>;

type Accuracy = { correct: number; incorrect: number };

export type ResultStatsOptions = {
  // null = no event log, hover labels are left out
  accuracy: Accuracy | null;
  quote: { group?: number; source?: string } | null;
  testInvalid: boolean;
  difficultyFailed: boolean;
  failReason: string;
  afkDetected: boolean;
  isRepeated: boolean;
  tooShort: boolean;
};

export function buildSpeedStats(
  result: ResultForStats,
  accuracy: Accuracy | null,
): ResultSpeedStats {
  const unit = getMutableConfig().typingSpeedUnit;
  const stats: ResultSpeedStats = {
    typingSpeedUnit: unit,
    wpm: {
      text: result.wpm >= 1000 ? "Infinite" : Format.typingSpeed(result.wpm),
    },
    raw: { text: Format.typingSpeed(result.rawWpm) },
    acc: {
      text: result.acc === 100 ? "100%" : Format.accuracy(result.acc),
      balloonBreak: false,
    },
  };

  if (accuracy === null) return stats;

  if (getMutableConfig().alwaysShowDecimalPlaces) {
    if (unit !== "wpm") {
      stats.wpm.ariaLabel = `${result.wpm.toFixed(2)} wpm`;
      stats.raw.ariaLabel = `${result.rawWpm.toFixed(2)} wpm`;
    }
    stats.acc.ariaLabel = `${accuracy.correct} correct\n${accuracy.incorrect} incorrect`;
  } else {
    const decimalsAndSuffix = {
      showDecimalPlaces: true,
      suffix: ` ${unit}`,
    };
    let wpmHover = Format.typingSpeed(result.wpm, decimalsAndSuffix);
    let rawWpmHover = Format.typingSpeed(result.rawWpm, decimalsAndSuffix);

    if (unit !== "wpm") {
      wpmHover += ` (${result.wpm.toFixed(2)} wpm)`;
      rawWpmHover += ` (${result.rawWpm.toFixed(2)} wpm)`;
    }

    stats.wpm.ariaLabel = wpmHover;
    stats.raw.ariaLabel = rawWpmHover;
    stats.acc.ariaLabel = `${
      result.acc === 100
        ? "100%"
        : Format.percentage(result.acc, { showDecimalPlaces: true })
    }\n${accuracy.correct} correct\n${accuracy.incorrect} incorrect`;
    stats.acc.balloonBreak = true;
  }

  return stats;
}

function buildTime(result: ResultForStats): ResultStats["time"] {
  const afkSecondsPercent = Numbers.roundTo2(
    (result.afkDuration / result.testDuration) * 100 || 0,
  );
  const afk = afkSecondsPercent > 0 ? `${afkSecondsPercent}% afk` : "";

  if (getMutableConfig().alwaysShowDecimalPlaces) {
    let text = `${Numbers.roundTo2(result.testDuration).toFixed(2)}s`;
    if (result.testDuration > 61) {
      text = DateTime.secondsToString(Numbers.roundTo2(result.testDuration));
    }
    return {
      text,
      afk,
      ariaLabel: `${result.afkDuration}s afk ${afkSecondsPercent}%`,
    };
  }

  let text = `${Math.round(result.testDuration)}s`;
  if (result.testDuration > 61) {
    text = DateTime.secondsToString(Math.round(result.testDuration));
  }
  return {
    text,
    afk,
    ariaLabel: `${Numbers.roundTo2(result.testDuration)}s (${
      result.afkDuration
    }s afk ${afkSecondsPercent}%)`,
  };
}

function buildTestType(
  result: ResultForStats,
  quote: ResultStatsOptions["quote"],
): string[] {
  let first: string = getMutableConfig().mode;
  if (getMutableConfig().mode === "time") {
    first += ` ${getMutableConfig().time}`;
  } else if (getMutableConfig().mode === "words") {
    first += ` ${getMutableConfig().words}`;
  } else if (getMutableConfig().mode === "quote") {
    if (quote?.group !== undefined) {
      first += ` ${["short", "medium", "long", "thicc"][quote.group]}`;
    }
  }

  const lines = [first];
  const ignoresLanguage = isFunboxActiveWithProperty("ignoresLanguage");
  if (getMutableConfig().mode !== "custom" && !ignoresLanguage) {
    lines.push(Strings.getLanguageDisplayString(result.language));
  }
  if (getMutableConfig().punctuation) lines.push("punctuation");
  if (getMutableConfig().numbers) lines.push("numbers");
  if (getMutableConfig().blindMode) lines.push("blind");
  if (getMutableConfig().lazyMode) lines.push("lazy");
  if (getMutableConfig().funbox.length > 0) {
    lines.push(
      getMutableConfig()
        .funbox.map((it) => it.replace(/_/g, " "))
        .join(", "),
    );
  }
  if (getMutableConfig().difficulty === "expert") {
    lines.push("expert");
  } else if (getMutableConfig().difficulty === "master") {
    lines.push("master");
  }
  if (getMutableConfig().stopOnError !== "off") {
    lines.push(`stop on ${getMutableConfig().stopOnError}`);
  }
  if (getMutableConfig().deleteOnError !== "off") {
    lines.push(
      `delete on ${getMutableConfig().deleteOnError.replace(/_/g, " ")}`,
    );
  }
  return lines;
}

function buildOther(
  result: ResultForStats,
  options: ResultStatsOptions,
): string[] {
  const lines: string[] = [];
  if (options.difficultyFailed) {
    lines.push(`failed (${options.failReason})`);
  }
  if (options.afkDetected) {
    lines.push("afk detected");
  }
  if (options.testInvalid) {
    let invalid = "invalid";
    const extra: string[] = [];
    if (
      result.wpm < 0 ||
      (result.wpm > 350 && result.mode !== "words" && result.mode2 !== "10") ||
      (result.wpm > 420 && result.mode === "words" && result.mode2 === "10")
    ) {
      extra.push("wpm");
    }
    if (
      result.rawWpm < 0 ||
      (result.rawWpm > 350 &&
        result.mode !== "words" &&
        result.mode2 !== "10") ||
      (result.rawWpm > 420 && result.mode === "words" && result.mode2 === "10")
    ) {
      extra.push("raw");
    }
    if (result.acc < 75 || result.acc > 100) {
      extra.push("accuracy");
    }
    if (extra.length > 0) {
      invalid += ` (${extra.join(",")})`;
    }
    lines.push(invalid);
  }
  if (options.isRepeated) lines.push("repeated");
  if (result.bailedOut) lines.push("bailed out");
  if (options.tooShort) lines.push("too short");
  return lines;
}

export function buildResultStats(
  result: ResultForStats,
  options: ResultStatsOptions,
): ResultStats {
  return {
    ...buildSpeedStats(result, options.accuracy),
    consistency: {
      text: Format.percentage(result.consistency),
      ariaLabel: getMutableConfig().alwaysShowDecimalPlaces
        ? Format.percentage(result.keyConsistency, {
            showDecimalPlaces: true,
            suffix: " key",
          })
        : `${result.consistency}% (${result.keyConsistency}% key)`,
    },
    time: buildTime(result),
    characters: `${result.charStats[0]}/${result.charStats[1]}/${result.charStats[2]}/${result.charStats[3]}`,
    testType: buildTestType(result, options.quote),
    other: buildOther(result, options),
    source:
      getMutableConfig().mode === "quote"
        ? (options.quote?.source ?? "Error: Source unknown")
        : undefined,
  };
}

export type CanGetPb = {
  value: boolean;
  reason?: string;
};

// null = no crown. pbDiff is result wpm minus local pb wpm.
export function buildCrown(
  canGetPb: CanGetPb,
  pbDiff: number,
): { type: ResultCrownType; text: string; wide: boolean } | null {
  if (canGetPb.value) {
    if (pbDiff <= 0) return null;
    //half crown as the pb is not confirmed by the server
    return {
      type: "pending",
      text: `+${Format.typingSpeed(pbDiff, { showDecimalPlaces: true })}`,
      wide: false,
    };
  }
  if (pbDiff <= 0) {
    return {
      type: "warning",
      text: `This result is not eligible for a new PB (${canGetPb.reason})`,
      wide: true,
    };
  }
  return {
    type: "ineligible",
    text: `You could've gotten a new PB (+${Format.typingSpeed(pbDiff, {
      showDecimalPlaces: true,
    })}), but your config does not allow it (${canGetPb.reason})`,
    wide: true,
  };
}

export type BurstHeatmap = {
  steps: { val: number; colorId: number }[];
  colors: string[];
  unreachedColor: string;
  // legend box texts, one per step
  legend: string[];
};

export function buildBurstHeatmap(
  burstHistory: number[],
  fromWpm: (wpm: number) => number,
  themeColors: Theme,
): BurstHeatmap {
  let burstlist = [...burstHistory];

  burstlist = burstlist.map((x) => (x >= 1000 ? Infinity : x));

  burstlist.forEach((burst, index) => {
    burstlist[index] = Math.round(fromWpm(burst));
  });

  let colors = [
    themeColors.colorfulError,
    blendTwoHexColors(themeColors.colorfulError, themeColors.text, 0.5),
    themeColors.text,
    blendTwoHexColors(themeColors.main, themeColors.text, 0.5),
    themeColors.main,
  ];
  let unreachedColor = themeColors.sub;

  if (themeColors.main === themeColors.text) {
    colors = [
      themeColors.colorfulError,
      blendTwoHexColors(themeColors.colorfulError, themeColors.text, 0.5),
      themeColors.sub,
      blendTwoHexColors(themeColors.sub, themeColors.text, 0.5),
      themeColors.main,
    ];
    unreachedColor = themeColors.subAlt;
  }

  const burstlistSorted = burstlist.sort((a, b) => a - b);
  const burstlistLength = burstlist.length;

  const steps = [
    {
      val: 0,
      colorId: 0,
    },
    {
      val: burstlistSorted[(burstlistLength * 0.15) | 0] as number,
      colorId: 1,
    },
    {
      val: burstlistSorted[(burstlistLength * 0.35) | 0] as number,
      colorId: 2,
    },
    {
      val: burstlistSorted[(burstlistLength * 0.65) | 0] as number,
      colorId: 3,
    },
    {
      val: burstlistSorted[(burstlistLength * 0.85) | 0] as number,
      colorId: 4,
    },
  ];

  const legend = steps.map((step, index) => {
    const nextStep = steps[index + 1];
    let string = "";
    if (index === 0 && nextStep) {
      string = `<${Math.round(nextStep.val)}`;
    } else if (index === 4) {
      string = `${Math.round(step.val)}+`;
    } else if (nextStep) {
      if (step.val !== nextStep.val) {
        string = `${Math.round(step.val)}-${Math.round(nextStep.val) - 1}`;
      } else {
        string = `${Math.round(step.val)}-${Math.round(step.val)}`;
      }
    }
    return string;
  });

  return { steps, colors, unreachedColor, legend };
}

/**
 * Heatmap color of a words history word. `inherit` = letters take the word
 * color instead of their own.
 */
export function getBurstHeatmapWordColor(
  heatmap: BurstHeatmap,
  burst: number | undefined,
  fromWpm: (wpm: number) => number,
): { color: string; inherit: boolean } | undefined {
  if (burst === undefined) {
    return { color: heatmap.unreachedColor, inherit: false };
  }
  // legacy read the value back from the word's burst attribute
  const wordBurstVal = Math.round(fromWpm(parseInt(String(burst))));
  let out: { color: string; inherit: boolean } | undefined;
  heatmap.steps.forEach((step) => {
    if (wordBurstVal >= step.val) {
      out = { color: heatmap.colors[step.colorId] as string, inherit: true };
    }
  });
  return out;
}
