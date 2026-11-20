import { createMemo } from "solid-js";

import { getConfig } from "#shared/config/store.ts";
import { getLocalPB } from "#shared/db.ts";
import { getFormatting, isAuthenticated } from "#shared/states/core.ts";
import { getSnapshot } from "#shared/states/snapshot.ts";
import { getCurrentQuote } from "#shared/states/test.ts";
import { getMode2 } from "#shared/utils/misc.ts";

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

    return `${speed}\n${acc}`;
  });

  return (
    <Notice
      compact
      class="motion-safe:animate-content-in"
      when={
        isAuthenticated() && getSnapshot() !== undefined && getConfig.showPb
      }
      icon="fa-crown"
      openCommandline="showPb"
      text={displayText()}
    />
  );
}
