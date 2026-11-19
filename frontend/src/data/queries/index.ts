import type { QueryClient } from "@tanstack/solid-query";
import { requireApplication } from "../../app/application";

/** The mounted application's client; never a module-owned instance. */
export function getQueryClient(): QueryClient {
  return requireApplication().queryClient;
}
