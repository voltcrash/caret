import preview from "#.storybook/preview";

import { OxytypeMark } from "../../src/components/brand/oxytype-mark";

const meta = preview.meta({
  title: "Brand/OxytypeMark",
  component: OxytypeMark,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    class: { control: "text" },
  },
});

export const Default = meta.story({
  args: { class: "w-24 fill-current text-main" },
});

export const Sizes = meta.story(() => (
  <div class="flex items-end gap-4 text-main">
    <OxytypeMark class="w-4 fill-current" />
    <OxytypeMark class="w-6 fill-current" />
    <OxytypeMark class="w-12 fill-current" />
    <OxytypeMark class="w-24 fill-current" />
  </div>
));
