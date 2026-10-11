import { cleanup, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { contactMounts, idleCallbacks, environment } = vi.hoisted(() => ({
  contactMounts: vi.fn(),
  idleCallbacks: [] as (() => void)[],
  environment: { isDevelopment: true },
}));

vi.mock("virtual:env-config", () => ({ envConfig: environment }));
vi.mock("../../../src/ts/utils/idle", () => ({
  runWhenIdle: (fn: () => void) => {
    idleCallbacks.push(fn);
    return () => undefined;
  },
}));
vi.mock("../../../src/ts/components/modals/modal-triggers", () => ({}));
vi.mock("../../../src/ts/components/modals/Commandline", () => ({
  Commandline: () => <div data-testid="commandline" />,
}));
vi.mock("../../../src/ts/components/modals/CookiesModal", () => ({
  CookiesModal: () => <div data-testid="cookies" />,
}));
vi.mock("../../../src/ts/components/modals/ContactModal", () => ({
  ContactModal: () => {
    contactMounts();
    return <div data-testid="contact" />;
  },
}));

import { Modals } from "../../../src/ts/components/modals/Modals";
import { hideModal, showModal } from "../../../src/ts/states/modals";

describe("Modals", () => {
  afterEach(() => {
    cleanup();
    hideModal("Contact");
    environment.isDevelopment = true;
  });

  it("mounts eager modals immediately and lazy modals on first open", async () => {
    render(() => <Modals />);

    expect(screen.getByTestId("commandline")).toBeInTheDocument();
    expect(screen.getByTestId("cookies")).toBeInTheDocument();
    expect(screen.queryByTestId("contact")).not.toBeInTheDocument();
    expect(contactMounts).not.toHaveBeenCalled();

    showModal("Contact");

    await waitFor(() =>
      expect(screen.getByTestId("contact")).toBeInTheDocument(),
    );

    // stays mounted after closing so reopening is instant
    hideModal("Contact");
    expect(screen.getByTestId("contact")).toBeInTheDocument();
    expect(contactMounts).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    "prefetches only in production (development=%s)",
    (isDevelopment) => {
      environment.isDevelopment = isDevelopment;
      idleCallbacks.length = 0;
      render(() => <Modals />);
      expect(idleCallbacks).toHaveLength(isDevelopment ? 0 : 1);
    },
  );
});
