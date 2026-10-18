import { cleanup, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { contactMounts } = vi.hoisted(() => ({
  contactMounts: vi.fn(),
}));
vi.mock("../../../src/ts/components/modals/modal-triggers", () => ({
  useModalTriggers: () => undefined,
}));
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
  });

  it("loads the command palette and other modals only on first open", async () => {
    render(() => <Modals />);

    expect(screen.queryByTestId("commandline")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cookies")).not.toBeInTheDocument();
    showModal("Cookies");
    await waitFor(() =>
      expect(screen.getByTestId("cookies")).toBeInTheDocument(),
    );
    hideModal("Cookies");
    expect(screen.queryByTestId("contact")).not.toBeInTheDocument();
    expect(contactMounts).not.toHaveBeenCalled();

    showModal("Commandline");
    await waitFor(() =>
      expect(screen.getByTestId("commandline")).toBeInTheDocument(),
    );
    hideModal("Commandline");
    showModal("Contact");

    await waitFor(() =>
      expect(screen.getByTestId("contact")).toBeInTheDocument(),
    );

    // stays mounted after closing so reopening is instant
    hideModal("Contact");
    expect(screen.getByTestId("contact")).toBeInTheDocument();
    expect(contactMounts).toHaveBeenCalledTimes(1);
  });
});
