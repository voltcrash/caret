import type {
  LeaderboardEntry,
  XpLeaderboardEntry,
} from "@oxytype/schemas/leaderboards";

import { queryOptions, useQuery, useQueryClient } from "@tanstack/solid-query";
import {
  createEffect,
  createSignal,
  onMount,
  type JSXElement,
  Show,
} from "solid-js";

import { boardKey, leaderboardOptions } from "../../data/leaderboards";
import { getLeaderboardRank } from "../../functions/leaderboards";
import AsyncContent from "../../ts/components/common/AsyncContent";
import { ClientToggle } from "../../ts/components/common/ClientToggle";
import { LoadingCircle } from "../../ts/components/common/LoadingCircle";
import { Separator } from "../../ts/components/common/Separator";
import { Navigation } from "../../ts/components/pages/leaderboard/Navigation";
import { NextUpdate } from "../../ts/components/pages/leaderboard/NextUpdate";
import { Sidebar } from "../../ts/components/pages/leaderboard/Sidebar";
import { Table } from "../../ts/components/pages/leaderboard/Table";
import { Title } from "../../ts/components/pages/leaderboard/Title";
import { UserRank } from "../../ts/components/pages/leaderboard/UserRank";
import { getSnapshot, updateLbMemory } from "../../ts/db";
import {
  getTerminalAccountQueryOptions,
  updateTerminalLeaderboardMemory,
} from "../../ts/queries/account";
import { getServerConfigurationQueryOptions } from "../../ts/queries/server-configuration";
import { baseKey } from "../../ts/queries/utils/keys";
import { getUserId, isAuthenticated } from "../../ts/states/core";
import {
  getSelection as getStoredSelection,
  setSelection as storeSelection,
} from "../../ts/states/leaderboard-selection";
import { showErrorNotification } from "../../ts/states/notifications";
import { pageSize, type LeaderboardView, type Selection } from "./selection";

type LeaderboardRank = LeaderboardEntry | XpLeaderboardEntry | null;

/** Actor-scoped: removed with the account's private queries. */
function rankOptions(
  selection: Selection,
): ReturnType<typeof queryOptions<LeaderboardRank>> {
  return queryOptions<LeaderboardRank>({
    queryKey: [
      ...baseKey("leaderboardRank", { isUserSpecific: true }),
      selection.type,
      boardKey(selection),
    ],
    queryFn: async ({ signal }) =>
      await getLeaderboardRank({ data: selection, signal }),
    staleTime: selection.type === "allTime" ? 300_000 : 60_000,
  });
}

/**
 * Interactive leaderboard: route search owns the selection and page; this
 * leaf owns rank, scrolling, prefetch and leaderboard-memory updates.
 */
export function LeaderboardContent(props: {
  view: LeaderboardView;
  /** The URL selects a board; otherwise the stored selection applies. */
  explicit: boolean;
  /** The URL already spells out the loaded board and page. */
  normalized: boolean;
  onChange: (view: LeaderboardView) => void;
}): JSXElement {
  const queryClient = useQueryClient();
  const selection = (): Selection => props.view.selection;
  const page = (): number => props.view.page;
  const [scrollToUser, setScrollToUser] = createSignal(false);
  const memoryUpdates = new Set<string>();

  const change = (next: Partial<LeaderboardView>): void =>
    props.onChange({ ...props.view, goToUserPage: false, ...next });
  const setPage = (value: number | ((old: number) => number)): number => {
    const next = typeof value === "function" ? value(page()) : value;
    change({ page: next });
    return next;
  };

  // A bare /leaderboards visit opens the last selection (client override kept).
  onMount(() => {
    if (!props.explicit) {
      const search = props.view.selection.client;
      props.onChange({
        selection:
          search === undefined
            ? getStoredSelection()
            : { ...getStoredSelection(), client: search },
        page: 0,
        goToUserPage: false,
      });
    }
  });
  createEffect(() => {
    if (props.explicit) storeSelection(selection());
  });

  const entriesQuery = useQuery(() => leaderboardOptions(selection(), page()));
  const rankQuery = useQuery(() => ({
    ...rankOptions(selection()),
    enabled: isAuthenticated(),
  }));
  const serverConfigurationQuery = useQuery(() =>
    getServerConfigurationQueryOptions(),
  );
  const terminalAccount = useQuery(() => ({
    ...getTerminalAccountQueryOptions(),
    enabled: isAuthenticated() && selection().client === "tui",
  }));
  const selectedAccount = () =>
    selection().client === "tui" ? terminalAccount.data : getSnapshot();

  // Like the old page: the address bar spells out the board once it loads.
  createEffect(() => {
    if (props.explicit && !props.normalized && entriesQuery.isSuccess) {
      props.onChange(props.view);
    }
  });

  // Prefetch the next page.
  createEffect(() => {
    void queryClient
      .query(leaderboardOptions(selection(), page() + 1))
      .catch(() => undefined);
  });

  // A page past the end (e.g. a stale link) moves to the last page.
  createEffect(() => {
    const data = entriesQuery.data;
    if (data === undefined || data.entries.length > 0 || page() === 0) return;
    const last = Math.max(0, Math.ceil(data.count / pageSize) - 1);
    if (last !== page()) change({ page: last });
  });

  const userPage = (): number | undefined => {
    const rank = rankQuery.data?.rank;
    return rank === undefined ? undefined : Math.ceil(rank / pageSize) - 1;
  };

  createEffect(() => {
    if (props.view.goToUserPage && rankQuery.isSuccess) {
      const target = userPage();
      if (target === undefined) {
        change({});
      } else {
        change({ page: target });
        setScrollToUser(true);
      }
    }
  });

  const getLbMemoryDifference = (
    current: Selection,
    currentRank: number | undefined,
  ): number | undefined => {
    if (
      current.type !== "allTime" ||
      current.mode !== "time" ||
      current.language !== "english" ||
      currentRank === undefined ||
      selectedAccount() === undefined
    ) {
      return undefined;
    }
    const oldRank =
      selectedAccount()?.lbMemory?.time?.[current.mode2]?.english ?? 0;
    return oldRank - currentRank;
  };

  createEffect(() => {
    const rank = rankQuery.data?.rank;
    const current = selection();
    if (!rankQuery.isSuccess || rank === undefined) return;
    if (current.type !== "allTime") return;
    const diff = getLbMemoryDifference(current, rank);
    const key = `${getUserId()}:${current.client ?? "web"}:${current.mode2}:${rank}`;
    if (diff === undefined || diff === 0 || memoryUpdates.has(key)) return;
    memoryUpdates.add(key);
    const update =
      current.client === "tui"
        ? updateTerminalLeaderboardMemory(current.mode2, rank)
        : updateLbMemory("time", current.mode2, "english", rank, true);
    void update
      .catch((error: unknown) =>
        showErrorNotification("Could not save leaderboard rank", { error }),
      )
      .finally(() => memoryUpdates.delete(key));
  });

  const onSelectionChange = (next: Selection): void => {
    setScrollToUser(false);
    change({ selection: next, page: 0 });
  };

  return (
    <div class="content-grid flex flex-col gap-6 lg:flex-row lg:gap-8">
      <div class="w-full shrink-0 lg:w-60 2xl:w-75">
        <div class="mb-4">
          <ClientToggle
            value={selection().client ?? "web"}
            onChange={(client) => onSelectionChange({ ...selection(), client })}
          />
        </div>
        <AsyncContent queries={{ serverConfigurationQuery }}>
          {({ serverConfigurationQueryData }) => (
            <Sidebar
              selection={selection}
              onSelect={onSelectionChange}
              validModeRules={
                serverConfigurationQueryData().dailyLeaderboards
                  .validModeRules ?? []
              }
            />
          )}
        </AsyncContent>
      </div>

      <div class="flex w-full flex-1 flex-col gap-6 lg:gap-8">
        <Title
          selection={selection()}
          onPreviousSelect={() =>
            change({
              selection: { ...selection(), previous: !selection().previous },
            })
          }
        />

        <Show
          when={isAuthenticated() && !entriesQuery.isLoading}
          fallback={<Separator />}
        >
          <AsyncContent
            queries={{ entriesQuery, rankQuery, serverConfigurationQuery }}
            alwaysShowContent
            errorClass="rounded bg-sub-alt p-4"
          >
            {({
              entriesQueryData,
              rankQueryData,
              serverConfigurationQueryData,
            }) => (
              <UserRank
                type={selection().type === "weekly" ? "xp" : "speed"}
                data={rankQueryData()}
                total={entriesQueryData()?.count}
                minWpm={entriesQueryData()?.minWpm}
                memoryDifference={getLbMemoryDifference(
                  selection(),
                  rankQueryData()?.rank,
                )}
                isLbOptOut={getSnapshot()?.lbOptOut ?? false}
                isBanned={getSnapshot()?.banned ?? false}
                minTimeTyping={
                  serverConfigurationQueryData()?.leaderboards.minTimeTyping ??
                  0
                }
                userTimeTyping={selectedAccount()?.typingStats.timeTyping ?? 0}
              />
            )}
          </AsyncContent>
        </Show>

        <AsyncContent
          queries={{ entriesQuery }}
          loader={
            <div class="flex justify-center pt-4 text-4xl">
              <LoadingCircle />
            </div>
          }
        >
          {({ entriesQueryData }) => (
            <div>
              <div class="mb-2 grid grid-cols-1 items-center justify-between gap-2 text-sm sm:grid-cols-2 sm:text-base">
                <NextUpdate type={selection().type} />
                <Navigation
                  isLoading={entriesQuery.isFetching}
                  lastPage={Math.ceil(entriesQueryData().count / pageSize)}
                  userPage={userPage()}
                  currentPage={page()}
                  onPageChange={setPage}
                  onScrollToUser={setScrollToUser}
                  class="w-full sm:w-max"
                />
              </div>

              <div class="overflow-x-auto">
                <Table
                  type={selection().type === "weekly" ? "xp" : "speed"}
                  entries={entriesQueryData().entries}
                  scrollToUser={scrollToUser}
                  onScrolledToUser={() => setScrollToUser(false)}
                />
              </div>

              <div class="mt-4 grid grid-cols-1 items-center justify-between text-sm sm:text-base">
                <Navigation
                  lastPage={Math.ceil(entriesQueryData().count / pageSize)}
                  currentPage={page()}
                  onPageChange={(value: number | ((old: number) => number)) => {
                    const next = setPage(value);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    return next;
                  }}
                  onScrollToUser={setScrollToUser}
                  class="w-full sm:w-max"
                />
              </div>
            </div>
          )}
        </AsyncContent>
      </div>
    </div>
  );
}
