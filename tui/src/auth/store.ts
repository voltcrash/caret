import {
  createContext,
  createSignal,
  useContext,
  type Accessor,
} from "solid-js";
import { z } from "zod";

import type { Api } from "../api/client";
import { responseError, TransportError } from "../api/client";
import type { Credential, Credentials } from "./credentials";
import type { DeviceCode } from "./device";
import { openBrowser } from "./browser";
import { pollDeviceToken, requestDeviceCode } from "./device";

const sessionSchema = z
  .object({
    session: z.object({ expiresAt: z.iso.datetime() }),
    user: z.object({ id: z.string().min(1), name: z.string() }),
  })
  .nullable();
type User = Credential["user"];
type AuthState =
  | "guest"
  | "checking"
  | "authorizing"
  | "authenticated"
  | "offline"
  | "error"
  | "signingOut";
export type AuthStore = {
  user: Accessor<User | undefined>;
  state: Accessor<AuthState>;
  online: Accessor<boolean>;
  device: Accessor<DeviceCode | undefined>;
  notice: Accessor<string | undefined>;
  login: () => Promise<void>;
  check: () => Promise<boolean>;
  logout: () => Promise<void>;
  invalidate: () => void;
  cancel: () => void;
};
export type AuthOptions = {
  api: Api;
  credentials: Credentials;
  browser?: typeof openBrowser;
  poll?: typeof pollDeviceToken;
  now?: () => number;
  onError?: (operation: string, error: unknown) => void;
};

export function createAuthStore(options: AuthOptions): AuthStore {
  const { api, credentials } = options;
  const now = options.now ?? Date.now;
  const [user, setUser] = createSignal<User | undefined>(
    credentials.get()?.user,
  );
  const [state, setState] = createSignal<AuthState>(
    user() === undefined ? "guest" : "checking",
  );
  const [device, setDevice] = createSignal<DeviceCode>();
  const [online, setOnline] = createSignal(false);
  const [notice, setNotice] = createSignal<string>();
  let controller: AbortController | undefined;
  let version = 0;
  let checking: Promise<boolean> | undefined;

  function cancel(): void {
    version++;
    controller?.abort();
    controller = undefined;
    setDevice(undefined);
    if (state() === "authorizing" || state() === "checking") {
      setState(user() === undefined ? "guest" : "offline");
    }
  }
  function invalidate(): void {
    cancel();
    setUser(undefined);
    setOnline(false);
    setState("guest");
    setNotice("Session expired; log in again");
    void credentials
      .set(undefined)
      .catch(() => setNotice("Session expired; could not remove local token"));
  }
  async function session(
    token: string,
    signal?: AbortSignal,
  ): Promise<Credential | undefined> {
    const response = await api.auth(
      "/get-session",
      undefined,
      signal,
      false,
      token,
    );
    if (response.status === 401) return undefined;
    if (response.status !== 200) throw responseError(response);
    const data = sessionSchema.parse(response.body);
    if (data === null) return undefined;
    return {
      apiUrl: api.settings.apiUrl,
      accessToken: token,
      expiresAt: Date.parse(data.session.expiresAt),
      user: { uid: data.user.id, name: data.user.name },
    };
  }
  async function checkSession(): Promise<boolean> {
    if (state() === "authorizing" || state() === "signingOut") return false;
    const credential = credentials.get();
    if (credential === undefined) return false;
    if (credential.expiresAt <= now()) {
      invalidate();
      return false;
    }
    const current = ++version;
    controller = new AbortController();
    const signal = controller.signal;
    setState("checking");
    try {
      const verified = await session(credential.accessToken, signal);
      if (current !== version) return false;
      if (verified === undefined || verified.expiresAt <= now()) {
        invalidate();
        return false;
      }
      await credentials.set(verified);
      if (current !== version) return false;
      setUser(verified.user);
      setOnline(true);
      setState("authenticated");
      setNotice(undefined);
      return true;
    } catch (error) {
      if (current !== version) return false;
      options.onError?.("auth.check", error);
      setState(error instanceof TransportError ? "offline" : "error");
      setOnline(false);
      setNotice(
        error instanceof TransportError
          ? "Offline; session will be checked on reconnect"
          : errorMessage(error),
      );
      return false;
    }
  }

  return {
    user,
    state,
    online,
    device,
    notice,
    cancel,
    invalidate,
    check: async () => {
      checking ??= checkSession().finally(() => {
        checking = undefined;
      });
      return await checking;
    },
    login: async () => {
      if (state() === "authorizing" || state() === "signingOut") return;
      cancel();
      const current = version;
      controller = new AbortController();
      const signal = controller.signal;
      setState("authorizing");
      setOnline(false);
      setNotice(undefined);
      try {
        const code = await requestDeviceCode(api, signal);
        if (current !== version) return;
        setDevice(code);
        void (options.browser ?? openBrowser)(
          code.verification_uri_complete ?? code.verification_uri,
        ).catch(() => {
          if (current === version) {
            setNotice("Open the link above in your browser");
          }
        });
        const token = await (options.poll ?? pollDeviceToken)(
          api,
          code,
          signal,
        );
        if (current !== version) return;
        const verified = await session(token.access_token, signal);
        if (current !== version) return;
        if (verified === undefined) {
          throw new Error("Login did not create a session");
        }
        verified.expiresAt = Math.min(
          verified.expiresAt,
          now() + token.expires_in * 1000,
        );
        await credentials.set(verified);
        if (current !== version) return;
        setUser(verified.user);
        setOnline(true);
        setDevice(undefined);
        setState("authenticated");
        setNotice(undefined);
      } catch (error) {
        if (current !== version) return;
        options.onError?.("auth.login", error);
        setDevice(undefined);
        setState("error");
        setNotice(errorMessage(error));
      }
    },
    logout: async () => {
      if (state() === "signingOut") return;
      cancel();
      const current = version;
      const credential = credentials.get();
      setState("signingOut");
      setOnline(false);
      try {
        if (credential !== undefined && credential.expiresAt > now()) {
          const response = await api.auth(
            "/sign-out",
            {},
            undefined,
            false,
            credential.accessToken,
          );
          // Expired bearer sessions can be rejected by the auth origin guard.
          if (![200, 401, 403].includes(response.status)) {
            throw responseError(response);
          }
        }
        await credentials.set(undefined);
        if (current !== version) return;
        setUser(undefined);
        setState("guest");
        setNotice("Logged out");
      } catch (error) {
        if (current !== version) return;
        options.onError?.("auth.logout", error);
        // Keep the credential so a failed revocation can be retried.
        setState("error");
        setNotice(
          `Logout failed: ${errorMessage(error)}; retry to revoke the session`,
        );
      }
    },
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Operation failed";
}
export const AuthContext = createContext<AuthStore>();
export function useAuth(): AuthStore | undefined {
  return useContext(AuthContext);
}
