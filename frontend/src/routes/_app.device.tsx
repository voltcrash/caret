import { createFileRoute } from "@tanstack/solid-router";

import { DevicePage } from "../features/auth/device-page";
import { getSessionState } from "../functions/session";
export const Route = createFileRoute("/_app/device")({
  validateSearch: (search) => ({
    user_code:
      typeof search["user_code"] === "string"
        ? search["user_code"].slice(0, 32)
        : undefined,
  }),
  loader: async () => await getSessionState(),
  head: () => ({ meta: [{ title: "Authorize terminal | Oxytype" }] }),
  component: Device,
});
function Device() {
  const session = Route.useLoaderData();
  const search = Route.useSearch();
  return <DevicePage session={session()} code={search().user_code} />;
}
