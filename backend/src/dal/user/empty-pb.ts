import type { PersonalBests } from "@oxytype/schemas/shared";

export const emptyPb = (): PersonalBests => ({
  time: {},
  words: {},
  quote: {},
  zen: {},
  custom: {},
});
