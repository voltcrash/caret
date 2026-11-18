import { useQuery } from "@tanstack/solid-query";
import { createMemo, For, Show } from "solid-js";

import { getConfig } from "../../../ts/config/store";
import { getFormatting, isAuthenticated } from "../../../ts/states/core";
import { isTestActive } from "../../../ts/states/test";
import { sessionOptions } from "../../auth/session";
import { getGuestScores } from "../guest-scores.client";

export function GuestScores() {
  const session = useQuery(() => sessionOptions());
  const length = () => {
    if (getConfig.mode === "time") return getConfig.time;
    if (getConfig.mode === "words") return getConfig.words;
    return undefined;
  };
  const label = () => {
    if (getConfig.mode === "time") return `${getConfig.time || "∞"}s`;
    if (getConfig.mode === "words") return `${getConfig.words || "∞"} words`;
    return getConfig.mode;
  };
  const scores = createMemo(() =>
    session.data?.user === null && !isAuthenticated()
      ? getGuestScores().filter(
          (score) =>
            score.mode === getConfig.mode &&
            (length() === undefined || score.mode2 === String(length())),
        )
      : [],
  );

  return (
    <Show when={!isTestActive() && scores().length > 0}>
      <details class="mx-auto my-4 w-fit self-start text-sm text-sub">
        <summary class="cursor-pointer hover:text-text">
          Recent guest scores · {label()}
        </summary>
        <table class="mt-2 w-full text-right text-text tabular-nums">
          <caption class="pb-2 text-sub">On this device · newest first</caption>
          <thead>
            <tr>
              <th class="text-left">Date</th>
              <th class="px-4">{getConfig.typingSpeedUnit}</th>
              <th>Accuracy</th>
            </tr>
          </thead>
          <tbody>
            <For each={scores()}>
              {(score) => (
                <tr>
                  <td class="text-left">
                    {new Date(score.timestamp).toLocaleString()}
                  </td>
                  <td class="px-4">{getFormatting().typingSpeed(score.wpm)}</td>
                  <td>{getFormatting().accuracy(score.acc)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </details>
    </Show>
  );
}
