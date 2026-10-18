import type { Challenge, ChallengeSettings, ChallengeResult } from "./types";
import { Config } from "@oxytype/schemas/configs";

function verifyRequirement(
  result: ChallengeResult,
  config: Readonly<Config>,
  requirements: NonNullable<ChallengeSettings["requirements"]>,
  requirementType: keyof NonNullable<ChallengeSettings["requirements"]>,
): [boolean, string[]] {
  let requirementsMet = true;
  let failReasons: string[] = [];

  const afk = (result.afkDuration / result.testDuration) * 100;

  if (requirements[requirementType] === undefined) {
    throw new Error("Requirement value is undefined");
  }

  if (requirementType === "wpm" && requirements.wpm) {
    const requirementValue = requirements.wpm;
    if ("exact" in requirementValue) {
      if (Math.round(result.wpm) !== requirementValue.exact) {
        requirementsMet = false;
        failReasons.push(`WPM not ${requirementValue.exact}`);
      }
    } else if ("min" in requirementValue) {
      if (result.wpm < requirementValue.min) {
        requirementsMet = false;
        failReasons.push(`WPM below ${requirementValue.min}`);
      }
    }
  } else if (requirementType === "acc" && requirements.acc) {
    const requirementValue = requirements.acc;
    if ("exact" in requirementValue) {
      if (result.acc !== requirementValue.exact) {
        requirementsMet = false;
        failReasons.push(`Accuracy not ${requirementValue.exact}`);
      }
    } else if ("min" in requirementValue) {
      if (result.acc < requirementValue.min) {
        requirementsMet = false;
        failReasons.push(`Accuracy below ${requirementValue.min}`);
      }
    }
  } else if (requirementType === "afk" && requirements.afk) {
    const requirementValue = requirements.afk;
    if (requirementValue.max) {
      if (Math.round(afk) > requirementValue.max) {
        requirementsMet = false;
        failReasons.push(`AFK percentage above ${requirementValue.max}`);
      }
    }
  } else if (requirementType === "time" && requirements.time) {
    const requirementValue = requirements.time;
    if (requirementValue.min) {
      if (Math.round(result.testDuration) < requirementValue.min) {
        requirementsMet = false;
        failReasons.push(`Test time below ${requirementValue.min}`);
      }
    }
  } else if (requirementType === "funbox" && requirements.funbox) {
    const funboxMode = requirements.funbox.exact;
    if (funboxMode === undefined) {
      throw new Error("Funbox mode is undefined");
    }

    if (
      funboxMode.length !== result.funbox.length ||
      funboxMode.some((name) => !result.funbox.includes(name))
    ) {
      requirementsMet = false;
      for (const f of funboxMode) {
        if (!result.funbox?.includes(f)) {
          failReasons.push(`${f} funbox not active`);
        }
      }
      if (result.funbox !== undefined && result.funbox.length > 0) {
        for (const f of result.funbox) {
          if (!funboxMode.includes(f)) {
            failReasons.push(`${f} funbox active`);
          }
        }
      }
    }
  } else if (requirementType === "raw" && requirements.raw) {
    const requirementValue = requirements.raw;
    if (requirementValue.exact) {
      if (Math.round(result.rawWpm) !== requirementValue.exact) {
        requirementsMet = false;
        failReasons.push(`Raw WPM not ${requirementValue.exact}`);
      }
    }
  } else if (requirementType === "con" && requirements.con) {
    const requirementValue = requirements.con;
    if (requirementValue.exact) {
      if (Math.round(result.consistency) !== requirementValue.exact) {
        requirementsMet = false;
        failReasons.push(`Consistency not ${requirementValue.exact}`);
      }
    }
  } else if (requirementType === "config" && requirements.config) {
    const requirementValue = requirements.config;
    for (const configKey of Object.keys(requirementValue) as (keyof Config)[]) {
      const configValue = requirementValue[configKey];
      if (config[configKey] !== configValue) {
        requirementsMet = false;
        failReasons.push(`${configKey} not set to ${configValue}`);
      }
    }
  }
  return [requirementsMet, failReasons];
}
/** Challenge verification; no rendering or side effects. */
export function verifyChallenge(
  result: ChallengeResult,
  config: Readonly<Config>,
  challenge: Challenge,
): string[] {
  if ((result.afkDuration / result.testDuration) * 100 > 10) {
    return ["AFK time is greater than 10%"];
  }
  const requirements = challenge.settings.requirements;
  if (requirements === undefined) return [];
  return (Object.keys(requirements) as (keyof typeof requirements)[]).flatMap(
    (type) => verifyRequirement(result, config, requirements, type)[1],
  );
}
