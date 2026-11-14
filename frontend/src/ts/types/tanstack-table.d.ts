import "@tanstack/solid-table";
import type { JSX } from "solid-js";
import { BreakpointKey } from "../states/breakpoints";

declare module "@tanstack/solid-table" {
  //This needs to be an interface
  interface ColumnMeta<
    TFeatures extends TableFeatures,
    TData extends RowData,
    TValue extends CellData = CellData,
  > {
    /**
     * define minimal breakpoint for the column to be visible.
     * If not set, the column is always visible
     */
    breakpoint?: BreakpointKey;

    /**
     * define maximal breakpoint for the column to be visible.
     * If not set, the column is always visible
     */
    maxBreakpoint?: BreakpointKey;

    /**
     * align header and cells, default: `left`
     */
    align?: "left" | "right" | "center";

    /**
     * additional attributes to be set on the table cell.
     */
    cellMeta?:
      | JSX.HTMLAttributes<HTMLTableCellElement>
      | ((ctx: {
          value: TValue;
          row: TData;
        }) => JSX.HTMLAttributes<HTMLTableCellElement>);

    /**
     * additional attributes to be set on the header
     */
    headerMeta?: JSX.HTMLAttributes;

    /** extra classes for the header */
    headerClass?: string;
  }
}
