import { batch, createSignal } from "solid-js";
import { appSignal } from "../../app/state";
import { requireApplication } from "../../app/application";
import type { AuthUser } from "../../ts/auth-types";
const [getAuthenticatedUser, setAuthenticatedUser] = appSignal(() =>
  createSignal<AuthUser | null>(null),
);
export { getAuthenticatedUser };

export function setUserState(user: AuthUser | null): void {
  batch(() => {
    requireApplication().accountData.setActor(user?.uid ?? null);
    setAuthenticatedUser(user);
  });
}
