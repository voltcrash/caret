import { createAppSignal } from "#app/state.ts";
import { UserProfile } from "@caret/schemas/users";

export const [getUserToReport, setUserToReport] =
  createAppSignal<UserProfile | null>(null);
