import { Client, Mode } from "@caret/schemas/shared";
import { createMemo, createSignal, JSXElement, Show } from "solid-js";

import {
  createResultsQueryState,
  getResultsQueryOnce,
  useResultsLiveQuery,
} from "../../../ts/collections/results";
import AsyncContent from "../../../ts/components/common/AsyncContent";
import { Button } from "../../../ts/components/common/Button";
import { SnapshotResult } from "../../../ts/constants/default-snapshot";
import { createEffectOn } from "../../../ts/hooks/effects";
import { useRef } from "../../../ts/hooks/useRef";
import { isAuthenticated } from "../../../ts/states/core";
import { hideLoaderBar, showLoaderBar } from "../../../ts/states/loader-bar";
import { showErrorNotification } from "../../../ts/states/notifications";
import { filters, setFilters } from "../../../ts/states/result-filters";
import { downloadResultsCSV } from "../../../ts/utils/misc";
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
    limit: () => limit() + 1,
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
                await downloadResultsCSV(results);
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
            filters={filters}
            queryState={queryState}
            onHistoryChartClick={({ index, _id }) => {
              const newLimit = Math.ceil(index / 10) * 10;
              if (limit() < newLimit) {
                setLimit(newLimit);
              }
              setSelectedResultId(_id);

              requestAnimationFrame(() => {
                tableElement()
                  ?.querySelector(`tbody tr:nth-child(${index + 1})`)
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
                    async (results) =>
                      results !== undefined &&
                      (await downloadResultsCSV(results)),
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
