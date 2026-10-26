import {
  MAX_RESULT_EVENT_LOG_CHARS,
  type ResultEventLog,
} from "@caret/contracts/results";
import type { WebLog } from "@caret/typing-engine/text";
import { versions } from "@caret/typing-engine/versions";

// Results and their logs share the server's 100 KiB request ceiling.
const MAX_REQUEST_CHARS = 96 * 1024;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  // chunked: spreading a whole log into fromCharCode overflows the stack
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

/**
 * The event log a result was scored from, compressed for submission so the
 * server can replay it. Undefined when it would not fit or cannot be encoded:
 * a result always saves, with or without its log.
 */
export async function encodeEventLog(
  log: WebLog,
  result: object,
): Promise<ResultEventLog | undefined> {
  if (typeof CompressionStream !== "function") return undefined;
  try {
    const compressed = new Blob([JSON.stringify(log)])
      .stream()
      .pipeThrough(new CompressionStream("gzip"));
    const encoded = toBase64(
      new Uint8Array(await new Response(compressed).arrayBuffer()),
    );
    if (encoded.length > MAX_RESULT_EVENT_LOG_CHARS) return undefined;
    const eventLog = { behaviorVersion: versions.behavior, log: encoded };
    if (JSON.stringify({ result, eventLog }).length > MAX_REQUEST_CHARS) {
      return undefined;
    }
    return eventLog;
  } catch {
    return undefined;
  }
}
