import { useQuery } from "@tanstack/solid-query";
import { createEffect, createSignal, JSXElement, Show } from "solid-js";

import { getSnapshot, updateLbMemory } from "../../../db";
import { createEffectOn } from "../../../hooks/effects";
import { PageName } from "../../../pages/page";
import { getQueryClient } from "../../../queries";
import {
  getAccountQueryOptions,
  updateTerminalLeaderboardMemory,
} from "../../../queries/account";
import {
  getLeaderboardQueryOptions,
  getRankQueryOptions,
} from "../../../queries/leaderboards";
import { getServerConfigurationQueryOptions } from "../../../queries/server-configuration";
import {
  getActivePage,
  getUserId,
  isAuthenticated,
} from "../../../states/core";
import {
  getGoToUserPage,
  getPage,
  getSelection,
  pageSize,
  Selection,
  setGoToUserPage,
  setPage,
  setSelection,
  updateGetParameters,
} from "../../../states/leaderboard-selection";
import { showErrorNotification } from "../../../states/notifications";
import { cn } from "../../../utils/cn";
import AsyncContent from "../../common/AsyncContent";
import { ClientToggle } from "../../common/ClientToggle";
import { LoadingCircle } from "../../common/LoadingCircle";
import { Page } from "../../common/Page";
import { Separator } from "../../common/Separator";
import { Navigation } from "./Navigation";
import { NextUpdate } from "./NextUpdate";
import { Sidebar } from "./Sidebar";
import { Table } from "./Table";
import { Title } from "./Title";
import { UserRank } from "./UserRank";

const pageName: PageName = "leaderboards";

export function LeaderboardPage(): JSXElement {
  const isOpen = () => getActivePage() === pageName;

  const [scrollToUser, setScrollToUser] = createSignal(false);
  const terminalAccount = useQuery(() => ({
    ...getAccountQueryOptions("tui"),
    enabled: isOpen() && isAuthenticated() && getSelection().client === "tui",
  }));
  const selectedAccount = () =>
    getSelection().client === "tui" ? terminalAccount.data : getSnapshot();
  const memoryUpdates = new Set<string>();

  //invalidate cache for daily and weekly lb on close
  createEffectOn(isOpen, (open) => {
    if (!open) {
      void getQueryClient().invalidateQueries({
        predicate: (query) =>
          query.queryKey.length >= 3 &&
          query.queryKey[1] === "leaderboard" &&
          ["weekly", "daily"].includes(query.queryKey[2] as string),
      });
    }
  });

  //prefetch next page
  createEffect(() => {
    if (isOpen()) {
      void getQueryClient()
        .query(
          getLeaderboardQueryOptions({
            ...getSelection(),
            page: getPage() + 1,
          }),
        )
        .catch(() => undefined);
    }
  });

  //update url after the data is loaded
  createEffect(() => {
    if (isOpen() && entriesQuery.isSuccess) {
      updateGetParameters(getSelection(), getPage());
    }
  });

  //update lb memory after the rank is loaded
  createEffect(() => {
    if (isOpen() && rankQuery.isSuccess) {
      syncLbMemory();
    }
  });

  //handle goToUserPage url param once rank is loaded
  createEffect(() => {
    if (isOpen() && getGoToUserPage() && rankQuery.isSuccess) {
      setGoToUserPage(false);
      const page = userPage();
      if (page !== undefined) {
        setPage(page);
        setScrollToUser(true);
      }
    }
  });

  const entriesQuery = useQuery(() => ({
    ...getLeaderboardQueryOptions({
      ...getSelection(),
      page: getPage() ?? 0,
    }),
    enabled: isOpen(),
  }));

  const rankQuery = useQuery(() => ({
    ...getRankQueryOptions(getSelection()),
    enabled: isAuthenticated() && isOpen(),
  }));

  const serverConfigurationQuery = useQuery(() => ({
    ...getServerConfigurationQueryOptions(),
    enabled: isOpen(),
  }));

  const onSelectionChange = (newSelection: Selection) => {
    setSelection(newSelection);
    setPage(0);
    setScrollToUser(false);
    setGoToUserPage(false);
  };

  /**
   * the page that contains the user
   */
  const userPage = () => {
    const userRank = rankQuery.data?.rank;
    if (userRank === undefined) return undefined;
    const page = Math.ceil(userRank / pageSize) - 1;
    return page;
  };

  const syncLbMemory = () => {
    if (
      rankQuery.data !== undefined &&
      rankQuery.data !== null &&
      getSelection() !== undefined &&
      getSelection().type === "allTime"
    ) {
      const diff = getLbMemoryDifference(getSelection(), rankQuery.data.rank);

      const selection = getSelection();
      const key = `${getUserId()}:${selection.client ?? "web"}:${selection.mode2}:${rankQuery.data.rank}`;
      if (diff !== undefined && diff !== 0 && !memoryUpdates.has(key)) {
        memoryUpdates.add(key);
        const update =
          selection.client === "tui"
            ? updateTerminalLeaderboardMemory(
                selection.mode2 as string,
                rankQuery.data.rank,
              )
            : updateLbMemory(
                "time",
                selection.mode2,
                "english",
                rankQuery.data.rank,
                true,
              );
        void update
          .catch((error: unknown) =>
            showErrorNotification("Could not save leaderboard rank", { error }),
          )
          .finally(() => {
            memoryUpdates.delete(key);
          });
      }
    }
  };

  const getLbMemoryDifference = (
    selection: Selection,
    currentRank: number | undefined,
  ): number | undefined => {
    if (
      selection.type !== "allTime" ||
      selection.mode !== "time" ||
      selection.language !== "english" ||
      currentRank === undefined ||
      selectedAccount() === undefined
    ) {
      return undefined;
    }
    const oldRank =
      selectedAccount()?.lbMemory?.time?.[selection.mode2]?.english ?? 0;
    const diff = oldRank - currentRank;

    return diff;
  };

  return (
    <Page id="leaderboards">
      <div class="content-grid flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div class="w-full shrink-0 lg:w-60 2xl:w-75">
          <div class="mb-4">
            <ClientToggle
              value={getSelection().client ?? "web"}
              onChange={(client) =>
                onSelectionChange({ ...getSelection(), client })
              }
            />
          </div>
          <AsyncContent queries={{ serverConfigurationQuery }}>
            {({ serverConfigurationQueryData }) => (
              <Sidebar
                selection={getSelection}
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
            selection={getSelection()}
            onPreviousSelect={() =>
              setSelection((old) => ({ ...old, previous: !old.previous }))
            }
          />

          <Show
            when={isAuthenticated() && !entriesQuery.isLoading}
            fallback={<Separator />}
          >
            <AsyncContent
              queries={{
                entriesQuery,
                rankQuery,
                serverConfigurationQuery,
              }}
              alwaysShowContent
              errorClass="rounded bg-sub-alt p-4"
            >
              {({
                entriesQueryData,
                rankQueryData,
                serverConfigurationQueryData,
              }) => {
                const minWpm = () => {
                  const d = entriesQueryData();
                  return d && "minWpm" in d ? (d.minWpm as number) : undefined;
                };

                return (
                  <UserRank
                    type={getSelection().type === "weekly" ? "xp" : "speed"}
                    data={rankQueryData()}
                    total={entriesQueryData()?.count}
                    minWpm={minWpm()}
                    memoryDifference={getLbMemoryDifference(
                      getSelection(),
                      rankQueryData()?.rank,
                    )}
                    isLbOptOut={getSnapshot()?.lbOptOut ?? false}
                    isBanned={getSnapshot()?.banned ?? false}
                    minTimeTyping={
                      serverConfigurationQueryData()?.leaderboards
                        .minTimeTyping ?? 0
                    }
                    userTimeTyping={
                      selectedAccount()?.typingStats.timeTyping ?? 0
                    }
                  />
                );
              }}
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
                <div
                  class={cn(
                    "mb-2 grid grid-cols-1 items-center justify-between gap-2 text-sm sm:grid-cols-2 sm:text-base",
                  )}
                >
                  <NextUpdate type={getSelection().type} />
                  <Navigation
                    isLoading={
                      entriesQuery.isLoading ||
                      entriesQuery.isFetching ||
                      entriesQuery.isRefetching
                    }
                    lastPage={Math.ceil(
                      (entriesQueryData()?.count ?? 0) / pageSize,
                    )}
                    userPage={userPage()}
                    currentPage={getPage()}
                    onPageChange={setPage}
                    onScrollToUser={setScrollToUser}
                    class="w-full sm:w-max"
                  />
                </div>

                <div class="overflow-x-auto">
                  <Table
                    type={getSelection().type === "weekly" ? "xp" : "speed"}
                    entries={entriesQueryData()?.entries ?? []}
                    scrollToUser={scrollToUser}
                    onScrolledToUser={() => setScrollToUser(false)}
                  />
                </div>

                <div class="mt-4 grid grid-cols-1 items-center justify-between text-sm sm:text-base">
                  <Navigation
                    lastPage={Math.ceil(
                      (entriesQueryData()?.count ?? 0) / pageSize,
                    )}
                    currentPage={getPage()}
                    onPageChange={(page) => {
                      setPage(page);
                      window.scrollTo({ top: 0, behavior: "smooth" });
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
    </Page>
  );
}
