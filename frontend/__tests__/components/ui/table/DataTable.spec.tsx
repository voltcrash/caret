import type { CellContext } from "@tanstack/solid-table";

import { render, screen, fireEvent } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

import {
  DataTable,
  type DataTableColumnDef,
} from "../../../../src/ts/components/ui/table/DataTable";
import { dataTableFeatures } from "../../../../src/ts/components/ui/table/features";

const [localStorage, setLocalStorage] = createSignal([]);
vi.mock("../../../../src/ts/hooks/useLocalStorage", () => {
  return {
    useLocalStorage: () => {
      return [localStorage, setLocalStorage] as const;
    },
  };
});

const bpSignal = createSignal({
  xxs: true,
  sm: true,
  md: true,
});

vi.mock("../../../../src/ts/states/breakpoints", () => ({
  bp: () => bpSignal[0](),
}));

type Person = {
  name: string;
  age: number;
};

const columns: DataTableColumnDef<Person>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: "Name",
    cell: (info: CellContext<typeof dataTableFeatures, Person, string>) =>
      info.getValue(),
    meta: { maxBreakpoint: "sm" },
  },
  {
    id: "age",
    accessorKey: "age",
    header: "Age",
    cell: (info: CellContext<typeof dataTableFeatures, Person, number>) =>
      info.getValue(),
    meta: { breakpoint: "sm" },
  },
];

const data: Person[] = [
  { name: "Alice", age: 30 },
  { name: "Bob", age: 20 },
];

describe("DataTable", () => {
  beforeEach(() => {
    setLocalStorage([]);
    bpSignal[1]({
      xxs: true,
      sm: true,
      md: true,
    });
  });

  it("renders table headers and rows", () => {
    render(() => <DataTable id="people" columns={columns} data={data} />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Age")).toBeInTheDocument();

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("renders fallback when there is no data", () => {
    render(() => (
      <DataTable
        id="empty"
        columns={columns}
        data={[]}
        fallback={<div>No data</div>}
      />
    ));

    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("sorts rows when clicking a sortable header", async () => {
    render(() => <DataTable id="sorting" columns={columns} data={data} />);

    const ageHeaderButton = screen.getByRole("button", { name: "Age" });
    const ageHeaderCell = ageHeaderButton.closest("th");

    // Initial
    expect(ageHeaderCell).toHaveAttribute("aria-sort", "none");
    expect(ageHeaderCell?.querySelector(".fa-fw")).toHaveClass("fa-fw");

    // Descending
    fireEvent.click(ageHeaderButton);
    expect(ageHeaderCell).toHaveAttribute("aria-sort", "descending");
    expect(ageHeaderCell?.querySelector("i")).toHaveClass(
      "fa-sort-down",
      "fas",
      "fa-fw",
    );
    expect(localStorage()).toEqual([
      {
        desc: true,
        id: "age",
      },
    ]);

    let rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Alice"); // age 30
    expect(rows[2]).toHaveTextContent("Bob"); // age 20

    // Ascending
    fireEvent.click(ageHeaderButton);
    expect(ageHeaderCell).toHaveAttribute("aria-sort", "ascending");
    expect(ageHeaderCell?.querySelector("i")).toHaveClass(
      "fa-sort-up",
      "fas",
      "fa-fw",
    );
    expect(localStorage()).toEqual([
      {
        desc: false,
        id: "age",
      },
    ]);

    rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Bob");
    expect(rows[2]).toHaveTextContent("Alice");

    //back to initial
    fireEvent.click(ageHeaderButton);
    expect(ageHeaderCell).toHaveAttribute("aria-sort", "none");
    expect(localStorage()).toEqual([]);
  });

  it("hides columns based on breakpoint visibility", () => {
    bpSignal[1]({
      xxs: true,
      sm: false,
      md: false,
    });

    render(() => <DataTable id="breakpoints" columns={columns} data={data} />);
    const nameHeader = screen.getByRole("button", {
      name: "Name",
    }).parentElement;
    const ageHeader = screen.getByRole("button", { name: "Age" }).parentElement;

    expect(nameHeader).not.toHaveClass("hidden");
    expect(nameHeader).toHaveClass("sm:hidden");
    expect(ageHeader).toHaveClass("hidden sm:table-cell");
  });

  it("updates rows when reactive data changes", () => {
    const [people, setPeople] = createSignal(data);
    render(() => <DataTable id="reactive" columns={columns} data={people()} />);

    setPeople([{ name: "Charlie", age: 40 }]);

    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("updates the externally selected row", () => {
    const [activeRow, setActiveRow] = createSignal<string | null>("Alice");
    render(() => (
      <DataTable
        id="selected"
        columns={columns}
        data={data}
        rowSelection={{
          getRowId: (row) => row.name,
          class: "bg-main",
          activeRow,
        }}
      />
    ));

    expect(screen.getByText("Alice").closest("tr")).toHaveClass("bg-main");
    setActiveRow("Bob");
    expect(screen.getByText("Alice").closest("tr")).not.toHaveClass("bg-main");
    expect(screen.getByText("Bob").closest("tr")).toHaveClass("bg-main");
    setActiveRow(null);
    expect(screen.getByText("Bob").closest("tr")).not.toHaveClass("bg-main");
  });

  it("delegates sorting without reordering server-sorted data", () => {
    const onSortingChange = vi.fn();
    render(() => (
      <DataTable
        id="server-sorting"
        columns={columns}
        data={[...data].reverse()}
        onSortingChange={onSortingChange}
      />
    ));

    fireEvent.click(screen.getByRole("button", { name: "Age" }));

    expect(onSortingChange).toHaveBeenCalledWith([{ id: "age", desc: true }]);
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Bob");
  });
});
