import { ChallengeName } from "@caret/schemas/challenges";
import {
  Config,
  Difficulty,
  FunboxName,
  ThemeName,
} from "@caret/schemas/configs";
import { Mode } from "@caret/schemas/shared";
import { CustomTextLimitMode, CustomTextMode } from "@caret/schemas/util";

export type Challenge = {
  name: ChallengeName;
  display: string;
  description: string;
  isHidden?: boolean;
  category: "other" | "endurance" | "script" | "speed" | "accuracy" | "funbox";
  settings: ChallengeSettings;
};
type ChallengeParameter =
  | {
      type: "customTime";
      parameters: { time: number };
    }
  | { type: "customWords"; parameters: { words: number } }
  | {
      type: "customText";
      parameters: {
        text: string;
        mode: CustomTextMode;
        limit: number;
        limitMode: CustomTextLimitMode;
        isPipeDelimiter: boolean;
      };
    }
  | {
      type: "script";
      parameters: {
        script: string;
        theme?: ThemeName;
        funboxes?: FunboxName[];
      };
    }
  | { type: "accuracy" }
  | {
      type: "funbox";
      parameters: {
        funbox: FunboxName;
        difficulty?: Difficulty;
      } & (
        | { mode: "time" | "words"; mode2: number }
        | { mode: Exclude<Mode, "time" | "words"> }
      );
    }
  | { type: "other" };
export type ChallengeSettings = {
  message?: string;
  requirements?: {
    wpm?: { min: number } | { exact: number };
    acc?: { min: number } | { exact: number };
    raw?: { exact: number };
    con?: { exact: number };
    afk?: { max: number };
    time?: { min: number };
    funbox?: { exact: FunboxName[] };
    config?: Partial<Config>;
  };
} & ChallengeParameter;
