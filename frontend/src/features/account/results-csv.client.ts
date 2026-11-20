import type { Mode } from "@caret/schemas/shared";
import type { Result } from "@caret/schemas/results";
import { download } from "../../ts/components/common/Download";

function csvField(value: string | number | boolean | undefined): string {
  const field = String(value ?? "");
  return /[",\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

export function serializeResultsCsv(array: Result<Mode>[]): string {
  return [
    [
      "_id",
      "isPb",
      "wpm",
      "acc",
      "rawWpm",
      "consistency",
      "charStats",
      "mode",
      "mode2",
      "quoteLength",
      "restartCount",
      "testDuration",
      "afkDuration",
      "incompleteTestSeconds",
      "punctuation",
      "numbers",
      "language",
      "funbox",
      "difficulty",
      "lazyMode",
      "blindMode",
      "bailedOut",
      "tags",
      "timestamp",
      "client",
      "offline",
      "verification",
    ],
    ...array.map((item) => [
      item._id,
      item.isPb,
      item.wpm,
      item.acc,
      item.rawWpm,
      item.consistency,
      item.charStats.join(";"),
      item.mode,
      item.mode2,
      item.quoteLength,
      item.restartCount,
      item.testDuration,
      item.afkDuration,
      item.incompleteTestSeconds,
      item.punctuation,
      item.numbers,
      item.language,
      item.funbox?.join(","),
      item.difficulty,
      item.lazyMode,
      item.blindMode,
      item.bailedOut,
      item.tags?.join(";"),
      item.timestamp,
      item.client ?? "web",
      item.offline ?? false,
      item.verification ?? "legacy",
    ]),
  ]
    .map((row) => row.map(csvField).join(","))
    .join("\n");
}

export function downloadResultsCSV(array: Result<Mode>[]): void {
  const blob = new Blob([serializeResultsCsv(array)], { type: "text/csv" });
  download({ filename: "results.csv", data: blob });
}
