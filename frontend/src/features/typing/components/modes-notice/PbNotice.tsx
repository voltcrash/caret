import { createMemo } from "solid-js";

import { getConfig } from "../../../../ts/config/store";
import { getLocalPB } from "../../../../ts/db";
import { getFormatting, isAuthenticated } from "../../../../ts/states/core";
import { getSnapshot } from "../../../../ts/states/snapshot";
import { getCurrentQuote } from "../../../../ts/states/test";
import { getMode2 } from "../../../../ts/utils/misc";
import { getActiveFunboxes } from "../../runtime/funbox/list";
import { Notice } from "./Notice";

export function PbNotice() {
  const displayText = createMemo(() => {
    if (!isAuthenticated()) return "";
    const format = getFormatting();

    //react on config.funbox
    const _funbox = getConfig.funbox;
    //react on new localPB
    const _snapshot = getSnapshot();

    const mode2 = getMode2(getConfig, getCurrentQuote());
    const pb = getLocalPB(
      getConfig.mode,
      mode2,
      getConfig.punctuation,
      getConfig.numbers,
      getConfig.language,
      getConfig.difficulty,
      getConfig.lazyMode,
      getActiveFunboxes(),
    );

    if (pb === undefined) return "no pb";

    const speed = format.typingSpeed(pb.wpm, {
      showDecimalPlaces: true,
      suffix: ` ${getConfig.typingSpeedUnit}`,
    });

    const acc = format.accuracy(pb.acc, { suffix: ` acc` });

    return `${speed} ${acc}`;
  });

  return (
    <Notice
      when={isAuthenticated() && getConfig.showPb}
      icon="fa-crown"
      openCommandline="showPb"
      text={displayText()}
    />
  );
}
