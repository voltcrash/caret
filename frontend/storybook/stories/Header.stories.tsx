import preview from "#.storybook/preview";

import { AppProviders } from "../../src/app/providers";
import { createQueryClient } from "../../src/app/query-client";
import { Header } from "../../src/ts/components/layout/header/Header";

const queryClient = createQueryClient({ staleTime: 0, retry: false });

const meta = preview.meta({
  title: "Layout/Header",
  component: Header,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <AppProviders queryClient={queryClient}>
        <div style={{ padding: "16px" }}>
          <Story />
        </div>
      </AppProviders>
    ),
  ],
});

export const Default = meta.story({});
