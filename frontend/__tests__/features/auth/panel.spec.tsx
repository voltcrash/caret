import type { SessionState } from "@caret/schemas/auth-session";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { QueryClientProvider } from "@tanstack/solid-query";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const actions = vi.hoisted(() => ({ complete: vi.fn(), cancel: vi.fn() }));
vi.mock("../../../src/features/auth/actions.client", () => ({
  createAuthActions: () => actions,
}));
vi.mock("@tanstack/solid-router", async (original) => ({
  ...(await original<typeof import("@tanstack/solid-router")>()),
  useRouter: () => ({ invalidate: vi.fn(), navigate: vi.fn() }),
}));
vi.mock("../../../src/functions/session", () => ({
  getSessionState: async () => new Promise(() => undefined),
}));

import type { TurnstileOptions } from "../../../src/ts/components/ui/form/Captcha";

import { requireApplication } from "../../../src/app/application";
import { AuthPanel } from "../../../src/features/auth/panel.client";
import { sessionKey } from "../../../src/features/auth/session";

let options: TurnstileOptions;
const api = {
  render: vi.fn((_element: HTMLElement, settings: TurnstileOptions) => {
    options = settings;
    return "signup-widget";
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  actions.complete.mockRejectedValue(new Error("Username unavailable"));
  actions.cancel.mockResolvedValue(undefined);
  vi.stubGlobal("turnstile", api);
  const initial: SessionState = {
    user: {
      uid: "pending",
      displayName: "New user",
      email: "new@example.test",
      registered: false,
      providerData: [],
    },
    signUpEnabled: true,
  };
  const client = requireApplication().queryClient;
  client.setQueryData(sessionKey, initial);
  render(() => (
    <QueryClientProvider client={client}>
      <AuthPanel initial={initial} />
    </QueryClientProvider>
  ));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("blocks signup without verification, including native form submission", async () => {
  const button = screen.getByRole("button", { name: "continue" });
  expect(button).toBeDisabled();
  fireEvent.input(screen.getByRole("textbox", { name: "username" }), {
    target: { value: "voltcrash" },
  });
  expect(button).toBeDisabled();
  fireEvent.submit(button.closest("form")!);
  await waitFor(() => expect(button).toBeDisabled());
  expect(actions.complete).not.toHaveBeenCalled();
  expect(screen.queryByText("Invalid operation input")).not.toBeInTheDocument();
});

it("requires a fresh token after expiry, failure and a consumed signup attempt", async () => {
  const input = screen.getByRole("textbox", { name: "username" });
  const button = screen.getByRole("button", { name: "continue" });
  options.callback("first-token");
  expect(button).toBeDisabled();
  fireEvent.input(input, { target: { value: "voltcrash" } });
  await waitFor(() => expect(button).toBeEnabled());
  options["expired-callback"]();
  await waitFor(() => expect(button).toBeDisabled());
  options.callback("second-token");
  await waitFor(() => expect(button).toBeEnabled());
  options["error-callback"]();
  await waitFor(() => expect(button).toBeDisabled());
  options.callback("third-token");
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() =>
    expect(actions.complete).toHaveBeenCalledWith("voltcrash", "third-token"),
  );
  await waitFor(() => expect(button).toBeDisabled());
  expect(input).toHaveValue("voltcrash");
  expect(api.reset).toHaveBeenCalledWith("signup-widget");
  options.callback("retry-token");
  await waitFor(() => expect(button).toBeEnabled());
});
