import { createAppOwned } from "../../app/application";
import { getBrowserEngine } from "./engine.client";
import { decodeText, toEngineLog } from "@oxytype/typing-engine/text";
import type { WebLog } from "@oxytype/typing-engine/text";
import type { Query, Response } from "@oxytype/typing-engine/browser.client";

type Stats = Extract<Response, { op: "stats" }>["stats"];
type Inspection = Extract<Response, { op: "inspect" }>["inspection"];
/** Completed logs are immutable. Cache derived views per app without retaining logs. */
const analysis = createAppOwned(() => {
  const owner = getBrowserEngine();
  const results = new WeakMap<WebLog, Stats>();
  const inspections = new WeakMap<WebLog, Inspection>();
  return {
    query: <Q extends Query>(log: WebLog, query: Q) =>
      owner.api().analyze(toEngineLog(log), query),
    stats: (log: WebLog): Stats => {
      let value = results.get(log);
      if (value === undefined) {
        value = owner.api().analyze(toEngineLog(log), {
          op: "stats",
          now: performance.now(),
        }).stats;
        results.set(log, value);
      }
      return value;
    },
    inspect: (log: WebLog): Inspection => {
      let value = inspections.get(log);
      if (value === undefined) {
        value = owner
          .api()
          .analyze(toEngineLog(log), { op: "inspect" }).inspection;
        inspections.set(log, value);
      }
      return value;
    },
  };
});
export const analyze = <Q extends Query>(
  log: WebLog,
  query: Q,
): Extract<Response, { op: Q["op"] }> => analysis().query(log, query);
export const getAnalysis = (log: WebLog): Stats => analysis().stats(log);
export const getInspection = (log: WebLog): Inspection =>
  analysis().inspect(log);
export const getInputHistory = (log: WebLog): string[] =>
  getAnalysis(log).inputHistory.map(decodeText);
export const getCorrectedWordsHistory = (log: WebLog): string[] =>
  getAnalysis(log).correctedWordsHistory.map(decodeText);
// Positive infinity is represented by null in JSON; never used for submitted scores.
export const getWordBurstHistory = (log: WebLog): number[] =>
  getAnalysis(log).wordBurstHistory.map((value) => value ?? Infinity);
export const getMissedWords = (log: WebLog): Record<string, number> =>
  Object.fromEntries(
    getAnalysis(log).missedWords.map(([word, count]) => [
      decodeText(word),
      count,
    ]),
  );
export const getRawHistory = (log: WebLog): number[] =>
  getAnalysis(log).rawHistory;
export const getWpmHistory = (log: WebLog): number[] =>
  getAnalysis(log).summary.chartData.wpm;
export const getWordIndexesForSecond = (
  log: WebLog,
  second: number,
): number[] => getAnalysis(log).wordIndexesPerSecond[second] ?? [];
export const getTimerBoundaryLabels = (
  log: WebLog,
  showLag = true,
): string[] =>
  showLag ? getAnalysis(log).boundaryLabels : getInspection(log).boundaryLabels;
export const getAccuracy = (log: WebLog): Inspection["accuracy"] =>
  getInspection(log).accuracy;
export const getKeypressDurations = (log: WebLog): number[] =>
  getInspection(log).keyDuration;
export const getKeypressSpacing = (log: WebLog): number[] =>
  getInspection(log).keySpacing;
