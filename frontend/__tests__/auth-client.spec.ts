import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const config = vi.hoisted(() => ({
  backendUrl: "/api",
  clientVersion: "7",
  devOffline: false,
}));
const preloadUser = vi.hoisted(() => vi.fn());
vi.unmock("../src/ts/auth-client");
vi.mock("virtual:env-config", () => ({ envConfig: config }));
vi.mock("../src/ts/states/core", () => ({ setUserId: vi.fn() }));
vi.mock("../src/ts/ape/user", () => ({ fetchUserFromApi: preloadUser }));
beforeEach(async () => {
  await import("./__harness__/mock-application");
  preloadUser.mockReset();
  config.backendUrl = "/api";
  config.devOffline = false;
});

it("initializes frontend-only mode without sessions, refresh subscriptions or OAuth requests", async () => {
  config.devOffline = true;
  const fetch = vi.fn<typeof globalThis.fetch>();
  vi.stubGlobal("fetch", fetch);
  const {
    init,
    getAuthClient,
    observeAuthSession,
    isAuthAvailable,
    getAuthenticatedUser,
    requestOAuth,
  } = await import("../src/ts/auth-client");
  const callback = vi.fn(async () => undefined);
  const initialized = init(callback);
  expect(callback).not.toHaveBeenCalled();
  await initialized;
  const { authReadiness } = await import("../src/app/readiness");
  expect(authReadiness().state().status).toBe("ready");
  observeAuthSession()();
  expect(isAuthAvailable()).toBe(false);
  expect(getAuthenticatedUser()).toBeNull();
  expect(callback).toHaveBeenCalledWith(true, null);
  expect(preloadUser).not.toHaveBeenCalled();
  expect((await getAuthClient().getSession()).error?.status).toBe(503);
  await expect(requestOAuth("google")).rejects.toThrow("frontend-only");
  expect(fetch).not.toHaveBeenCalled();
});
afterEach(async () => {
  (await import("./__harness__/mock-application")).releaseTestApplication();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it.each([
  ["/api", `${window.location.origin}/api/auth/get-session`],
  ["http://localhost:5005", "http://localhost:5005/auth/get-session"],
  [
    "https://api.example.test/custom-api/",
    "https://api.example.test/custom-api/auth/get-session",
  ],
])(
  "fetches cookie sessions through the configured API (%s)",
  async (backendUrl, expectedUrl) => {
    config.backendUrl = backendUrl;
    (await import("./__harness__/mock-application")).releaseTestApplication();
    vi.resetModules();
    await import("./__harness__/mock-application");
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(Response.json(null));
    vi.stubGlobal("fetch", fetch);
    const { getAuthClient } = await import("../src/ts/auth-client");
    const session = await getAuthClient().getSession();
    expect(session.error).toBeNull();
    expect(fetch).toHaveBeenCalledOnce();
    const input = fetch.mock.calls[0]?.[0];
    expect(
      input instanceof URL
        ? input.href
        : input instanceof Request
          ? input.url
          : input,
    ).toBe(expectedUrl);
    expect(fetch.mock.calls[0]?.[1]?.credentials).toBe("include");
  },
);

it("reuses the account check when initializing an existing session", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(async (input) =>
      Response.json(
        (input instanceof Request ? input.url : input.toString()).includes(
          "list-accounts",
        )
          ? []
          : {
              user: { id: "user", name: "User", email: "user@example.test" },
              session: { id: "session" },
            },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  preloadUser.mockResolvedValue({ name: "User" });
  const { init } = await import("../src/ts/auth-client");
  const callback = vi.fn(async () => undefined);
  await init(callback);
  expect(preloadUser).toHaveBeenCalledOnce();
  expect(callback).toHaveBeenCalledWith(
    true,
    expect.objectContaining({ uid: "user" }),
  );
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("preserves onboarding for sessions without an Oxytype account", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(async (input) =>
      Response.json(
        (input instanceof Request ? input.url : input.toString()).includes(
          "list-accounts",
        )
          ? []
          : {
              user: { id: "new", name: "New", email: "new@example.test" },
              session: { id: "session" },
            },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const { SnapshotInitError } =
    await import("../src/ts/utils/snapshot-init-error");
  preloadUser.mockRejectedValue(new SnapshotInitError("Not found", 404));
  const { init } = await import("../src/ts/auth-client");
  const { googleSignUpEvent } = await import("../src/ts/events/google-sign-up");
  const dispatch = vi.spyOn(googleSignUpEvent, "dispatch");
  const callback = vi.fn(async () => undefined);
  await init(callback);
  const { authReadiness } = await import("../src/app/readiness");
  expect(authReadiness().state().status).toBe("ready");
  expect(callback).not.toHaveBeenCalled();
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ isNewUser: true }),
  );
});
