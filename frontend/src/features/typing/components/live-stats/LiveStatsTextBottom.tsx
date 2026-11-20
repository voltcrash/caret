import { AnimeShow } from "#shared/components/common/anime/index.ts";
import { getConfig } from "#shared/config/store.ts";
import { cn } from "#shared/utils/cn.ts";

import {
  getLiveAccText,
  getLiveBurstText,
  getLiveSpeedText,
  showLiveStats,
} from "./state";
import {
  TEXT_DISPLAY_CLASS,
  TEXT_WRAPPER_CLASS,
  liveStatsTextColor,
} from "./styles";

export function LiveStatsTextBottom() {
  return (
    <div
      class={cn(TEXT_DISPLAY_CLASS, "mx-auto w-full", liveStatsTextColor())}
      style={{
        opacity: getConfig.timerOpacity,
      }}
    >
      <div class={cn(TEXT_WRAPPER_CLASS, "top-4")}>
        <AnimeShow
          when={showLiveStats() && getConfig.liveSpeedStyle === "text"}
        >
          {getLiveSpeedText()}
        </AnimeShow>
        <AnimeShow when={showLiveStats() && getConfig.liveAccStyle === "text"}>
          {getLiveAccText()}
        </AnimeShow>
        <AnimeShow
          when={showLiveStats() && getConfig.liveBurstStyle === "text"}
        >
          {getLiveBurstText()}
        </AnimeShow>
      </div>
    </div>
  );
}
