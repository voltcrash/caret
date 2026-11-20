import { animate } from "animejs";
import { JSXElement, Show } from "solid-js";

import { navigate } from "#app/navigate.ts";
import { Balloon } from "#shared/components/common/Balloon.tsx";
import { peekConfig } from "#shared/config/store.ts";
import Format from "#shared/singletons/format.ts";
import { applyReducedMotion, getMode2 } from "#shared/utils/misc.ts";

import { resultState } from "../../state/result";

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
        <Balloon
          as="button"
          type="button"
          id="dailyLeaderboardRank"
          aria-label="Show daily leaderboard"
          text="Show daily leaderboard"
          data-balloon-pos="up"
          class={props.bottomClass}
          onClick={() => {
            void navigate(
              `/leaderboards?type=daily&language=${peekConfig().language}&mode2=${getMode2(
                peekConfig(),
                null,
              )}&goToUserPage=true`,
            );
          }}
        >
          {Format.rank(resultState.dailyLeaderboardRank, { fallback: "" })}
        </Balloon>
      </div>
    </Show>
  );
}
