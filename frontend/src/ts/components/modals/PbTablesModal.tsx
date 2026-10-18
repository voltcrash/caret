import { Mode2, Mode, PersonalBest } from "@oxytype/schemas/shared";
import { format as formatDate } from "date-fns/format";
import { createMemo, createSignal, JSXElement } from "solid-js";

import { getConfig } from "../../config/store";
import * as DB from "../../db";
import { pbTablesMode, pbTablesBests } from "../../states/pb-tables-modal";
import { cn } from "../../utils/cn";
import { Formatting } from "../../utils/format";
import { getLanguageDisplayString } from "../../utils/strings";
import { AnimatedModal } from "../common/AnimatedModal";
import { Fa } from "../common/Fa";
import { DataTable, DataTableColumnDef } from "../ui/table/DataTable";
import { createDataTableColumnHelper as createColumnHelper } from "../ui/table/features";

type PBWithMode2 = PersonalBest & {
  mode2: Mode2<Mode>;
};

type PBRow = PBWithMode2 & {
  isGroupStart: boolean;
};

function buildRows(mode: Mode): PBRow[] {
  const allmode2 = (pbTablesBests() ?? DB.getSnapshot()?.personalBests)?.[
    mode
  ] as Record<Mode2<Mode>, PBWithMode2[]> | undefined;
  if (allmode2 === undefined) return [];

  const list: PBWithMode2[] = [];
  Object.keys(allmode2).forEach((key) => {
    let pbs = allmode2[key] ?? [];
    pbs = [...pbs].sort((a, b) => b.wpm - a.wpm);
    pbs.forEach((pb) => {
      list.push({ ...pb, mode2: key });
    });
  });

  const rows: PBRow[] = [];
  let currentMode2: Mode2<Mode> | undefined;

  list.forEach((pb) => {
    const isGroupStart = currentMode2 !== pb.mode2;
    currentMode2 = pb.mode2;
    rows.push({ ...pb, isGroupStart });
  });

  return rows;
}

function getColumns(options: {
  format: Formatting;
  mode: Mode;
}): DataTableColumnDef<PBRow>[] {
  const defineColumn = createColumnHelper<PBRow>().accessor;
  const { format: f, mode: m } = options;

  const columns = [
    defineColumn("mode2", {
      header: m,
      cell: (info) => info.getValue(),
      meta: {
        align: "right",
        cellMeta: (info) => ({
          class: cn(
            "text-xl font-light text-text/40",
            info.row.isGroupStart && "font-normal text-text",
          ),
        }),
      },
    }),
    defineColumn("wpm", {
      header: () => (
        <>
          {f.typingSpeedUnit}
          <br />
          <span class="text-sub">accuracy</span>
        </>
      ),
      cell: (info) => (
        <>
          {f.typingSpeed(info.getValue())}
          <br />
          <span class="text-sub">{f.accuracy(info.row.original.acc)}</span>
        </>
      ),
      meta: { align: "right" },
    }),
    defineColumn("raw", {
      header: () => (
        <>
          raw
          <br />
          <span class="text-sub">consistency</span>
        </>
      ),
      cell: (info) => (
        <>
          {f.typingSpeed(info.getValue())}
          <br />
          <span class="text-sub">
            {f.percentage(info.row.original.consistency)}
          </span>
        </>
      ),
      meta: { align: "right" },
    }),
    defineColumn("difficulty", {
      header: "difficulty",
      cell: (info) => info.getValue(),
      meta: { align: "right" },
    }),
    defineColumn("language", {
      header: "language",
      cell: (info) => {
        const lang = info.getValue();
        return lang ? getLanguageDisplayString(lang) : "-";
      },
      meta: { align: "right" },
    }),
    defineColumn("punctuation", {
      header: "punctuation",
      cell: (info) => (info.getValue() ? <Fa icon="fa-check" /> : null),
      meta: { align: "center" },
    }),
    defineColumn("numbers", {
      header: "numbers",
      cell: (info) => (info.getValue() ? <Fa icon="fa-check" /> : null),
      meta: { align: "center" },
    }),
    defineColumn("lazyMode", {
      header: "lazy mode",
      cell: (info) => (info.getValue() ? <Fa icon="fa-check" /> : null),
      meta: { align: "center" },
    }),
    defineColumn("timestamp", {
      header: "date",
      cell: (info) =>
        info.getValue() ? (
          <>
            {formatDate(info.getValue(), "dd MMM yyyy")}
            <br />
            <div class="text-sub">{formatDate(info.getValue(), "HH:mm")}</div>
          </>
        ) : (
          <>
            -<br />
            <span class="text-sub">-</span>
          </>
        ),
      meta: { align: "right" },
    }),
  ];

  return columns.map((it) => ({ ...it, enableSorting: false }));
}

export function PbTablesModal(): JSXElement {
  const [rows, setRows] = createSignal<PBRow[]>([]);
  const columns = createMemo(() =>
    getColumns({ format: new Formatting(getConfig), mode: pbTablesMode() }),
  );

  return (
    <AnimatedModal
      id="PbTables"
      title="personal bests"
      modalClass="max-w-full gap-0 p-4 sm:p-8"
      beforeShow={() => {
        setRows(buildRows(pbTablesMode()));
      }}
    >
      <div class="overflow-x-auto sm:overflow-visible">
        <DataTable
          id="pbTables"
          columns={columns()}
          data={rows()}
          class="[&>thead]:sticky [&>thead]:-top-8 [&>thead]:z-3 [&>thead]:bg-bg [&>thead]:text-xs"
        />
      </div>
    </AnimatedModal>
  );
}
