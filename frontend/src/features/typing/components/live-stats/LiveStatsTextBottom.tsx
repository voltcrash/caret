import { AnimeShow } from "../../../../ts/components/common/anime";
import { getConfig } from "../../../../ts/config/store";
import {
  getLiveAccText,
  getLiveBurstText,
  getLiveSpeedText,
  showLiveStats,
} from "../../../../ts/states/live-stats";
import { cn } from "../../../../ts/utils/cn";
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
