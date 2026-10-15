import * as Core from "@oxytype/typing-core/input/util";
import { isFunboxActiveWithProperty } from "../../test/funbox/list";
import { getMutableConfig } from "../../config/store";
export function getCommitCharacterType(
  options: Parameters<typeof Core.getCommitCharacterType>[0],
): ReturnType<typeof Core.getCommitCharacterType> {
  return Core.getCommitCharacterType(
    options,
    isFunboxActiveWithProperty("nospace"),
  );
}
export function normalizeData(
  data: string,
  inputValue: string,
  targetWord: string,
): string {
  return Core.normalizeData(
    data,
    inputValue,
    targetWord,
    getMutableConfig().language,
  );
}
