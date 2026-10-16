import { Client, Mode } from "@oxytype/schemas/shared";
import { createMemo, createSignal, JSXElement, Show } from "solid-js";

import {
  createResultsQueryState,
  getResultsQueryOnce,
  useResultsLiveQuery,
} from "../../../collections/results";
import { SnapshotResult } from "../../../constants/default-snapshot";
import { createEffectOn } from "../../../hooks/effects";
import { useRef } from "../../../hooks/useRef";
import { isAuthenticated } from "../../../states/core";
import { hideLoaderBar, showLoaderBar } from "../../../states/loader-bar";
import { filters, setFilters } from "../../../states/result-filters";
import { downloadResultsCSV } from "../../../utils/misc";
import AsyncContent from "../../common/AsyncContent";
import { Button } from "../../common/Button";
import { ClientToggle } from "../../common/ClientToggle";
import { Charts } from "./Charts";
import { Filters } from "./Filters";
import { MyProfile } from "./MyProfile";
import { Table } from "./Table";
import { TestStats } from "./TestStats";

/** Account statistics and history for the signed-in actor; the host supplies client selection. */
export function AccountContent(props: {
  client: Client;
  onClient: (client: Client) => void;
}): JSXElement {
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
      <ClientToggle value={client()} onChange={props.onClient} />
      <MyProfile client={client()} />

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
              text="Export CSV"
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
