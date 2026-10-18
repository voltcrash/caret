import preview from "#.storybook/preview";

import { Nav } from "../../src/ts/components/layout/header/Nav";

const meta = preview.meta({
  title: "Layout/Header/Nav",
  component: Nav,
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
