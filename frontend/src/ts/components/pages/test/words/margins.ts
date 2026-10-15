import { scrollTape } from "./tape";
import { getMutableConfig } from "../../../../config/store";
import { getWordsElement as getWordsEl } from "../../../../states/test-dom";

export function updateWordsMargin(): void {
  if (getMutableConfig().tapeMode !== "off") {
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
