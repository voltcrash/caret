import { cancelSpacerAnimation, scrollTape } from "./tape";
import { getWordsScroll } from "./words-scroll";
import { peekConfig } from "#shared/config/store.ts";
import { getWordsElement as getWordsEl } from "#features/typing/state/test-dom.ts";

export function updateWordsMargin(): void {
  const wordsScroll = getWordsScroll();
  if (peekConfig().tapeMode !== "off") {
    wordsScroll.jumpX(0);
    void scrollTape(true);
  } else {
    const afterNewlineEls = Array.from(
      getWordsEl().querySelectorAll<HTMLElement>(".afterNewline"),
    );
    wordsScroll.reset();
    for (const afterNewline of afterNewlineEls) {
      cancelSpacerAnimation(afterNewline);
      Object.assign(afterNewline.style, {
        marginLeft: "0",
      });
    }
  }
}
