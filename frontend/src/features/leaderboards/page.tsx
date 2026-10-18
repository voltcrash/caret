import type { LeaderboardEntry } from "@oxytype/schemas/leaderboards";

import { useQuery } from "@tanstack/solid-query";
import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { For, lazy, Show, Suspense, type JSXElement } from "solid-js";

import type { LeaderboardView, Selection } from "./selection";

import { leaderboardOptions } from "../../data/leaderboards";
import { onlyCachedOnServer } from "../../data/prefetch";

const Content = lazy(
  createClientOnlyFn(async () => ({
    default: (await import("./view.client")).LeaderboardContent,
  })),
);

function heading(selection: Selection): string {
  if (selection.type === "weekly") {
    return `${selection.previous ? "Last week's" : "Weekly"} XP leaderboard`;
  }
  const board = selection.type === "daily" ? "Daily" : "All-time";
  return `${board} ${selection.language} ${selection.mode} ${selection.mode2} leaderboard`;
}

/** Server-rendered first view: board title and the requested page's ranks. */
function StaticBoard(props: { view: LeaderboardView }): JSXElement {
  const entries = useQuery(() => ({
    ...leaderboardOptions(props.view.selection, props.view.page),
    enabled: onlyCachedOnServer(),
  }));
  const speed = (entry: unknown): LeaderboardEntry | undefined =>
    props.view.selection.type === "weekly"
      ? undefined
      : (entry as LeaderboardEntry);
  return (
    <section class="grid gap-4" aria-label="Leaderboard">
      <h2 class="text-2xl">{heading(props.view.selection)}</h2>
      <Show when={entries.data}>
        {(data) => (
          <table class="w-full text-left">
            <thead class="text-sub">
              <tr>
                <th>#</th>
                <th>name</th>
                <th>{props.view.selection.type === "weekly" ? "xp" : "wpm"}</th>
                <Show when={props.view.selection.type !== "weekly"}>
                  <th>accuracy</th>
                </Show>
              </tr>
            </thead>
            <tbody>
              <For each={data().entries}>
                {(entry, index) => (
                  <tr>
                    <td>
                      {"rank" in entry
                        ? entry.rank
                        : props.view.page * data().pageSize + index() + 1}
                    </td>
                    <td>{entry.name}</td>
                    <td>
                      {"totalXp" in entry
                        ? entry.totalXp
                        : speed(entry)?.wpm.toFixed(2)}
                    </td>
                    <Show when={speed(entry)}>
                      {(row) => <td>{row().acc.toFixed(2)}%</td>}
                    </Show>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        )}
      </Show>
    </section>
  );
}

export function LeaderboardPage(props: {
  view: LeaderboardView;
  explicit: boolean;
  normalized: boolean;
  onChange: (view: LeaderboardView) => void;
}): JSXElement {
  return (
    <ClientOnly fallback={<StaticBoard view={props.view} />}>
      <Suspense fallback={<StaticBoard view={props.view} />}>
        <Content
          view={props.view}
          explicit={props.explicit}
          normalized={props.normalized}
          onChange={props.onChange}
        />
      </Suspense>
    </ClientOnly>
  );
}
