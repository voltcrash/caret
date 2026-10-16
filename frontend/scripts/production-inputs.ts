import { z } from "zod";

const requiredSecrets = [
  "BETTER_AUTH_SECRET",
  "TURNSTILE_SECRET_KEY",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
] as const;
const configSchema = z.object({
  name: z.literal("oxytype"),
  workers_dev: z.literal(false),
  vars: z.object({
    MODE: z.literal("production"),
    VERSION: z.literal("production"),
    FRONTEND_URL: z.url(),
    BETTER_AUTH_URL: z.url(),
  }),
  routes: z
    .array(z.object({ pattern: z.string(), custom_domain: z.literal(true) }))
    .length(1),
  d1_databases: z
    .array(
      z.object({
        binding: z.literal("DB"),
        database_name: z.literal("oxytype-production"),
        database_id: z.literal("43d104e9-2fef-43db-95d7-c64a08310714"),
        migrations_dir: z.literal("../backend/migrations"),
      }),
    )
    .length(1),
  queues: z.object({
    producers: z
      .array(
        z.object({
          binding: z.literal("TASKS"),
          queue: z.literal("oxytype-production-tasks"),
        }),
      )
      .length(1),
    consumers: z
      .array(
        z.object({
          queue: z.literal("oxytype-production-tasks"),
          dead_letter_queue: z.literal("oxytype-production-dlq"),
        }),
      )
      .length(1),
  }),
});

function configured(value: string | undefined): value is string {
  return (
    value !== undefined &&
    value.trim() !== "" &&
    !/^(replace-|your-)/i.test(value)
  );
}

export function validateProductionInputs(inputs: {
  config: unknown;
  backend: NodeJS.Dict<string>;
  frontend: NodeJS.Dict<string>;
  staging?: NodeJS.Dict<string>;
  bundles?: string[];
}): void {
  const parsed = configSchema.safeParse(inputs.config);
  if (!parsed.success) {
    throw new Error(
      "Production config must use isolated production Worker, D1 and queues",
    );
  }
  const config = parsed.data;
  const origin = new URL(config.vars.FRONTEND_URL);
  if (
    origin.protocol !== "https:" ||
    origin.href !== `${origin.origin}/` ||
    config.vars.BETTER_AUTH_URL !== `${origin.origin}/api/auth` ||
    config.routes[0]?.pattern !== origin.hostname
  ) {
    throw new Error(
      "Production frontend, auth and custom domain must use one HTTPS origin",
    );
  }
  for (const key of requiredSecrets) {
    const value = inputs.backend[key];
    if (!configured(value)) {
      throw new Error(`Configure ${key} in frontend/.dev.vars.production`);
    }
    if (value === inputs.staging?.[key]) {
      throw new Error(`${key} must be separate from staging`);
    }
  }
  const authSecret = inputs.backend["BETTER_AUTH_SECRET"] as string;
  if (
    authSecret.length < 32 ||
    authSecret === "oxytype-local-development-secret-only"
  ) {
    throw new Error(
      "Use a new production BETTER_AUTH_SECRET with at least 32 characters",
    );
  }
  if (/^[123]x0+/.test(inputs.backend["TURNSTILE_SECRET_KEY"] as string)) {
    throw new Error("Production cannot use a Turnstile test secret");
  }
  const siteKey = inputs.frontend["TURNSTILE_SITE_KEY"];
  if (!configured(siteKey) || /^[123]x0+/.test(siteKey)) {
    throw new Error("Configure a real production TURNSTILE_SITE_KEY");
  }
  if (inputs.frontend["BACKEND_URL"] !== "/api") {
    throw new Error("Production BACKEND_URL must be /api");
  }
  const providers = (inputs.frontend["AUTH_PROVIDERS"] ?? "")
    .split(",")
    .map((provider) => provider.trim());
  if (
    !providers.includes("github") ||
    providers.some((provider) => provider !== "google" && provider !== "github")
  ) {
    throw new Error(
      "Production AUTH_PROVIDERS must explicitly enable github, optionally google",
    );
  }
  if (
    providers.includes("google") &&
    (!configured(inputs.backend["GOOGLE_CLIENT_ID"]) ||
      !configured(inputs.backend["GOOGLE_CLIENT_SECRET"]))
  ) {
    throw new Error(
      "Configure production Google OAuth credentials before enabling Google login",
    );
  }
  if (inputs.bundles !== undefined) {
    const expectedProviders = [...providers].sort().join(",");
    const matching = inputs.bundles.some((bundle) => {
      const key = /turnstileSiteKey\s*:\s*["'`]([^"'`]+)["'`]/.exec(
        bundle,
      )?.[1];
      const builtProviders = /authProviders\s*:\s*\[([^\]]+)\]/.exec(
        bundle,
      )?.[1];
      const names = [...(builtProviders ?? "").matchAll(/["'`]([^"'`]+)["'`]/g)]
        .map((match) => match[1])
        .sort()
        .join(",");
      return (
        /backendUrl\s*:\s*["'`]\/api["'`]/.test(bundle) &&
        key === siteKey &&
        names === expectedProviders
      );
    });
    if (!matching) {
      throw new Error(
        "Rebuild frontend with the production site key, /api and enabled auth providers",
      );
    }
  }
}
