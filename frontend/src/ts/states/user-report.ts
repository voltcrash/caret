import { createAppSignal } from "../../app/state";
import { UserProfile } from "@oxytype/schemas/users";

export const [getUserToReport, setUserToReport] =
  createAppSignal<UserProfile | null>(null);
