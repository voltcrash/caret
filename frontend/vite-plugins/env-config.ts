import { Plugin } from "vite";
import { EnvConfig } from "virtual:env-config";

const virtualModuleId = "virtual:env-config";
const resolvedVirtualModuleId = `\0${virtualModuleId}`;

function fallback(value: string | undefined | null, fallback: string): string {
  if (value === null || value === undefined || value === "") return fallback;
  return value;
}

export function envConfig(options: {
  isDevelopment: boolean;
  clientVersion: string;
  env: Record<string, string>;
}): Plugin {
  const authProviders: EnvConfig["authProviders"] = (
    options.env["AUTH_PROVIDERS"] ?? "google,github"
  )
    .split(",")
    .map((value) => {
      const provider = value.trim();
      if (provider === "google" || provider === "github") return provider;
      throw new Error("AUTH_PROVIDERS must list google and/or github");
    });
  return {
    name: "virtual-env-config",
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId;
      return;
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        const devConfig: EnvConfig = {
          isDevelopment: true,
          devTools: options.env["DEV_TOOLS"] === "true",
          devPrefetch: options.env["DEV_PREFETCH"] === "true",
          authProviders,
          backendUrl: fallback(
            options.env["BACKEND_URL"],
            "http://localhost:5005",
          ),
          clientVersion: options.clientVersion,
          turnstileSiteKey: fallback(
            options.env["TURNSTILE_SITE_KEY"],
            "1x00000000000000000000AA",
          ),
          sentryDsn:
            options.env["SENTRY_DSN"] === ""
              ? undefined
              : options.env["SENTRY_DSN"],
        };

        const prodConfig: EnvConfig = {
          isDevelopment: false,
          devTools: false,
          devPrefetch: false,
          authProviders,
          backendUrl: fallback(options.env["BACKEND_URL"], "/api"),
          turnstileSiteKey: options.env["TURNSTILE_SITE_KEY"] ?? "",
          clientVersion: options.clientVersion,
          sentryDsn:
            options.env["SENTRY_DSN"] === ""
              ? undefined
              : options.env["SENTRY_DSN"],
        };

        const envConfig = options.isDevelopment ? devConfig : prodConfig;
        return `
          export const envConfig = ${JSON.stringify(envConfig)};
        `;
      }
      return;
    },
  };
}
