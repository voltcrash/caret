import { createFileRoute } from "@tanstack/solid-router";

import { pageHead } from "../app/seo";
import { AuthPage } from "../features/auth/page";
import { authRedirect } from "../ts/session/redirect";
export const Route = createFileRoute("/_app/login")({
  validateSearch: (search) => ({
    redirect:
      typeof search["redirect"] === "string"
        ? authRedirect(search["redirect"])
        : undefined,
  }),
  loader: async () => (await import("../functions/session")).getSessionState(),
  head: () => pageHead("Sign in | Caret", "Sign in on Caret.", "/login", false),
  component: Login,
});
function Login() {
  const session = Route.useLoaderData();
  const search = Route.useSearch();
  return <AuthPage session={session()} redirect={search().redirect} />;
}
