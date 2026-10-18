import { useQuery } from "@tanstack/solid-query";
import { createEffect, on } from "solid-js";

import { sessionOptions } from "../auth/session";
import { showPsas } from "./psas.client";

/** Loads announcements once the session settles and again per actor change. */
export function AnnouncementsRuntime(): null {
  const session = useQuery(() => sessionOptions());
  const bannered = new Set<string>();
  const actor = () =>
    session.isSuccess ? (session.data.user?.uid ?? null) : undefined;
  createEffect(
    on(actor, (uid) => {
      if (uid !== undefined) void showPsas(bannered);
    }),
  );
  return null;
}
