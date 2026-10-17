import preview from "#.storybook/preview";

import { Header } from "../../src/ts/components/layout/header/Header";

const meta = preview.meta({
  title: "Layout/Header",
  component: Header,
  args: { fixed: false },
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ padding: "16px" }}>
        <Story />
      </div>
    ),
  ],
});

export const Default = meta.story({});
