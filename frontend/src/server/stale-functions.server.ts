import "@tanstack/solid-start/server-only";
import { staleClientHeader } from "../features/update/contract";

// Start's resolver throws these for IDs absent from this build's manifest.
const unknownFunction =
  /^Server function (?:info not found|module not resolved|module export not resolved)/;

const staleFunctionMessage =
  "Oxytype was updated. Refresh the page to continue.";

/**
 * A tab from another build may call a server function this Worker no longer
 * contains. Answer with an explicit, uncached conflict instead of a generic 500
 * so the tab offers a refresh and nothing is retried automatically.
 */
export function staleFunctionResponse(error: unknown): Response | undefined {
  if (!(error instanceof Error) || !unknownFunction.test(error.message)) {
    return undefined;
  }
  return new Response(staleFunctionMessage, {
    status: 409,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      [staleClientHeader]: "1",
    },
  });
}
