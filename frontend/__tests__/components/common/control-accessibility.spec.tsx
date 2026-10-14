import { fireEvent, render, screen } from "@solidjs/testing-library";
import { createForm } from "@tanstack/solid-form";
import { createSignal } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { Button } from "../../../src/ts/components/common/Button";
import { InputField } from "../../../src/ts/components/ui/form/InputField";
import { LabeledField } from "../../../src/ts/components/ui/form/LabeledField";

describe("shared accessible controls", () => {
  it("keeps inherited labels reactive", () => {
    render(() => {
      const [label, setLabel] = createSignal("Word limit");
      const form = createForm(() => ({ defaultValues: { count: 10 } }));
      return (
        <>
          <button type="button" onClick={() => setLabel("New limit")}>
            Rename label
          </button>
          <LabeledField label={label()}>
            <form.Field name="count">
              {(field) => <InputField field={field} type="number" />}
            </form.Field>
          </LabeledField>
        </>
      );
    });
    expect(
      screen.getByRole("spinbutton", { name: "Word limit" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rename label" }));
    expect(
      screen.getByRole("spinbutton", { name: "New limit" }),
    ).toBeInTheDocument();
  });

  it("names icon-only buttons and hides decorative icons", () => {
    render(() => (
      <Button fa={{ icon: "fa-trash" }} aria-label="Delete saved text" />
    ));
    const button = screen.getByRole("button", { name: "Delete saved text" });
    expect(button.querySelector("i")).toHaveAttribute("aria-hidden", "true");
  });
});
