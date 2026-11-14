import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vite-plus/test";

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
});
