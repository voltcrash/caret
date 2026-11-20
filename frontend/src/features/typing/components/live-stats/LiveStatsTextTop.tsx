import { AnimeShow } from "#shared/components/common/anime/index.ts";
import { getConfig } from "#shared/config/store.ts";
import { cn } from "#shared/utils/cn.ts";

import { getTimerText, isTimerFlashHidden, showLiveStats } from "./state";
import {
  TEXT_DISPLAY_CLASS,
  TEXT_WRAPPER_CLASS,
  liveStatsTextColor,
} from "./styles";

export function LiveStatsTextTop() {
  return (
    <div
      class={cn(
        TEXT_DISPLAY_CLASS,
        "mx-auto w-0 justify-self-center",
        liveStatsTextColor(),
      )}
      style={{
        opacity: getConfig.timerOpacity,
      }}
    >
      <div class={cn(TEXT_WRAPPER_CLASS, "bottom-5")}>
        <AnimeShow
          when={
            showLiveStats() &&
            ["text", "flash_text"].includes(getConfig.timerStyle)
          }
        >
          {/* flash_text blanks the text instead of fading it, unlike flash_mini */}
          <div>{isTimerFlashHidden() ? "" : getTimerText()}</div>
        </AnimeShow>
      </div>
    </div>
  );
}
