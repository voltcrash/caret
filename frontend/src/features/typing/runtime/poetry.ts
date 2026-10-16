import { getPoem as loadPoem } from "@oxytype/typing-core/poetry";
import { Section } from "@oxytype/typing-core/languages";

export async function getPoem(): Promise<Section | false> {
  return loadPoem(async (url) => (await fetch(url)).json());
}
