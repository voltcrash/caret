import { createFileRoute } from "@tanstack/solid-router";
import { serveDocs, unknownApi } from "../server/http.server";

export const Route = createFileRoute("/api/docs")({
  server: {
    handlers: {
      GET: async ({ request }) => await serveDocs(request),
      ANY: async ({ request }) => await unknownApi(request),
    },
  },
});
