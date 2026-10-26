import type { PersonalBests } from "@caret/schemas/shared";

export const emptyPb = (): PersonalBests => ({
  time: {},
  words: {},
  quote: {},
  zen: {},
  custom: {},
});
