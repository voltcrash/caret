import type { DBUser } from "../../../dal/user";
import type { AddResultRequest } from "@caret/contracts/results";
import type { CompletedEvent, KeyStats, Result } from "@caret/schemas/results";
import type { Mode } from "@caret/schemas/shared";
import type { ServiceContext, OperationInput } from "../../context";

export function qualifiesForRanked(
  context: ServiceContext,
  verdict: Result<Mode>["verification"],
): boolean {
  return (
    !context.configuration.anticheat.logVerification.requireForRanked ||
    verdict === "verified"
  );
}

export type ValidatedSubmission = {
  context: ServiceContext;
  input: OperationInput<undefined, AddResultRequest>;
  uid: string;
  user: DBUser;
  completedEvent: CompletedEvent;
  profile: DBUser;
  offline: boolean;
  resulthash: string;
  submissionHash: string;
  lastResultTimestamp: number | null;
  keySpacingStats: KeyStats | undefined;
  keyDurationStats: KeyStats | undefined;
  verification: NonNullable<Result<Mode>["verification"]>;
};
