import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { dash } from "@better-auth/infra";
import { primaryDatabase } from "../db/client";
import {
  authUsers,
  authSessions,
  authAccounts,
  authVerifications,
} from "../db/schema";
import { background, runtime, envValue, type WorkerEnv } from "../runtime/env";
import { mutateUser } from "../db/mutation";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { bearer } from "better-auth/plugins";
import { getFrontendUrl, isDevEnvironment } from "../utils/misc";
import * as UserDAL from "../dal/user";

/** Longest a revoked or disabled cookie session can keep working. */
export const SESSION_COOKIE_CACHE_SECONDS = 60;

export function createAuth(
  adapter: BetterAuthOptions["database"],
): ReturnType<typeof betterAuth> {
  const frontendUrl = getFrontendUrl();
  const secret = envValue("BETTER_AUTH_SECRET");
  const dashboardApiKey = envValue("BETTER_AUTH_API_KEY")?.trim();
  if (!isDevEnvironment() && (secret === undefined || secret.length < 32)) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
  }
  const socialProviders: BetterAuthOptions["socialProviders"] = {};
  for (const provider of ["google", "github"] as const) {
    const clientId = envValue(
      `${provider.toUpperCase()}_CLIENT_ID` as keyof WorkerEnv,
    );
    const clientSecret = envValue(
      `${provider.toUpperCase()}_CLIENT_SECRET` as keyof WorkerEnv,
    );
    if (
      clientId !== undefined &&
      clientId !== "" &&
      clientSecret !== undefined &&
      clientSecret !== ""
    ) {
      socialProviders[provider] = { clientId, clientSecret };
    }
  }
  const baseURL =
    envValue("BETTER_AUTH_URL") ??
    (isDevEnvironment() ? "http://localhost:5005/auth" : undefined);
  if (baseURL === undefined) {
    throw new Error("BETTER_AUTH_URL must be configured for production");
  }
  const options: BetterAuthOptions = {
    appName: "Oxytype",
    // Better Auth accepts adapter factories through its database option.
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- Better Auth's database option includes untyped drivers; this value uses its adapter API.
    database: adapter,
    baseURL,
    basePath: new URL(baseURL).pathname,
    secret: secret ?? "oxytype-local-development-secret-only",
    trustedOrigins: [new URL(frontendUrl).origin],
    socialProviders,
    advanced: {
      backgroundTasks: { handler: background },
      database: { generateId: () => randomUUID() },
      cookiePrefix: "oxytype",
      ...(new URL(baseURL).protocol === "https:" &&
      new URL(baseURL).hostname !== new URL(frontendUrl).hostname
        ? {
            defaultCookieAttributes: {
              sameSite: "none" as const,
              secure: true,
            },
          }
        : {}),
      ipAddress: { ipAddressHeaders: ["x-oxytype-auth-ip"] },
    },
    user: {
      modelName: "authUsers",
      additionalFields: {
        disabled: { type: "boolean", defaultValue: false, input: false },
      },
    },
    account: {
      modelName: "authAccounts",
      accountLinking: { enabled: true, allowDifferentEmails: false },
    },
    session: {
      modelName: "authSessions",
      freshAge: 60,
      // Signed (HMAC) snapshot; expiry always falls back to D1. No stateless
      // refresh, so a revoked session outlives revocation by at most maxAge.
      cookieCache: {
        enabled: true,
        maxAge: SESSION_COOKIE_CACHE_SECONDS,
        strategy: "compact",
      },
    },
    verification: { modelName: "authVerifications" },
    disabledPaths: [
      "/sign-in/email",
      "/sign-up/email",
      "/request-password-reset",
      "/reset-password",
      "/change-password",
      "/set-password",
      "/verify-password",
      "/send-verification-email",
      "/verify-email",
      "/change-email",
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // disabledPaths matches exact URLs; also block legacy reset-token URLs.
        if (ctx.path.startsWith("/reset-password")) {
          throw new APIError("NOT_FOUND");
        }
        if (ctx.path === "/unlink-account") {
          const session = await getSessionFromCtx(ctx);
          if (session === null) return;
          const accounts = await ctx.context.internalAdapter.findAccounts(
            session.user.id,
          );
          const socialAccounts = accounts.filter((account) =>
            ["google", "github"].includes(account.providerId),
          );
          const body = ctx.body as { accountId?: string } | undefined;
          // Legacy credentials must not count as a usable remaining sign-in method.
          if (
            socialAccounts.length === 1 &&
            socialAccounts[0]?.id === body?.accountId
          ) {
            throw new APIError("BAD_REQUEST", {
              message: "Cannot unlink the last Google or GitHub account",
            });
          }
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/social") return;
        // Sessions always persist; clear stale session-only markers.
        const cookie = ctx.context.authCookies.dontRememberToken;
        ctx.setCookie(cookie.name, "", { ...cookie.attributes, maxAge: 0 });
      }),
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session, ctx) => {
            const authUser =
              ctx === null || ctx === undefined
                ? await primaryDatabase()
                    .select()
                    .from(authUsers)
                    .where(eq(authUsers.id, session.userId))
                    .get()
                : await ctx.context.internalAdapter.findUserById(
                    session.userId,
                  );
            if (
              authUser !== undefined &&
              authUser !== null &&
              "disabled" in authUser &&
              authUser.disabled === true
            ) {
              throw new APIError("FORBIDDEN", { message: "Account disabled" });
            }
          },
        },
      },
      user: {
        update: {
          after: async (user, ctx) => {
            // Await revocation so re-enabling cannot revive retained sessions.
            if (user["disabled"] === true) {
              const context = ctx?.context ?? (await auth.$context);
              await context.internalAdapter.deleteUserSessions(user.id);
            }
            // Provider profile updates keep the application email in sync.
            if (await UserDAL.exists(user.id)) {
              await mutateUser(user.id, (profile) => {
                profile.email = user.email;
              });
            }
          },
        },
      },
    },
    plugins: [
      bearer(),
      ...(dashboardApiKey !== undefined && dashboardApiKey !== ""
        ? [dash({ apiKey: dashboardApiKey })]
        : []),
    ],
    // Workers rate limiting guards these routes before Better Auth runs.
    rateLimit: { enabled: false },
  };
  const auth = betterAuth(options);
  return auth;
}

export function getAuth(): ReturnType<typeof createAuth> {
  const scope = runtime();
  scope.auth ??= createAuth(
    // Revocation and account disablement must observe current primary state,
    // even after unrelated application reads have established a bookmark.
    drizzleAdapter(primaryDatabase(), {
      provider: "sqlite",
      schema: {
        authUsers,
        authSessions,
        authAccounts,
        authVerifications,
      },
      transaction: false,
    }),
  );
  return scope.auth;
}
export async function init(): Promise<void> {
  getAuth();
}
