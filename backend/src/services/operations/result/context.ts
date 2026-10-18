import type { clientProfile } from "../../../db/client-profile";
import type { DBUser } from "../../../dal/user";
import type { AddResultRequest } from "@oxytype/contracts/results";
import type { CompletedEvent, KeyStats } from "@oxytype/schemas/results";
import type { ServiceContext, OperationInput } from "../../context";

export type ValidatedSubmission = {
  context: ServiceContext;
  input: OperationInput<undefined, AddResultRequest>;
  uid: string;
  user: DBUser;
  completedEvent: CompletedEvent;
  profile: ReturnType<typeof clientProfile>;
  offline: boolean;
  resulthash: string;
  submissionHash: string;
  lastResultTimestamp: number | null;
  keySpacingStats: KeyStats | undefined;
  keyDurationStats: KeyStats | undefined;
};
