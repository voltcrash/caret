import { createFileRoute, redirect } from "@tanstack/solid-router";

import { accountSettingsHref } from "../app/aliases";

export const Route = createFileRoute("/_app/_authenticated/account-settings")({
  beforeLoad: ({ location }) => {
    // oxlint-disable-next-line typescript/only-throw-error -- Router consumes this redirect.
    throw redirect({
      href: accountSettingsHref(location.searchStr, location.hash),
      replace: true,
    });
  },
});
