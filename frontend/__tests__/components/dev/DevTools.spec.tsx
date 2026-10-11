import { cleanup, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, expect, it, vi } from "vite-plus/test";

const { loads } = vi.hoisted(() => ({
  loads: {
    options: vi.fn(),
    events: vi.fn(),
    tanstack: vi.fn(),
    solid: vi.fn(),
  },
}));

vi.mock("virtual:env-config", () => ({ envConfig: { devTools: false } }));
vi.mock("../../../src/ts/components/dev/TanstackDevtools", () => {
  loads.tanstack();
  return { TanStackDevtools: () => null };
});
vi.mock("@solid-devtools/overlay", () => {
  loads.solid();
  return { attachDevtoolsOverlay: vi.fn() };
});
vi.mock("../../../src/ts/components/modals/DevOptionsModal", () => {
  loads.options();
  return { DevOptionsModal: () => <div data-testid="dev-options" /> };
});
vi.mock("../../../src/ts/components/modals/EventLogViewerModal", () => {
  loads.events();
  return { EventLogViewerModal: () => <div data-testid="event-log" /> };
});

import { DevTools } from "../../../src/ts/components/dev/DevTools";
import {
  hideModalAndClearChain,
  showModal,
} from "../../../src/ts/states/modals";

afterEach(() => {
  cleanup();
  hideModalAndClearChain("DevOptions");
  hideModalAndClearChain("EventLogViewer");
});

it("loads debug modals only on first open while instrumentation stays disabled", async () => {
  render(() => <DevTools />);
  await Promise.resolve();
  for (const load of Object.values(loads)) expect(load).not.toHaveBeenCalled();

  showModal("DevOptions");
  await waitFor(() =>
    expect(screen.getByTestId("dev-options")).toBeInTheDocument(),
  );
  expect(loads.options).toHaveBeenCalledTimes(1);
  expect(loads.events).not.toHaveBeenCalled();

  hideModalAndClearChain("DevOptions");
  showModal("DevOptions");
  expect(loads.options).toHaveBeenCalledTimes(1);

  hideModalAndClearChain("DevOptions");
  showModal("EventLogViewer");
  await waitFor(() =>
    expect(screen.getByTestId("event-log")).toBeInTheDocument(),
  );
  expect(loads.events).toHaveBeenCalledTimes(1);
  expect(loads.tanstack).not.toHaveBeenCalled();
  expect(loads.solid).not.toHaveBeenCalled();
});
