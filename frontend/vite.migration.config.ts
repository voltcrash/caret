import { BASE_CONFIGURATION } from "@oxytype/schemas/default-configuration";
import { defineConfig, mergeConfig, type PreviewServer } from "vite-plus";
import config from "./vite.config";

/** Server-side fixtures preserve browser HTTP caching during measurements. */
export default defineConfig(async (env) =>
  mergeConfig(await config(env), {
    plugins: [
      {
        name: "migration-baseline-fixtures",
        configurePreviewServer(server: PreviewServer) {
          server.middlewares.use("/api", (request, response) => {
            const path = new URL(request.url ?? "/", "http://localhost")
              .pathname;
            const data =
              path === "/configuration"
                ? BASE_CONFIGURATION
                : path === "/public/typingStats"
                  ? { testsStarted: 100, testsCompleted: 80, timeTyping: 1200 }
                  : path === "/public/speedHistogram"
                    ? { "80": 10 }
                    : path === "/psas"
                      ? []
                      : undefined;
            response.setHeader("Content-Type", "application/json");
            response.setHeader("Cache-Control", "no-store");
            response.statusCode =
              data !== undefined || path === "/auth/get-session" ? 200 : 404;
            response.end(
              JSON.stringify(
                path === "/auth/get-session"
                  ? null
                  : { message: "Fixture", data },
              ),
            );
          });
        },
      },
    ],
  }),
);
