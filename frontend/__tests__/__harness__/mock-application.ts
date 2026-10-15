import { createAccountDataOwner } from "../../src/app/account-data";
import { mountApplication } from "../../src/app/application";
import { createQueryClient } from "../../src/app/query-client";

// Legacy modules read the mounted app's owners; each test file gets one.
const queryClient = createQueryClient({ staleTime: 0, retry: false });
const accountData = createAccountDataOwner();
const release = mountApplication({ queryClient, accountData });

/** For tests that mount real providers instead of the harness application. */
export function releaseTestApplication(): void {
  release();
  accountData.dispose();
  queryClient.clear();
}
