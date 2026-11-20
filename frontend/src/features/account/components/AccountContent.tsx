import { Client, Mode } from "@caret/schemas/shared";
import { createMemo, createSignal, JSXElement, Show } from "solid-js";

import AsyncContent from "#shared/components/common/AsyncContent.tsx";
import { Button } from "#shared/components/common/Button.tsx";
import { SnapshotResult } from "#shared/constants/default-snapshot.ts";
import { createEffectOn } from "#shared/hooks/effects.ts";
import { useRef } from "#shared/hooks/useRef.ts";
import { isAuthenticated } from "#shared/states/core.ts";
import { hideLoaderBar, showLoaderBar } from "#shared/states/loader-bar.ts";
import { showErrorNotification } from "#shared/states/notifications.ts";
import { filters, setFilters } from "#shared/states/result-filters.ts";

import {
  createResultsQueryState,
  getResultsQueryOnce,
  useResultsLiveQuery,
} from "../../../data/collections/results";
import { downloadResultsCSV } from "../results-csv.client";
import { Charts } from "./Charts";
import { Filters } from "./Filters";
import { MyProfile } from "./MyProfile";
import { Table } from "./Table";
import { TestStats } from "./TestStats";

/** Account statistics and history for the signed-in actor; the host supplies client selection. */
export function AccountContent(props: { client: Client }): JSXElement {
  const client = (): Client => props.client;
  const [tableRef, tableElement] = useRef<HTMLTableElement>();
  const [limit, setLimit] = createSignal(10);

  const [sorting, setSorting] = createSignal<{
    field: keyof SnapshotResult<Mode>;
    direction: "asc" | "desc";
  }>({
    field: "timestamp",
    direction: "desc",
  });

  const queryState = createMemo(() => {
    if (!isAuthenticated()) return undefined;

    return createResultsQueryState(filters, client());
  });

  const [selectedResultId, setSelectedResultId] = createSignal<null | string>(
    null,
  );
  const [isExporting, setIsExporting] = createSignal(false);
  const [exportedCount, setExportedCount] = createSignal(0);
  createEffectOn(client, () => {
    setLimit(10);
    setSelectedResultId(null);
  });

  const resultsQuery = useResultsLiveQuery({
    queryState,
    sorting,
  });

  const chartResults = createMemo(() => {
    const rows = resultsQuery();
    const { field, direction } = sorting();
    return field === "timestamp" && direction === "desc"
      ? rows
      : rows.toSorted((a, b) => b.timestamp - a.timestamp);
  });

  return (
    <div class="flex flex-col gap-8">
      <MyProfile />
      <div class="grid gap-2">
        <p class="text-sub">
          Charts, filters and statistics below use the latest loaded results.
          Profile totals cover the account lifetime.
        </p>
        <Button
          text={
            isExporting()
              ? `Exporting ${exportedCount()} results…`
              : "Export full history CSV"
          }
          disabled={isExporting()}
          onClick={() => {
            setIsExporting(true);
            setExportedCount(0);
            void import("../export.client")
              .then(async ({ exportAllResults }) => {
                const results = await exportAllResults(setExportedCount);
                downloadResultsCSV(results);
              })
              .catch((error: unknown) => {
                showErrorNotification("Could not export history", { error });
              })
              .finally(() => setIsExporting(false));
          }}
        />
      </div>

      <Filters filters={filters} onChangeFilters={setFilters} />

      <Show
        when={resultsQuery()?.length > 0}
        fallback={
          <div class="grid h-150 place-items-center">
            <div>No data found. Check your filters.</div>
          </div>
        }
      >
        <>
          <Charts
            results={chartResults()}
            filters={filters}
            queryState={queryState}
            onHistoryChartClick={(id) => {
              const index = resultsQuery().findIndex((row) => row._id === id);
              if (index < 0) return;
              const newLimit = Math.ceil((index + 1) / 10) * 10;
              if (limit() < newLimit) {
                setLimit(newLimit);
              }
              setSelectedResultId(id);

              requestAnimationFrame(() => {
                tableElement()
                  ?.querySelector('tbody tr[data-state="selected"]')
                  ?.scrollIntoView({
                    block: "center",
                  });
              });
            }}
          />
          <TestStats queryState={queryState} />

          <div class="grid grid-cols-1 sm:grid-cols-3">
            <Button
              text="Export filtered loaded results CSV"
              fa={{ icon: "fa-file-csv" }}
              class="w-full sm:col-start-3"
              disabled={isExporting()}
              onClick={() => {
                setIsExporting(true);
                showLoaderBar();
                void getResultsQueryOnce({ queryState, sorting })
                  .then(
                    (results) =>
                      results !== undefined && downloadResultsCSV(results),
                  )
                  .finally(() => {
                    hideLoaderBar();
                    setIsExporting(false);
                  });
              }}
            />
          </div>

          <AsyncContent collections={{ resultsQuery }}>
            {({ resultsQueryData }) => (
              <>
                <Table
                  ref={tableRef}
                  data={resultsQueryData().slice(0, limit())}
                  onSortingChange={(val) => setSorting(val)}
                  selectedRowId={selectedResultId}
                />
                <Button
                  text="load more"
                  disabled={
                    resultsQuery.isLoading ||
                    resultsQueryData().length <= limit()
                  }
                  onClick={() => setLimit((limit) => limit + 10)}
                  class="w-full text-center"
                />
              </>
            )}
          </AsyncContent>
        </>
      </Show>
    </div>
  );
}
