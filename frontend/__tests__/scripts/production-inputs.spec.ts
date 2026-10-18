import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { validateProductionInputs } from "../../scripts/production-inputs";

function inputs(): Parameters<typeof validateProductionInputs>[0] {
  const config: unknown = JSON.parse(
    readFileSync(resolve(__dirname, "../../wrangler.production.json"), "utf8"),
  );
  return {
    config,
    backend: {
      BETTER_AUTH_SECRET: "production-auth-secret-fixture-32-characters",
      TURNSTILE_SECRET_KEY: "production-turnstile-secret-fixture",
      GITHUB_CLIENT_ID: "production-client-id",
      GITHUB_CLIENT_SECRET: "production-client-secret-fixture",
    },
    frontend: {
      BACKEND_URL: "/api",
      TURNSTILE_SITE_KEY: "0xproduction-fixture",
      AUTH_PROVIDERS: "github",
    },
    bundles: [
      'const env={backendUrl:"/api",turnstileSiteKey:"0xproduction-fixture",authProviders:["github"]}',
    ],
  };
}

describe("production deployment inputs", () => {
  it("accepts isolated production credentials and the matching same-origin build", () => {
    expect(() => validateProductionInputs(inputs())).not.toThrow();
  });
  it.each([
    "BETTER_AUTH_SECRET",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "TURNSTILE_SECRET_KEY",
  ])("requires %s without echoing credential values", (key) => {
    const input = inputs();
    input.backend[key] = "";
    expect(() => validateProductionInputs(input)).toThrow(key);
    input.backend[key] = "replace-with-production-secret";
    expect(() => validateProductionInputs(input)).toThrow(key);
    input.backend[key] = "private-value";
    input.staging = { [key]: "private-value" };
    expect(() => validateProductionInputs(input)).toThrow(
      `${key} must be separate from staging`,
    );
  });
  it.each(["short", "oxytype-local-development-secret-only"])(
    "rejects development or weak auth secrets",
    (secret) => {
      const input = inputs();
      input.backend["BETTER_AUTH_SECRET"] = secret;
      expect(() => validateProductionInputs(input)).toThrow(
        "BETTER_AUTH_SECRET",
      );
    },
  );
  it("rejects test captcha credentials", () => {
    const input = inputs();
    input.backend["TURNSTILE_SECRET_KEY"] =
      "1x0000000000000000000000000000000AA";
    expect(() => validateProductionInputs(input)).toThrow("test secret");
    input.backend["TURNSTILE_SECRET_KEY"] = "production-secret";
    input.frontend["TURNSTILE_SITE_KEY"] = "1x00000000000000000000AA";
    expect(() => validateProductionInputs(input)).toThrow("real production");
  });
  it("rejects staging resources and cross-origin auth configuration", () => {
    const input = inputs();
    const config = input.config as {
      name: string;
      d1_databases: { database_id: string }[];
      vars: { BETTER_AUTH_URL: string };
    };
    config.name = "oxytype-api-staging";
    expect(() => validateProductionInputs(input)).toThrow(
      "isolated production",
    );
    config.name = "oxytype";
    const database = config.d1_databases[0];
    if (database === undefined) throw new Error("Missing database fixture");
    database.database_id = "17b0ae8b-92bf-4d7e-a29e-0ac4cc6f2b59";
    expect(() => validateProductionInputs(input)).toThrow(
      "isolated production",
    );
    database.database_id = "43d104e9-2fef-43db-95d7-c64a08310714";
    config.vars.BETTER_AUTH_URL = "https://staging.example.test/api/auth";
    expect(() => validateProductionInputs(input)).toThrow("one HTTPS origin");
  });
  it("rejects a stale staging or dummy-key frontend build", () => {
    const input = inputs();
    input.bundles = [
      'const env={backendUrl:"/api",turnstileSiteKey:"staging-key",authProviders:["github"]}',
    ];
    expect(() => validateProductionInputs(input)).toThrow("Rebuild frontend");
    input.bundles = [
      "const env={backendUrl:`/api`,turnstileSiteKey:`0xproduction-fixture`,authProviders:[`github`]}",
    ];
    expect(() => validateProductionInputs(input)).not.toThrow();
  });
  it("rejects an external API URL and unconfigured login providers", () => {
    const input = inputs();
    input.frontend["BACKEND_URL"] = "https://staging.example.test/api";
    expect(() => validateProductionInputs(input)).toThrow(
      "BACKEND_URL must be /api",
    );
    input.frontend["BACKEND_URL"] = "/api";
    input.frontend["AUTH_PROVIDERS"] = "google,github";
    expect(() => validateProductionInputs(input)).toThrow(
      "Google OAuth credentials",
    );
  });
});
