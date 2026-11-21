import { describe, expect, it } from "vite-plus/test";
import { legacyHash as objectHash } from "@caret/web-shared/legacy-hash";
import {
  storedSubmissionHashes,
  submissionHash,
} from "../../../src/services/operations/result/identity";
import { completedEvent } from "../../__testData__/completed-event";

describe("result submission identity", () => {
  it("binds the hash to the actor, not the client-supplied uid", () => {
    const result = completedEvent({ uid: "forged" });
    expect(submissionHash(result, "actor")).toBe(
      submissionHash(completedEvent({ uid: "actor" }), "actor"),
    );
    expect(submissionHash(result, "actor")).not.toBe(
      submissionHash(result, "other"),
    );
  });

  it("ignores the client hash and reconnect transport state", () => {
    const online = completedEvent({ offline: false, hash: "a" });
    const offline = completedEvent({ offline: true, hash: "b" });
    expect(submissionHash(online, "actor")).toBe(
      submissionHash(offline, "actor"),
    );
  });

  it("lists the stable hash first, then legacy payload hashes", () => {
    const result = completedEvent({ uid: "actor", offline: true });
    const { hash: _hash, ...payload } = result;
    expect(storedSubmissionHashes(result, "actor")).toEqual([
      submissionHash(result, "actor"),
      result.hash,
      objectHash({ ...payload, offline: false }),
      objectHash(payload),
    ]);
  });
});
