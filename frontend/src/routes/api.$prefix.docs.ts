import { createFileRoute } from "@tanstack/solid-router";
import { serveDocs, unknownApi } from "../server/http.server";

export const Route = createFileRoute("/api/$prefix/docs")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        await serveDocs(request, "", params.prefix),
      ANY: async ({ request }) => await unknownApi(request),
    },
  },
});
