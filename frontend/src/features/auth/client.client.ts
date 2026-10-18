import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";
import { dashClient } from "@better-auth/infra/client";
import { envConfig } from "virtual:env-config";
import { createAppOwned } from "../../app/application";
// oxlint-disable-next-line typescript/explicit-function-return-type -- Better Auth must infer plugin-specific client methods from these options.
const createOxytypeAuthClient = () => {
  const authURL = new URL(
    `${envConfig.backendUrl.replace(/\/$/, "")}/auth`,
    window.location.origin,
  );
  return createAuthClient({
    baseURL: authURL.href,
    basePath: authURL.pathname,
    fetchOptions: {
      credentials: "include",
      ...(envConfig.devOffline
        ? {
            customFetchImpl: async () =>
              Response.json(
                {
                  message:
                    "Authentication is unavailable in frontend-only development",
                },
                { status: 503 },
              ),
          }
        : {}),
    },
    plugins: [dashClient(), deviceAuthorizationClient()],
  });
};
type OxytypeAuthClient = ReturnType<typeof createOxytypeAuthClient>;
const authClient = createAppOwned(createOxytypeAuthClient);
/** Built on first browser use, never while the module is evaluated. */
export function getAuthClient(): OxytypeAuthClient {
  return authClient();
}
