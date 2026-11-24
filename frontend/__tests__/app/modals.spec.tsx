import { cleanup, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { simpleMounts, editTagsLoads } = vi.hoisted(() => ({
  simpleMounts: vi.fn(),
  editTagsLoads: vi.fn(),
}));
vi.mock("../../src/ts/components/modals/Commandline", () => ({
  Commandline: () => <div data-testid="commandline" />,
}));
vi.mock("../../src/ts/components/modals/CookiesModal", () => ({
  CookiesModal: () => <div data-testid="cookies" />,
}));
vi.mock("../../src/ts/components/modals/SimpleModal", () => ({
  SimpleModal: () => {
    simpleMounts();
    return <div data-testid="simple" />;
  },
}));
vi.mock("../../src/features/typing/modals/EditResultTagsModal", () => {
  editTagsLoads();
  return { EditResultTagsModal: () => <div data-testid="edit-result-tags" /> };
});

import { lazyModal, registerModals } from "../../src/app/modal-registry";
import { Modals } from "../../src/app/modals.client";
import { hideModal, showModal } from "../../src/ts/states/modals";

describe("Modals", () => {
  afterEach(() => {
    cleanup();
    hideModal("SimpleModal");
    hideModal("EditResultTags");
    hideModal("EditProfile");
  });

  it("loads the command palette and other modals only on first open", async () => {
    render(() => <Modals />);

    expect(screen.queryByTestId("commandline")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cookies")).not.toBeInTheDocument();
    expect(editTagsLoads).not.toHaveBeenCalled();

    showModal("Cookies");
    await waitFor(() =>
      expect(screen.getByTestId("cookies")).toBeInTheDocument(),
    );
    hideModal("Cookies");
    expect(screen.queryByTestId("simple")).not.toBeInTheDocument();
    expect(simpleMounts).not.toHaveBeenCalled();

    showModal("Commandline");
    await waitFor(
      () => expect(screen.getByTestId("commandline")).toBeInTheDocument(),
      { timeout: 10000 },
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

    // typing feature modals load lazily on first open from any route
    showModal("EditResultTags");
    await waitFor(() =>
      expect(screen.getByTestId("edit-result-tags")).toBeInTheDocument(),
    );
    expect(editTagsLoads).toHaveBeenCalledTimes(1);
    hideModal("EditResultTags");
    expect(screen.getByTestId("edit-result-tags")).toBeInTheDocument();
  });

  it("mounts dynamically registered feature modals and removes them on release", async () => {
    render(() => <Modals />);

    const load = vi.fn(async () => () => <div data-testid="contributed" />);
    const release = registerModals("app", [lazyModal("EditProfile", load)]);

    expect(load).not.toHaveBeenCalled();
    showModal("EditProfile");
    await waitFor(() =>
      expect(screen.getByTestId("contributed")).toBeInTheDocument(),
    );
    expect(load).toHaveBeenCalledTimes(1);

    release();
    await waitFor(() =>
      expect(screen.queryByTestId("contributed")).not.toBeInTheDocument(),
    );
  });
});
