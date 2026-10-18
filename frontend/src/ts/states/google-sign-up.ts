import { createAppSignal } from "../../app/state";
import type { UserCredential } from "../auth-types";

const [pendingUser, setPendingUser] = createAppSignal<UserCredential>();

export function getPendingGoogleSignUpUser(): UserCredential | undefined {
  return pendingUser();
}

export function setPendingGoogleSignUpUser(
  user: UserCredential | undefined,
): void {
  setPendingUser(user);
}
