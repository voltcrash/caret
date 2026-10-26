import { cleanup, render, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { getAuthClient } from "../../../src/features/auth/client.client";
import { OAuthRuntime } from "../../../src/features/auth/oauth-runtime.client";
import { oauthRequestEvent } from "../../../src/features/auth/popup.client";

const client = vi.hoisted(() => ({
  signIn: { social: vi.fn() },
  linkSocial: vi.fn(),
}));
vi.mock("../../../src/features/auth/client.client", () => ({
  getAuthClient: () => client,
}));
vi.mock("../../../src/features/auth/popup.client", () => ({
  oauthRequestEvent: { subscribe: vi.fn() },
}));
const authClient = getAuthClient();
type Request = Parameters<Parameters<typeof oauthRequestEvent.subscribe>[0]>[0];
let listener: ((request: Request) => void) | undefined;
let popup: {
  closed: boolean;
  close: ReturnType<typeof vi.fn>;
  location: { href: string };
};
let unsubscribe = vi.fn<() => void>();
beforeEach(() => {
  vi.resetAllMocks();
  popup = { closed: false, close: vi.fn(), location: { href: "about:blank" } };
  unsubscribe = vi.fn();
  vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
  vi.mocked(oauthRequestEvent.subscribe).mockImplementation((callback) => {
    listener = callback;
    return () => {
      unsubscribe();
    };
  });
  vi.mocked(authClient.signIn.social).mockResolvedValue({
    data: { url: "https://provider.example/sign-in", redirect: true },
    error: null,
  });
  vi.mocked(authClient.linkSocial).mockResolvedValue({
    data: { url: "https://provider.example/link", redirect: true },
    error: null,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function start(link = false): Request {
  render(() => <OAuthRuntime />);
  const request: Request = {
    provider: "google",
    link,
    resolve: vi.fn(),
    reject: vi.fn(),
  };
  if (listener === undefined) throw new Error("OAuth listener missing");
  listener(request);
  return request;
}
function sendMessage(
  data: Record<string, unknown>,
  origin = window.location.origin,
): void {
  const event = new MessageEvent("message", { data, origin });
  // The popup is a controlled fixture rather than a real WindowProxy.
  Object.defineProperty(event, "source", { value: popup });
  window.dispatchEvent(event);
}
it("opens synchronously and starts social sign-in", async () => {
  start();
  expect(window.open).toHaveBeenCalledWith(
    "about:blank",
    "caret-auth",
    expect.any(String),
  );
  await waitFor(() =>
    expect(popup.location.href).toBe("https://provider.example/sign-in"),
  );
  expect(authClient.signIn.social).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: "google",
      disableRedirect: true,
    }),
  );
});
it("links an account through the provider endpoint", async () => {
  start(true);
  await waitFor(() =>
    expect(popup.location.href).toBe("https://provider.example/link"),
  );
  expect(authClient.linkSocial).toHaveBeenCalledOnce();
  expect(authClient.signIn.social).not.toHaveBeenCalled();
});
it.each([false, true])(
  "uses the built callback HTML for sign-in and linking (%s)",
  async (link) => {
    start(link);
    const provider = link ? authClient.linkSocial : authClient.signIn.social;
    await waitFor(() => expect(provider).toHaveBeenCalledOnce());
    const options = vi.mocked(provider).mock.calls[0]?.[0];
    const callback = new URL(options?.callbackURL ?? "");
    expect(callback.origin).toBe(window.location.origin);
    expect(callback.pathname).toBe("/oauth-callback.html");
    expect(callback.searchParams.get("requestId")).toMatch(/^[0-9a-f-]{36}$/);
    expect(options?.errorCallbackURL).toBe(callback.href);
  },
);
it("accepts only matching callback source, origin, and request ID", async () => {
  const request = start();
  await waitFor(() => expect(authClient.signIn.social).toHaveBeenCalledOnce());
  const args = vi.mocked(authClient.signIn.social).mock.calls[0]?.[0];
  const requestId = new URL(args?.callbackURL ?? "").searchParams.get(
    "requestId",
  );
  sendMessage({ type: "caret-auth", requestId }, "https://attacker.example");
  sendMessage({ type: "caret-auth", requestId: "wrong" });
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: window.location.origin,
      data: { type: "caret-auth", requestId },
    }),
  );
  expect(request.resolve).not.toHaveBeenCalled();
  sendMessage({ type: "caret-auth", requestId });
  expect(request.resolve).toHaveBeenCalledOnce();
  expect(popup.close).toHaveBeenCalledOnce();
});
it("reports blocked popups", () => {
  vi.mocked(window.open).mockReturnValue(null);
  const request = start();
  expect(request.reject).toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining("blocked") }),
  );
  expect(authClient.signIn.social).not.toHaveBeenCalled();
});
it("closes failed OAuth attempts", async () => {
  vi.mocked(authClient.signIn.social).mockResolvedValue({
    data: null,
    error: {
      message: "Provider unavailable",
      status: 404,
      statusText: "Not Found",
    },
  });
  const request = start();
  await waitFor(() =>
    expect(request.reject).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Provider unavailable" }),
    ),
  );
  expect(popup.close).toHaveBeenCalledOnce();
});
it("cancels pending requests and closes popups on unmount", () => {
  const request = start();
  cleanup();
  expect(request.reject).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Sign-in cancelled" }),
  );
  expect(popup.close).toHaveBeenCalledOnce();
  expect(unsubscribe).toHaveBeenCalledOnce();
});
