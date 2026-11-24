import { scrollTape } from "./tape";
import { peekConfig } from "#shared/config/store.ts";
import { getWordsElement as getWordsEl } from "#features/typing/state/test-dom.ts";

export function updateWordsMargin(): void {
  if (peekConfig().tapeMode !== "off") {
    Object.assign(getWordsEl().style, { marginLeft: "0" });
    void scrollTape(true);
  } else {
    const afterNewlineEls = Array.from(
      getWordsEl().querySelectorAll<HTMLElement>(".afterNewline"),
    );
    Object.assign(getWordsEl().style, { marginLeft: "0", marginTop: "0" });
    for (const afterNewline of afterNewlineEls) {
      Object.assign(afterNewline.style, {
        marginLeft: "0",
      });
    }
  }
}
