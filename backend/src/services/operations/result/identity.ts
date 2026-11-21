import type { CompletedEvent } from "@caret/schemas/results";
import { legacyHash as objectHash } from "@caret/web-shared/legacy-hash";
import { omit } from "../../../utils/misc";

/** The payload the client hashed, bound to the submitting actor. */
export function hashedPayload(
  result: CompletedEvent,
  uid: string,
): Omit<CompletedEvent, "hash"> {
  return omit({ ...result, uid }, ["hash"]);
}

/**
 * Stable identity of a submission. Transport state changes on reconnect, so
 * `offline` is excluded. Compute before server normalization mutates it.
 */
export function submissionHash(result: CompletedEvent, uid: string): string {
  return objectHash(omit(hashedPayload(result, uid), ["offline"]));
}

/**
 * Every hash a saved copy of this submission may be stored under, stable
 * first. Retained queues may retry results saved before stable hashes were
 * deployed; those stored the client's online or offline payload hash.
 */
export function storedSubmissionHashes(
  result: CompletedEvent,
  uid: string,
): [stable: string, ...legacy: string[]] {
  const payload = hashedPayload(result, uid);
  return [
    submissionHash(result, uid),
    result.hash,
    objectHash({ ...payload, offline: false }),
    objectHash({ ...payload, offline: true }),
  ];
}
