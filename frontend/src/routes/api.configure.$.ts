import { createFileRoute } from "@tanstack/solid-router";
import { serveConfigurationEditor, unknownApi } from "../server/http.server";

export const Route = createFileRoute("/api/configure/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        await serveConfigurationEditor(request, params._splat),
      ANY: async ({ request }) => await unknownApi(request),
    },
  },
});
