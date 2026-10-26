import preview from "#.storybook/preview";

import { CaretMark } from "../../src/components/brand/caret-mark";

const meta = preview.meta({
  title: "Brand/CaretMark",
  component: CaretMark,
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
    <CaretMark class="h-4 fill-current" />
    <CaretMark class="h-6 fill-current" />
    <CaretMark class="h-12 fill-current" />
    <CaretMark class="h-24 fill-current" />
  </div>
));
