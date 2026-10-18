import { cleanup, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { simpleMounts } = vi.hoisted(() => ({
  simpleMounts: vi.fn(),
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
vi.mock("../../../src/ts/components/modals/SimpleModal", () => ({
  SimpleModal: () => {
    simpleMounts();
    return <div data-testid="simple" />;
  },
}));

import { Modals } from "../../../src/ts/components/modals/Modals";
import { hideModal, showModal } from "../../../src/ts/states/modals";

describe("Modals", () => {
  afterEach(() => {
    cleanup();
    hideModal("SimpleModal");
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
    expect(screen.queryByTestId("simple")).not.toBeInTheDocument();
    expect(simpleMounts).not.toHaveBeenCalled();

    showModal("Commandline");
    await waitFor(() =>
      expect(screen.getByTestId("commandline")).toBeInTheDocument(),
    );
    hideModal("Commandline");
    showModal("SimpleModal");

    await waitFor(() =>
      expect(screen.getByTestId("simple")).toBeInTheDocument(),
    );

    // stays mounted after closing so reopening is instant
    hideModal("SimpleModal");
    expect(screen.getByTestId("simple")).toBeInTheDocument();
    expect(simpleMounts).toHaveBeenCalledTimes(1);
  });
});
