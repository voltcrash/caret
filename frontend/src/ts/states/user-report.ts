import { createAppSignal } from "../../app/state";
import { UserProfile } from "@caret/schemas/users";

export const [getUserToReport, setUserToReport] =
  createAppSignal<UserProfile | null>(null);
