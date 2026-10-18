import { Configuration } from "@oxytype/schemas/configuration";

import { CompletedEvent, XpBreakdown } from "@oxytype/schemas/results";
import { isSafeNumber, mapRange } from "@oxytype/util/numbers";
import {
  getCurrentDayTimestamp,
  getStartOfDayTimestamp,
} from "@oxytype/util/date-and-time";

import { getFunbox } from "@oxytype/funbox";

export type XpResult = {
  xp: number;
  dailyBonus?: boolean;
  breakdown?: XpBreakdown;
};

export async function calculateXp(
  result: CompletedEvent,
  xpConfiguration: Configuration["users"]["xp"],
  lastResultTimestamp: number | null,
  currentTotalXp: number,
  streak: number,
): Promise<XpResult> {
  const {
    mode,
    acc,
    testDuration,
    incompleteTestSeconds,
    incompleteTests,
    afkDuration,
    charStats,
    punctuation,
    numbers,
    funbox: resultFunboxes,
  } = result;

  const {
    enabled,
    gainMultiplier,
    maxDailyBonus,
    minDailyBonus,
    funboxBonus: funboxBonusConfiguration,
  } = xpConfiguration;

  if (mode === "zen" || !enabled) {
    return {
      xp: 0,
    };
  }

  const breakdown: XpBreakdown = {};

  const baseXp = Math.round((testDuration - afkDuration) * 2);
  breakdown.base = baseXp;

  let modifier = 1;

  const correctedEverything = charStats
    .slice(1)
    .every((charStat: number) => charStat === 0);

  if (acc === 100) {
    modifier += 0.5;
    breakdown.fullAccuracy = Math.round(baseXp * 0.5);
  } else if (correctedEverything) {
    // corrected everything bonus
    modifier += 0.25;
    breakdown.corrected = Math.round(baseXp * 0.25);
  }

  if (mode === "quote") {
    // real sentences bonus
    modifier += 0.5;
    breakdown.quote = Math.round(baseXp * 0.5);
  } else {
    // punctuation bonus
    if (punctuation) {
      modifier += 0.4;
      breakdown.punctuation = Math.round(baseXp * 0.4);
    }
    if (numbers) {
      modifier += 0.1;
      breakdown.numbers = Math.round(baseXp * 0.1);
    }
  }

  if (funboxBonusConfiguration > 0 && resultFunboxes.length !== 0) {
    const funboxModifier = resultFunboxes.reduce((sum, funboxName) => {
      const funbox = getFunbox(funboxName);
      const difficultyLevel = funbox?.difficultyLevel ?? 0;
      return sum + Math.max(difficultyLevel * funboxBonusConfiguration, 0);
    }, 0);

    if (funboxModifier > 0) {
      modifier += funboxModifier;
      breakdown.funbox = Math.round(baseXp * funboxModifier);
    }
  }

  if (xpConfiguration.streak.enabled) {
    const streakModifier = parseFloat(
      mapRange(
        streak,
        0,
        xpConfiguration.streak.maxStreakDays,
        0,
        xpConfiguration.streak.maxStreakMultiplier,
        true,
      ).toFixed(1),
    );

    if (streakModifier > 0) {
      modifier += streakModifier;
      breakdown.streak = Math.round(baseXp * streakModifier);
    }
  }

  let incompleteXp = 0;
  if (incompleteTests !== undefined && incompleteTests.length > 0) {
    incompleteTests.forEach((it: { acc: number; seconds: number }) => {
      let mod = (it.acc - 50) / 50;
      if (mod < 0) mod = 0;
      incompleteXp += Math.round(it.seconds * mod);
    });
    breakdown.incomplete = incompleteXp;
  } else if (incompleteTestSeconds && incompleteTestSeconds > 0) {
    incompleteXp = Math.round(incompleteTestSeconds);
    breakdown.incomplete = incompleteXp;
  }

  const accuracyModifier = (acc - 50) / 50;

  let dailyBonus = 0;
  if (isSafeNumber(lastResultTimestamp)) {
    const lastResultDay = getStartOfDayTimestamp(lastResultTimestamp);
    const today = getCurrentDayTimestamp();
    if (lastResultDay !== today) {
      const proportionalXp = Math.round(currentTotalXp * 0.05);
      dailyBonus = Math.max(
        Math.min(maxDailyBonus, proportionalXp),
        minDailyBonus,
      );
      breakdown.daily = dailyBonus;
    }
  }

  const xpWithModifiers = Math.round(baseXp * modifier);

  const xpAfterAccuracy = Math.round(xpWithModifiers * accuracyModifier);
  breakdown.accPenalty = xpWithModifiers - xpAfterAccuracy;

  const totalXp =
    Math.round((xpAfterAccuracy + incompleteXp) * gainMultiplier) + dailyBonus;

  if (gainMultiplier !== 1) {
    // breakdown.push([
    //   "configMultiplier",
    //   Math.round((xpAfterAccuracy + incompleteXp) * (gainMultiplier - 1)),
    // ]);
    breakdown.configMultiplier = gainMultiplier;
  }

  const isAwardingDailyBonus = dailyBonus > 0;

  return {
    xp: totalXp,
    dailyBonus: isAwardingDailyBonus,
    breakdown,
  };
}
