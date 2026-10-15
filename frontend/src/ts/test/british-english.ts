import { replace as replaceWord } from "@oxytype/typing-core/british-english";
import { getMutableConfig } from "../config/store";

export async function replace(
  word: string,
  previousWord: string | undefined,
): Promise<string> {
  return replaceWord(word, previousWord, getMutableConfig().mode);
}
