import { FunboxName } from "@caret/schemas/configs";
import { Client, Difficulty, Mode, Mode2 } from "@caret/schemas/shared";
import { SnapshotResult, SavedResult } from "../../constants/default-snapshot";

export type ResultsQueryState = {
  client?: Client;
  difficulty: SnapshotResult<Mode>["difficulty"][];
  pb: SnapshotResult<Mode>["isPb"][];
  mode: SnapshotResult<Mode>["mode"][];
  words: ("10" | "25" | "50" | "100" | "custom")[];
  time: ("15" | "30" | "60" | "120" | "custom")[];
  punctuation: SnapshotResult<Mode>["punctuation"][];
  numbers: SnapshotResult<Mode>["numbers"][];
  timestamp: SnapshotResult<Mode>["timestamp"];
  quoteLength: SnapshotResult<Mode>["quoteLength"][];
  tags: SnapshotResult<Mode>["tags"];
  funbox: SnapshotResult<Mode>["funbox"];
  language: SnapshotResult<Mode>["language"][];
};

export type ResultStats = {
  words: number;
  restarted: number;
  completed: number;
  maxWpm: number;
  avgWpm: number;
  maxRaw: number;
  avgRaw: number;
  maxAcc: number;
  avgAcc: number;
  maxConsistency: number;
  avgConsistency: number;
  timeTyping: number;
  dayTimestamp?: number;
};

export type UpdateTagsResult = { tagPbs: string[] };

export type ActionType = {
  updateTags: {
    client?: Client;
    resultId: string;
    currentTagIds: string[];
    newTagIds: string[];
  };
  insertLocalResult: {
    result: SnapshotResult<Mode> | SavedResult;
  };
  deleteLocalTag: {
    tagId: string;
  };
};

export type CurrentSettingsFilter = {
  mode: Mode;
  mode2: Mode2<Mode>;
  punctuation: boolean;
  numbers: boolean;
  language: string;
  difficulty: Difficulty;
  lazyMode: boolean;
  funbox: FunboxName[];
};
