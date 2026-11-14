import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import "../../../src/app/app.css";
import { Balloon } from "../../../src/ts/components/common/Balloon";
import { Button } from "../../../src/ts/components/common/Button";

afterEach(cleanup);

describe("tooltips", () => {
  it("preserves visible button names and exposes the hint as a description", () => {
    render(() => (
      <Button text="Save" balloon={{ text: "Save your settings" }} />
    ));
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAccessibleDescription("Save your settings");
  });

  it("keeps explicit names and labels icon-only buttons", () => {
    render(() => (
      <>
        <Button
          aria-label="Open settings"
          fa={{ icon: "fa-cog" }}
          balloon={{ text: "Change preferences" }}
        />
        <Button fa={{ icon: "fa-copy" }} balloon={{ text: "Copy result" }} />
      </>
    ));
    expect(
      screen.getByRole("button", { name: "Open settings" }),
    ).toHaveAccessibleDescription("Change preferences");
    expect(screen.getByRole("button", { name: "Copy result" })).toBeTruthy();
  });

  it("opens on keyboard focus and Escape dismisses without moving focus", async () => {
    render(() => <Balloon text="Exact accuracy">98%</Balloon>);
    const trigger = screen.getByText("98%");
    expect(trigger.tabIndex).toBe(0);
    trigger.focus();
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeVisible());
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("keeps a hovered tooltip readable until both trigger and tooltip are left", async () => {
    render(() => <Balloon text="More information">Details</Balloon>);
    const trigger = screen.getByText("Details");
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    const tooltip = await screen.findByRole("tooltip");
    fireEvent.pointerLeave(trigger);
    fireEvent.pointerEnter(tooltip);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(tooltip).toBeVisible();
    fireEvent.pointerLeave(tooltip);
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("updates descriptions and closes when the hint is removed", async () => {
    const [text, setText] = createSignal<string | undefined>("First hint");
    render(() => <Balloon text={text()}>Value</Balloon>);
    const trigger = screen.getByText("Value");
    trigger.focus();
    await screen.findByRole("tooltip");
    setText("Second hint");
    expect(trigger).toHaveAccessibleDescription("Second hint");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Second hint");
    setText(undefined);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(trigger).not.toHaveAttribute("aria-describedby");
    expect(trigger).not.toHaveAttribute("tabindex");
  });

  it("preserves existing descriptions", () => {
    render(() => (
      <>
        <span id="existing" hidden>
          Required
        </span>
        <Balloon
          as="button"
          aria-describedby="existing"
          text="More information"
        >
          Details
        </Balloon>
      </>
    ));
    expect(
      screen.getByRole("button", { name: "Details" }),
    ).toHaveAccessibleDescription("Required More information");
  });

  it("flips and wraps a long hint at the viewport edge", async () => {
    render(() => (
      <Balloon
        text={"Long explanation ".repeat(40)}
        position="left"
        style={{ position: "fixed", left: "0", top: "0" }}
      >
        Edge
      </Balloon>
    ));
    screen.getByText("Edge").focus();
    const tooltip = await screen.findByRole("tooltip");
    await waitFor(() => {
      expect(tooltip).toBeVisible();
      const bounds = tooltip.getBoundingClientRect();
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(window.innerWidth);
      expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
    });
  });

  it("shows above a native dialog and consumes only the first Escape", async () => {
    const escaped = vi.fn();
    const { container } = render(() => (
      <dialog onKeyDown={escaped}>
        <input aria-label="First field" />
        <Balloon as="button" text="Dialog hint">
          Help
        </Balloon>
      </dialog>
    ));
    const dialog = container.querySelector("dialog");
    dialog?.showModal();
    const trigger = screen.getByRole("button", { name: "Help" });
    trigger.focus();
    const tooltip = await screen.findByRole("tooltip");
    await waitFor(() => expect(tooltip).toBeVisible());
    expect(tooltip.matches(":popover-open")).toBe(true);
    expect(dialog).toContainElement(tooltip);
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(escaped).not.toHaveBeenCalled();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(escaped).toHaveBeenCalledOnce();
    dialog?.close();
  });

  it("ignores touch hover and screenshot-suppressed hints", () => {
    render(() => (
      <div class="noBalloons">
        <Balloon text="Hidden hint">Value</Balloon>
      </div>
    ));
    const trigger = screen.getByText("Value");
    fireEvent.pointerEnter(trigger, { pointerType: "touch" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    trigger.focus();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
