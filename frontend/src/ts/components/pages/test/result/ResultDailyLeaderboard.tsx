import { animate } from "animejs";
import { JSXElement, Show } from "solid-js";

import { getMutableConfig } from "../../../../config/store";
import { navigate } from "../../../../navigation/navigation";
import Format from "../../../../singletons/format";
import { resultState } from "../../../../states/result";
import { applyReducedMotion, getMode2 } from "../../../../utils/misc";

export function ResultDailyLeaderboard(props: {
  topClass: string;
  bottomClass: string;
}): JSXElement {
  return (
    <Show when={resultState.dailyLeaderboardRank !== undefined}>
      <div
        ref={(el) => {
          animate(el, {
            opacity: [0, 1],
            duration: applyReducedMotion(250),
          });
        }}
        class="group dailyLeaderboard max-w-[13rem] whitespace-nowrap max-md:col-span-full max-md:whitespace-normal"
      >
        <div class={props.topClass}>daily leaderboard</div>
        <div
          id="dailyLeaderboardRank"
          aria-label="Show daily leaderboard"
          data-balloon-pos="up"
          class={props.bottomClass}
          onClick={() => {
            void navigate(
              `/leaderboards?type=daily&language=${getMutableConfig().language}&mode2=${getMode2(
                getMutableConfig(),
                null,
              )}&goToUserPage=true`,
            );
          }}
        >
          {Format.rank(resultState.dailyLeaderboardRank, { fallback: "" })}
        </div>
      </div>
    </Show>
  );
}
