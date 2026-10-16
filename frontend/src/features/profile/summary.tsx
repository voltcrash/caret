import type { UserProfile } from "@oxytype/schemas/users";

import { formatDate } from "date-fns/format";
import { For, type JSXElement, Show } from "solid-js";

/**
 * Server-rendered public profile summary. The interactive profile (badges,
 * charts, report/edit controls) replaces it once the browser leaf loads.
 */
export function ProfileSummary(props: { profile: UserProfile }): JSXElement {
  const best = (mode2: string): string => {
    const pbs = props.profile.personalBests.time[mode2] ?? [];
    const wpm = Math.max(0, ...pbs.map((pb) => pb.wpm));
    return wpm === 0 ? "-" : String(Math.round(wpm));
  };
  return (
    <section class="grid gap-4" aria-label="Profile summary">
      <h1 class="text-4xl text-text">{props.profile.name}</h1>
      <div class="text-sub">
        Joined {formatDate(props.profile.addedAt, "dd MMM yyyy")}
      </div>
      <Show when={props.profile.details?.bio}>{(bio) => <p>{bio()}</p>}</Show>
      <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt class="text-sub">tests started</dt>
          <dd class="text-2xl">{props.profile.typingStats.startedTests}</dd>
        </div>
        <div>
          <dt class="text-sub">tests completed</dt>
          <dd class="text-2xl">{props.profile.typingStats.completedTests}</dd>
        </div>
        <For each={["15", "60"]}>
          {(mode2) => (
            <div>
              <dt class="text-sub">time {mode2} best</dt>
              <dd class="text-2xl">{best(mode2)}</dd>
            </div>
          )}
        </For>
      </dl>
    </section>
  );
}
