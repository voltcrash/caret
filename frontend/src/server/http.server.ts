import "@tanstack/solid-start/server-only";
import {
  healthResponse,
  runHttpAuxiliary,
  runHttpOperation,
  type HttpInvocation,
} from "@oxytype/backend/http";
import type { OperationId } from "@oxytype/backend/policies/operations";
import { createServiceContext } from "./context.server";
import editorHtml from "../../../backend/private/index.html?raw";
import editorScript from "../../../backend/private/script.js?raw";
import editorStyles from "../../../backend/private/style.css?raw";

function invocation(request: Request): HttpInvocation {
  const context = createServiceContext(request, false);
  return {
    runtime: context.runtime,
    requestId: context.requestId,
    background: context.background,
    headers: request.headers,
    clientIp: context.clientIp,
  };
}

/** Start chooses the path/method; only its declared operation reaches policies. */
export async function serveOperation(
  request: Request,
  id: OperationId,
  params: Record<string, string>,
): Promise<Response> {
  return await runHttpOperation(invocation(request), request, id, params);
}

function missing(request: Request): Response {
  const path = new URL(request.url).pathname.slice(4) || "/";
  return Response.json(
    { message: `Unknown request URL (${request.method}: ${path})`, data: null },
    { status: 404 },
  );
}

export async function unknownApi(request: Request): Promise<Response> {
  return await runHttpAuxiliary(invocation(request), request, async () =>
    missing(request),
  );
}

export async function serveHealth(request: Request): Promise<Response> {
  return await runHttpAuxiliary(invocation(request), request, async () =>
    healthResponse(),
  );
}

const docsCsp =
  "default-src 'self';base-uri 'self';font-src 'self' https: data:;frame-ancestors 'self';img-src 'self' cdn.redocly.com data:;object-src 'none';script-src 'self' https://cdn.redocly.com;script-src-attr 'none';style-src 'self' https: 'unsafe-inline';worker-src blob: data:;upgrade-insecure-requests";

export async function serveDocs(
  request: Request,
  file = "",
  prefix?: string,
): Promise<Response> {
  const call = invocation(request);
  return await runHttpAuxiliary(call, request, async () => {
    const configured = call.runtime.env.API_PATH_OVERRIDE;
    if ((prefix ?? "").toLowerCase() !== (configured ?? "").toLowerCase()) {
      return missing(request);
    }
    const selected = file.toLowerCase();
    const document = ["", "public", "internal"].includes(selected);
    const source = {
      "": "public.json",
      public: "public.json",
      internal: "openapi.json",
      "public.json": "public.json",
      "internal.json": "openapi.json",
    }[selected];
    if (source === undefined) return missing(request);
    if (document) {
      const root = `/api${prefix === undefined ? "" : `/${encodeURIComponent(prefix)}`}/docs`;
      const spec = selected === "internal" ? "internal.json" : "public.json";
      return new Response(
        `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Oxytype API</title></head><body><redoc spec-url="${root}/${spec}"></redoc><script src="https://cdn.redocly.com/redoc/v2.5.4/bundles/redoc.standalone.js" integrity="sha384-w447zOpYfw/1Tv/5AK9NfHTlQIqE3RVR6KY62jCyy9zNDgO64cMwGGP1Fj0zJVf5" crossorigin="anonymous"></script></body></html>`,
        {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "Content-Security-Policy": docsCsp,
          },
        },
      );
    }
    const url = new URL(request.url);
    url.pathname = `/_api-docs/${source}`;
    const response = await call.runtime.env.ASSETS?.fetch(url.toString());
    if (response === undefined || response.status === 404) {
      return Response.json(
        { message: "API documentation file not found", data: null },
        { status: 404 },
      );
    }
    return new Response(response.body as unknown as BodyInit, {
      status: response.status,
      headers: Object.fromEntries(response.headers),
    });
  });
}

/** Private editor assets stay in the server bundle, behind the development gate. */
export async function serveConfigurationEditor(
  request: Request,
  file = "",
): Promise<Response> {
  const call = invocation(request);
  return await runHttpAuxiliary(call, request, async () => {
    if (call.runtime.env.MODE !== "dev") return missing(request);
    const assets = {
      "": [
        editorHtml.replace("<head>", '<head><base href="/api/configure/">'),
        "text/html",
      ],
      "index.html": [
        editorHtml.replace("<head>", '<head><base href="/api/configure/">'),
        "text/html",
      ],
      "script.js": [
        editorScript.replaceAll('"/configuration', '"/api/configuration'),
        "text/javascript",
      ],
      "style.css": [editorStyles, "text/css"],
    };
    const asset = assets[file as keyof typeof assets];
    if (asset === undefined) return missing(request);
    return new Response(asset[0], {
      headers: { "content-type": `${asset[1]}; charset=utf-8` },
    });
  });
}
