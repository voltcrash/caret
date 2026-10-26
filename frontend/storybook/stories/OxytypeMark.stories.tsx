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
  args: { class: "h-24 fill-current text-main" },
});

export const Sizes = meta.story(() => (
  <div class="flex items-end gap-4 text-main">
    <OxytypeMark class="h-4 fill-current" />
    <OxytypeMark class="h-6 fill-current" />
    <OxytypeMark class="h-12 fill-current" />
    <OxytypeMark class="h-24 fill-current" />
  </div>
));
