import {
  AppRouter,
  initClient,
  tsRestFetchApi,
  type ApiFetcherArgs,
} from "@ts-rest/core";
import { envConfig } from "virtual:env-config";
import {
  COMPATIBILITY_CHECK,
  COMPATIBILITY_CHECK_HEADER,
} from "@oxytype/contracts/compatibility";
import { addBanner } from "../../states/banners";
import { setLastSeenServerCompatibility } from "../server-compatibility";

let bannerShownThisSession = false;

function buildApi(timeout: number): (args: ApiFetcherArgs) => Promise<{
  status: number;
  body: unknown;
  headers: Headers;
}> {
  return async (request: ApiFetcherArgs) => {
    if (envConfig.devOffline) {
      return {
        status: 503,
        body: {
          message:
            "Backend requests are unavailable in frontend-only development",
        },
        headers: new Headers(),
      };
    }
    const controller = new AbortController();
    const source = request.fetchOptions?.signal;
    const abort = (): void => controller.abort(source?.reason);
    if (source?.aborted) abort();
    else source?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(
      () => controller.abort(new Error("request timed out")),
      timeout,
    );
    try {
      request.fetchOptions = {
        ...request.fetchOptions,
        credentials: "include",
        signal: controller.signal,
      };
      const response = await tsRestFetchApi(request);
      if (response.status >= 400) {
        console.error(`${request.method} ${request.path} failed`, {
          status: response.status,
          ...(response.body as object),
        });
      }

      const compatibilityCheckHeader = response.headers.get(
        COMPATIBILITY_CHECK_HEADER,
      );

      if (compatibilityCheckHeader !== null) {
        setLastSeenServerCompatibility(parseInt(compatibilityCheckHeader));
      }

      if (compatibilityCheckHeader !== null && !bannerShownThisSession) {
        const backendCheck = parseInt(compatibilityCheckHeader);
        if (backendCheck !== COMPATIBILITY_CHECK) {
          const message =
            backendCheck > COMPATIBILITY_CHECK
              ? `Looks like the client and server versions are mismatched (backend is newer). Please refresh the page.`
              : `Server and client versions do not match. Refresh the page; if this persists, contact support.`;
          addBanner({
            level: "error",
            text: message,
          });
          bannerShownThisSession = true;
        }
      }

      return response;
    } catch (e: Error | unknown) {
      let message = "Unknown error";

      if (e instanceof Error) {
        if (e.message.includes("timed out")) {
          message = "request took too long to complete";
        } else {
          message = e.message;
        }
      }

      return {
        status: 500,
        body: { message },
        headers: new Headers(),
      };
    } finally {
      clearTimeout(timer);
      source?.removeEventListener("abort", abort);
    }
  };
}

export function buildClient<T extends AppRouter>(
  contract: T,
  baseUrl: string,
  timeout: number = 10_000,
) {
  return initClient(contract, {
    baseUrl: baseUrl,
    jsonQuery: true,
    api: buildApi(timeout),
    baseHeaders: {
      Accept: "application/json",
      "X-Client-Version": envConfig.clientVersion,
    },
  });
}
