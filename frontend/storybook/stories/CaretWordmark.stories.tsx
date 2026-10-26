import preview from "#.storybook/preview";

import { CaretWordmark } from "../../src/components/brand/caret-wordmark";

const meta = preview.meta({
  title: "Brand/CaretWordmark",
  component: CaretWordmark,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Default = meta.story(() => (
  <div class="font-[Lexend_Deca] text-[4rem] text-text">
    <CaretWordmark />
  </div>
));
