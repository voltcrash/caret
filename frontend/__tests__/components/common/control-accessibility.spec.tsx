import { fireEvent, render, screen } from "@solidjs/testing-library";
import { createForm } from "@tanstack/solid-form";
import { createSignal } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

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
});
