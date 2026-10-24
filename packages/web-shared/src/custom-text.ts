import { CustomTextSettings } from "@oxytype/schemas/results";

/** Custom text used until the user saves their own. */
export const defaultCustomTextSettings: CustomTextSettings = {
  text: ["The", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog"],
  mode: "repeat",
  limit: { value: 9, mode: "word" },
  pipeDelimiter: false,
};
