import { createFileRoute } from "@tanstack/solid-router";
import { serveConfigurationEditor, unknownApi } from "../server/http.server";

export const Route = createFileRoute("/api/configure")({
  server: {
    handlers: {
      GET: async ({ request }) => await serveConfigurationEditor(request),
      ANY: async ({ request }) => await unknownApi(request),
    },
  },
});
