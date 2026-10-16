import { useQuery } from "@tanstack/solid-query";
import { createEffect, createMemo, on } from "solid-js";

import { requireApplication } from "../../app/application";
import { loadUser } from "../../ts/auth";
import { setAuthAvailable } from "../../ts/auth-client";
import { sessionOptions } from "../auth/session";

/**
 * Loads a registered actor's account snapshot, presets, tags, themes,
 * results and server preferences (local → server precedence) once per
 * identity. Unregistered sessions stay in the signup flow. Account state is
 * actor-scoped, so sign-out and account switches drop it automatically.
 * Stage 6 replaces the snapshot with query-owned account data.
 */
export function AccountRuntime(): null {
  const account = requireApplication().accountData;
  const session = useQuery(() => sessionOptions());
  createEffect(() => {
    if (session.isSuccess) setAuthAvailable(!import.meta.env.OXYTYPE_OFFLINE);
  });
  const registered = () => {
    const user = session.data?.user;
    return user?.registered === true ? user : undefined;
  };
  // Waits for the session owner to switch the actor, so the load's lease is current.
  const loadable = createMemo(() => {
    const uid = registered()?.uid;
    return uid !== undefined && account.actor() === uid ? uid : undefined;
  });
  createEffect(
    on(loadable, (uid) => {
      const user = registered();
      if (uid !== undefined && user !== undefined) void loadUser(user);
    }),
  );
  return null;
}
