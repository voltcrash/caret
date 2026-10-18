import type { JSXElement } from "solid-js";

import { AppProviders } from "../../src/app/providers";
import { createQueryClient } from "../../src/app/query-client";

/** Each story mounts its own application owner, like the Start root. */
export function AppDecorator(Story: () => JSXElement): JSXElement {
  return (
    <AppProviders
      queryClient={createQueryClient({ staleTime: 0, retry: false })}
    >
      <Story />
    </AppProviders>
  );
}
