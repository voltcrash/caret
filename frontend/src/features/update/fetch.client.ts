import type { CustomFetch } from "@tanstack/solid-start";

import { clientBuildId, reportStaleClient } from "../../app/release";
import { staleClientHeader } from "./contract";

/**
 * Browser transport for every server function: reports this tab's build for
 * version-skew observability and flags function IDs the Worker no longer has.
 * The response is returned unchanged, so callers keep their failure UX and a
 * failed save stays visible without an automatic resubmission.
 */
export const serverFunctionFetch: CustomFetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  headers.set("X-Client-Version", clientBuildId);
  const response = await fetch(input, { ...init, headers });
  if (response.headers.has(staleClientHeader)) reportStaleClient("function");
  return response;
};
