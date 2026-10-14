import { createSignal } from "solid-js";
import { fn } from "storybook/test";

import preview from "#.storybook/preview";

import Select from "../../src/ts/components/ui/Select";

const options = [
  { value: "apple", text: "Apple" },
  { value: "banana", text: "Banana" },
  { value: "cherry", text: "Cherry" },
];
const meta = preview.meta({
  title: "UI/Select",
  component: Select,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { label: "Fruit", options, selected: "banana", onChange: fn() },
});

export const Searchable = meta.story({
  render: () => {
    const [value, setValue] = createSignal<string | undefined>("banana");
    return (
      <div class="w-64">
        <Select
          label="Fruit"
          options={options}
          selected={value()}
          onChange={setValue}
        />
        <p class="mt-2 text-sub">Selected: {value()}</p>
      </div>
    );
  },
});
export const Native = meta.story({ args: { settings: { showSearch: false } } });
export const Disabled = meta.story({ args: { disabled: true } });
export const Grouped = meta.story({
  args: {
    options: undefined,
    optionGroups: [
      { label: "Fruit", options },
      {
        label: "Vegetables",
        options: [
          { value: "carrot", text: "Carrot" },
          { value: "pea", text: "Pea" },
        ],
      },
    ],
  },
});
export const Multiple = meta.story({
  render: () => {
    const [values, setValues] = createSignal(["apple", "banana"]);
    return (
      <div class="w-64">
        <Select
          label="Fruit"
          multiple
          options={options}
          selected={values()}
          onChange={setValues}
          settings={{
            addAllOption: true,
            allowDeselect: true,
            closeOnSelect: false,
          }}
        />
        <p class="mt-2 text-sub">Selected: {values().join(", ") || "none"}</p>
      </div>
    );
  },
});
export const MinimumSelection = meta.story({
  render: () => {
    const [values, setValues] = createSignal(["apple", "banana"]);
    return (
      <div class="w-64">
        <Select
          label="Fruit (at least two)"
          multiple
          options={options}
          selected={values()}
          onChange={setValues}
          settings={{ minSelected: 2, allowDeselect: true, maxValuesShown: 2 }}
        />
      </div>
    );
  },
});
