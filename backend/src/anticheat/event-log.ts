import { gunzipSync } from "node:zlib";
import type { ResultEventLog } from "@oxytype/contracts/results";
import type { CompletedEvent } from "@oxytype/schemas/results";
import {
  serverAudit,
  type Verification,
} from "@oxytype/typing-engine/audit.server";
import { toEngineLog, type WebLog } from "@oxytype/typing-engine/text";

// Keystroke logs compress about tenfold; this bounds a forged decompression bomb.
const MAX_DECODED_BYTES = 4 * 1024 * 1024;

type EventLogMismatch = {
  field: string;
  submitted: unknown;
  replayed: unknown;
};

/**
 * What replaying a submitted event log says about its result:
 * - verified: every metric matches the log.
 * - mismatch: the result claims something its own log does not produce.
 * - unverifiable: no conclusion, e.g. the client scored with other rules or
 *   sent a log the engine cannot read. Never grounds for rejection on its own.
 */
export type EventLogVerdict =
  | { kind: "verified" }
  | { kind: "mismatch"; mismatches: EventLogMismatch[] }
  | { kind: "unverifiable"; reason: string };

// Arrays are whole key timelines; audit logs keep their length, not the values.
function summarize(value: unknown): unknown {
  return Array.isArray(value) ? { length: value.length } : value;
}

function decode(eventLog: ResultEventLog): WebLog {
  const json = gunzipSync(Buffer.from(eventLog.log, "base64"), {
    maxOutputLength: MAX_DECODED_BYTES,
  }).toString("utf8");
  return JSON.parse(json) as WebLog;
}

/** Replay a result's event log with the Rust engine that scored it. */
export function verifyEventLog(
  result: CompletedEvent,
  eventLog: ResultEventLog,
): EventLogVerdict {
  let log: WebLog;
  try {
    log = decode(eventLog);
  } catch {
    return { kind: "unverifiable", reason: "undecodable" };
  }
  let verdict: Verification;
  try {
    // The engine validates every event; toEngineLog only re-encodes text.
    verdict = serverAudit().verify(
      toEngineLog(log),
      result,
      eventLog.behaviorVersion,
    );
  } catch {
    return { kind: "unverifiable", reason: "invalid-log" };
  }
  if (!verdict.sameBehavior) {
    return { kind: "unverifiable", reason: "other-behavior" };
  }
  if (verdict.mismatches.length === 0) return { kind: "verified" };
  return {
    kind: "mismatch",
    mismatches: verdict.mismatches.map(({ field, submitted, replayed }) => ({
      field,
      submitted: summarize(submitted),
      replayed: summarize(replayed),
    })),
  };
}
