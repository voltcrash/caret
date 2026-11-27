import { describe, expect, it, vi } from "vite-plus/test";
import { withRuntime, type WorkerEnv } from "@caret/backend/runtime";
import { boundedRequest } from "../../src/server/request-body.server";
import {
  serveConfigurationEditor,
  serveDocs,
} from "../../src/server/http.server";

vi.mock("@caret/backend/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@caret/backend/http")>();
  return {
    ...actual,
    runHttpAuxiliary: async (
      _invocation: unknown,
      _request: Request,
      action: () => Promise<Response>,
    ): Promise<Response> => await action(),
  };
});

describe("prototype-safe server lookups", () => {
  it("returns 415 for Object.prototype property names in Content-Encoding", async () => {
    for (const encoding of ["constructor", "toString", "__proto__"]) {
      const result = await boundedRequest(
        new Request("http://localhost:3000/api/results", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-encoding": encoding,
          },
          body: "{}",
        }),
      );
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(415);
    }
  });

  it("returns 404 for Object.prototype property names on /api/docs and /api/configure", async () => {
    const env = {
      MODE: "dev",
      FRONTEND_URL: "http://localhost:3000",
    } as unknown as WorkerEnv;
    await withRuntime(env, async () => {
      for (const name of ["constructor", "toString", "__proto__"]) {
        const docsResponse = await serveDocs(
          new Request(`http://localhost:3000/api/docs/${name}`),
          name,
        );
        expect(docsResponse.status).toBe(404);

        const editorResponse = await serveConfigurationEditor(
          new Request(`http://localhost:3000/api/configure/${name}`),
          name,
        );
        expect(editorResponse.status).toBe(404);
      }
    });
  });
});
