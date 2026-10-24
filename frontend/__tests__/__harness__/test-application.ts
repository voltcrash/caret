import { createAccountDataOwner } from "../../src/app/account-data";
import {
  type Application,
  createApplicationRoot,
  mountApplication,
} from "../../src/app/application";
import { createQueryClient } from "../../src/app/query-client";

/** Unmounted owners equivalent to one AppProviders render. */
export function createTestApplication(): {
  application: Application;
  dispose: () => void;
} {
  const root = createApplicationRoot();
  const queryClient = createQueryClient({ staleTime: 0, retry: false });
  const application: Application = {
    owner: root.owner,
    state: root.state,
    queryClient,
    accountData: createAccountDataOwner(queryClient),
  };
  return {
    application,
    dispose: () => {
      application.accountData.dispose();
      root.dispose();
      application.queryClient.clear();
    },
  };
}

// Legacy modules read the mounted app's owners; each test file gets one.
const harness = createTestApplication();
const release = mountApplication(harness.application);

/** For tests that mount real providers instead of the harness application. */
export function releaseTestApplication(): void {
  release();
  harness.dispose();
}
