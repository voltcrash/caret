// Test-only entry. Never imported by the deployable application.
import { runtime } from "@oxytype/backend/runtime";
import { getAuth } from "@oxytype/backend/auth/session";
import { createServiceContext } from "../../src/server/context.server";
import { createApplicationWorker } from "../../src/server/worker.server";
import server from "../../src/server";
import { adminProbe, freshProbe } from "./policy-functions";
import { getAccountStats } from "../../src/functions/account";

export default createApplicationWorker(async (request, options) => {
  const url = new URL(request.url);
  const probe =
    url.pathname === "/__test/admin"
      ? adminProbe
      : url.pathname === "/__test/fresh"
        ? freshProbe
        : undefined;
  if (probe !== undefined) {
    return await server.fetch(
      new Request(new URL(probe.url, request.url), request),
      options,
    );
  }
  if (url.pathname === "/__test/account") {
    return await server.fetch(
      new Request(
        new URL(getAccountStats.url + url.search, request.url),
        request,
      ),
      options,
    );
  }
  if (url.pathname !== "/__test/stream") {
    return await server.fetch(request, options);
  }
  const services = createServiceContext(request, false);
  const session = await getAuth().api.getSession({ headers: request.headers });
  const id = session?.user.id ?? "guest";
  const db = services.runtime.env.DB;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode(`${id}:${runtime().env.VERSION}:start\n`),
      );
      await new Promise((resolve) =>
        setTimeout(resolve, Number(url.searchParams.get("delay") ?? 1)),
      );
      const isolated = runtime() === services.runtime;
      controller.enqueue(
        encoder.encode(`${id}:${runtime().env.VERSION}:${isolated}:end\n`),
      );
      services.background(
        (async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          await db
            .prepare("INSERT INTO probe(actor,version,isolated) VALUES(?,?,?)")
            .bind(
              id,
              runtime().env.VERSION ?? "",
              Number(runtime() === services.runtime),
            )
            .run();
        })(),
      );
      controller.close();
    },
  });
  return new Response(body);
});
