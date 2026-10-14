import { cleanup, render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import Select from "../../../src/ts/components/ui/Select";

const options = [
  { value: "apple", text: "Apple" },
  { value: "banana", text: "Banana" },
  { value: "cherry", text: "Cherry" },
];
afterEach(cleanup);

describe("Select", () => {
  it("searches and selects with keyboard while keeping focus", async () => {
    const user = userEvent.setup();
    const [value, setValue] = createSignal("apple");
    render(() => (
      <Select
        label="Fruit"
        options={options}
        selected={value()}
        onChange={setValue}
      />
    ));
    const combo = screen.getByRole("combobox", { name: "Fruit" });
    await user.click(combo);
    await user.type(combo, "BAN");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.keyboard("{Enter}");
    expect(value()).toBe("banana");
    expect(combo).toHaveValue("Banana");
    expect(combo).toHaveFocus();
    expect(combo).toHaveAttribute("aria-expanded", "false");
  });

  it("navigates options, closes on Escape, and leaves the containing dialog open", async () => {
    const user = userEvent.setup();
    const escape = vi.fn();
    const change = vi.fn();
    render(() => (
      <div onKeyDown={escape}>
        <Select
          label="Fruit"
          options={options}
          selected="apple"
          onChange={change}
        />
      </div>
    ));
    const combo = screen.getByRole("combobox", { name: "Fruit" });
    await user.click(combo);
    await user.keyboard("{End}{ArrowDown}{ArrowUp}{Enter}");
    expect(change).toHaveBeenCalledWith("cherry");
    await user.keyboard("{Enter}");
    escape.mockClear();
    await user.keyboard("{Escape}");
    expect(escape).not.toHaveBeenCalled();
    expect(combo).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{Escape}");
    expect(escape).toHaveBeenCalledTimes(1);
  });

  it("updates controlled selection and options without emitting changes", () => {
    const [value, setValue] = createSignal("apple");
    const [items, setItems] = createSignal(options);
    const change = vi.fn();
    render(() => (
      <Select
        label="Fruit"
        options={items()}
        selected={value()}
        onChange={change}
      />
    ));
    const combo = screen.getByRole("combobox");
    setValue("banana");
    expect(combo).toHaveValue("Banana");
    setItems([{ value: "banana", text: "Updated banana" }]);
    expect(combo).toHaveValue("Updated banana");
    expect(change).not.toHaveBeenCalled();
  });

  it("filters grouped options and renders literal special characters", async () => {
    const user = userEvent.setup();
    render(() => (
      <Select
        label="Language"
        optionGroups={[
          { label: "RTL", options: [{ value: "ar", text: '<&" العربية' }] },
          { label: "Other", options },
        ]}
        selected="ar"
      />
    ));
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("RTL");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveTextContent('<&" العربية');
  });

  it("uses a named native select when search is disabled", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(() => (
      <Select
        label="Year"
        options={options}
        selected="apple"
        settings={{ showSearch: false }}
        onChange={change}
      />
    ));
    const select = screen.getByRole("combobox", { name: "Year" });
    expect(select.tagName).toBe("SELECT");
    await user.selectOptions(select, "banana");
    expect(change).toHaveBeenCalledWith("banana");
  });

  it("supports multi-select, all, individual deselection and clearing", async () => {
    const user = userEvent.setup();
    const [values, setValues] = createSignal<string[]>([]);
    render(() => (
      <Select
        label="Fruit"
        multiple
        options={options}
        selected={values()}
        onChange={setValues}
        settings={{ addAllOption: true, allowDeselect: true }}
      />
    ));
    const combo = screen.getByRole("combobox");
    await user.click(combo);
    await user.click(screen.getByRole("option", { name: "all" }));
    expect(values()).toEqual(["apple", "banana", "cherry"]);
    expect(screen.getByRole("listbox")).toHaveAttribute(
      "aria-multiselectable",
      "true",
    );
    await user.click(screen.getByRole("option", { name: "Banana" }));
    expect(values()).toEqual(["apple", "cherry"]);
    await user.click(screen.getByRole("button", { name: "Clear Fruit" }));
    expect(values()).toEqual([]);
  });

  it("enforces minimum selection and summarizes many values", async () => {
    const user = userEvent.setup();
    const [values, setValues] = createSignal(["apple", "banana", "cherry"]);
    render(() => (
      <Select
        label="Fruit"
        multiple
        options={options}
        selected={values()}
        onChange={setValues}
        settings={{ minSelected: 2, maxValuesShown: 2 }}
      />
    ));
    const combo = screen.getByRole("combobox");
    expect(combo).toHaveValue("3 selected");
    await user.click(combo);
    await user.click(screen.getByRole("option", { name: "Cherry" }));
    await user.click(screen.getByRole("option", { name: "Banana" }));
    expect(values()).toEqual(["apple", "banana"]);
  });

  it("closes on blur and disables an open control reactively", async () => {
    const user = userEvent.setup();
    const [disabled, setDisabled] = createSignal(false);
    render(() => (
      <>
        <Select label="Fruit" options={options} disabled={disabled()} />
        <button type="button">Next</button>
      </>
    ));
    const combo = screen.getByRole("combobox");
    await user.click(combo);
    await user.tab();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
    expect(combo).toHaveAttribute("aria-expanded", "false");
    await user.click(combo);
    setDisabled(true);
    expect(combo).toBeDisabled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows an empty search result without changing the selection", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(() => (
      <Select
        label="Fruit"
        options={options}
        selected="apple"
        onChange={change}
      />
    ));
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("missing{ArrowDown}{Enter}");
    expect(screen.getByText("No options found")).toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });
});
