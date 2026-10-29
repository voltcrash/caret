import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { afterEach, expect, it, vi } from "vite-plus/test";

import { OperationError } from "../src/data/operation-result";
import { profileOptions, isUserNotFound } from "../src/data/profile";
import { ProfilePage } from "../src/features/profile/page";
import { getProfile } from "../src/functions/profile";

vi.mock("../src/functions/profile", () => ({ getProfile: vi.fn() }));
afterEach(cleanup);

it("preserves failure status and only treats 404 as missing", async () => {
  vi.mocked(getProfile).mockResolvedValue({
    ok: false,
    status: 503,
    message: "Unavailable",
  });
  const client = new QueryClient();
  await expect(
    client.query({ ...profileOptions("voltcrash", "web"), retry: false }),
  ).rejects.toMatchObject({ status: 503 });
  expect(
    isUserNotFound(
      new OperationError({ ok: false, status: 404, message: "User not found" }),
    ),
  ).toBe(true);
  expect(
    isUserNotFound(
      new OperationError({
        ok: false,
        status: 500,
        message: "User not found in upstream",
      }),
    ),
  ).toBe(false);
  client.clear();
});

it("shows an outage with a working retry instead of claiming the user is missing", async () => {
  vi.mocked(getProfile).mockResolvedValue({
    ok: false,
    status: 403,
    message: "Profiles are not available",
  });
  const client = new QueryClient();
  render(() => (
    <QueryClientProvider client={client}>
      <ProfilePage uidOrName="voltcrash" client="web" />
    </QueryClientProvider>
  ));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not load this profile",
  );
  expect(
    screen.queryByText("User voltcrash not found"),
  ).not.toBeInTheDocument();
  const before = vi.mocked(getProfile).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() =>
    expect(vi.mocked(getProfile).mock.calls.length).toBeGreaterThan(before),
  );
  client.clear();
});

it("renders the missing message for an actual unknown user", async () => {
  vi.mocked(getProfile).mockResolvedValue({
    ok: false,
    status: 404,
    message: "User not found",
  });
  const client = new QueryClient();
  render(() => (
    <QueryClientProvider client={client}>
      <ProfilePage uidOrName="nobody" client="web" />
    </QueryClientProvider>
  ));
  expect(await screen.findByText("User nobody not found")).toBeInTheDocument();
  client.clear();
});
