import { render } from "@solidjs/testing-library";
import { useQueryClient } from "@tanstack/solid-query";
import { describe, expect, it } from "vite-plus/test";

import { currentApplication } from "../../src/app/application";
import { AppProviders } from "../../src/app/providers";
import { createQueryClient } from "../../src/app/query-client";
import { releaseTestApplication } from "../__harness__/mock-application";

releaseTestApplication();

describe("AppProviders", () => {
  it("registers its owners for the mount lifetime only", () => {
    const queryClient = createQueryClient();
    let provided: unknown;
    const view = render(() => (
      <AppProviders queryClient={queryClient}>
        {(() => {
          provided = useQueryClient();
          return null;
        })()}
      </AppProviders>
    ));
    expect(provided).toBe(queryClient);
    expect(currentApplication()?.queryClient).toBe(queryClient);
    const scope = currentApplication()?.accountData.scope();
    let disposed = false;
    scope?.use(
      {},
      () => 1,
      () => (disposed = true),
    );
    view.unmount();
    expect(currentApplication()).toBeUndefined();
    expect(disposed).toBe(true);
  });
});
