import { Mode2Schema, ModeSchema } from "@caret/schemas/shared";
import type { CompletedEvent } from "@caret/schemas/results";
import { z } from "zod";

import type { SessionState } from "@caret/schemas/auth-session";
import { sessionKey } from "../../auth/session";
import { getQueryClient } from "../../../data/queries";
import { appSignal, createAccountSignal } from "../../../app/state";
import { useLocalStorage } from "../../../ts/hooks/useLocalStorage";

const limit = 10;
const scoreSchema = z.object({
  mode: ModeSchema,
  mode2: Mode2Schema,
  timestamp: z.number().int().nonnegative(),
  wpm: z.number().nonnegative(),
  acc: z.number().min(0).max(100),
});

const [getGuestScores, setGuestScores] = appSignal(() =>
  useLocalStorage({
    key: "caret-guest-scores-v1",
    schema: z.array(scoreSchema).max(limit),
    fallback: [],
  }),
);
export { getGuestScores };

// A session change during the test disposes this flag with the old account.
const [startedAsGuest, setStartedAsGuest] = createAccountSignal(false);

export function beginGuestScore(): void {
  setStartedAsGuest(
    getQueryClient().getQueryData<SessionState>(sessionKey)?.user === null,
  );
}

export function recordGuestScore({
  mode,
  mode2,
  timestamp,
  wpm,
  acc,
}: CompletedEvent): void {
  if (!startedAsGuest()) return;
  setGuestScores((scores) =>
    [{ mode, mode2, timestamp, wpm, acc }, ...scores].slice(0, limit),
  );
}
