import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  JSXElement,
  onCleanup,
  Show,
} from "solid-js";

import { cn } from "../../utils/cn";
import { Fa } from "../common/Fa";

type SelectOption = { value: string; text: string; disabled?: boolean };
export type SelectOptionGroup = { label: string; options: SelectOption[] };

export type SelectProps = {
  label: string;
  options?: SelectOption[];
  optionGroups?: SelectOptionGroup[];
  values?: string[];
  disabled?: boolean;
  settings?: {
    showSearch?: boolean;
    placeholderText?: string;
    allowDeselect?: boolean;
    closeOnSelect?: boolean;
    minSelected?: number;
    maxValuesShown?: number;
    addAllOption?: boolean;
    scrollToTop?: boolean;
  };
} & (
  | {
      multiple?: never;
      selected?: string;
      onChange?: (value: string | undefined) => void;
    }
  | {
      multiple: true;
      selected?: string[];
      onChange?: (values: string[]) => void;
    }
);

function Select(props: SelectProps): JSXElement {
  const id = createUniqueId();
  let container: HTMLDivElement | undefined;
  let input: HTMLInputElement | undefined;
  let list: HTMLDivElement | undefined;
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [active, setActive] = createSignal(0);
  const [localValues, setLocalValues] = createSignal<string[]>([]);
  const options = createMemo<(SelectOption & { group: string | undefined })[]>(
    () =>
      props.optionGroups?.flatMap((group) =>
        group.options.map((option) => ({ ...option, group: group.label })),
      ) ??
      (
        props.options ??
        props.values?.map((value) => ({ value, text: value })) ??
        []
      ).map((option) => ({ ...option, group: undefined })),
  );
  const selected = createMemo(() =>
    props.multiple
      ? (props.selected ?? localValues())
      : props.selected !== undefined
        ? [props.selected]
        : localValues().length
          ? localValues()
          : [options()[0]?.value ?? ""],
  );
  const allValues = createMemo(() =>
    options()
      .filter((option) => !option.disabled)
      .map((option) => option.value),
  );
  const allSelected = createMemo(
    () =>
      allValues().length > 0 &&
      allValues().every((value) => selected().includes(value)),
  );
  const filtered = createMemo(() => {
    const search = query().trim().toLocaleLowerCase();
    const matches = options().filter(
      (option) =>
        !option.disabled &&
        `${option.text} ${option.group ?? ""}`
          .toLocaleLowerCase()
          .includes(search),
    );
    return props.multiple && props.settings?.addAllOption && search === ""
      ? [
          { value: "", text: "all", group: undefined, all: true },
          ...matches.map((option) => ({ ...option, all: false })),
        ]
      : matches.map((option) => ({ ...option, all: false }));
  });
  const summary = createMemo(() => {
    if (props.multiple && props.settings?.addAllOption && allSelected()) {
      return "all";
    }
    if (selected().length > (props.settings?.maxValuesShown ?? Infinity)) {
      return `${selected().length} selected`;
    }
    return options()
      .filter((option) => selected().includes(option.value))
      .map((option) => option.text)
      .join(", ");
  });
  const close = (): void => {
    setOpen(false);
    setQuery("");
  };
  const blur = (event: FocusEvent): void => {
    if (
      !(event.relatedTarget instanceof Node) ||
      !container?.contains(event.relatedTarget)
    ) {
      close();
    }
  };
  const show = (): void => {
    if (props.disabled) return;
    setQuery("");
    setActive(
      Math.max(
        0,
        filtered().findIndex((option) => selected().includes(option.value)),
      ),
    );
    setOpen(true);
  };
  const change = (values: string[]): void => {
    setLocalValues(values);
    if (props.multiple) props.onChange?.(values);
    else props.onChange?.(values[0]);
  };
  const choose = (index: number): void => {
    const option = filtered()[index];
    if (!option || props.disabled) return;
    if (props.multiple) {
      const removing = option.all
        ? allSelected()
        : selected().includes(option.value);
      const next = option.all
        ? removing
          ? []
          : allValues()
        : removing
          ? selected().filter((value) => value !== option.value)
          : [...selected(), option.value];
      if (removing && next.length < (props.settings?.minSelected ?? 0)) return;
      change(next);
    } else {
      change([option.value]);
    }
    if (props.settings?.closeOnSelect ?? !props.multiple) close();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && open()) {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      close();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!open()) {
        show();
        return;
      }
      const count = filtered().length;
      if (count === 0) return;
      setActive(
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? count - 1
            : (active() + (event.key === "ArrowDown" ? 1 : -1) + count) % count,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (open()) choose(active());
      else show();
    }
  };
  createEffect(() => {
    if (props.disabled) close();
  });
  createEffect(() => {
    query();
    options();
    setActive(0);
  });
  createEffect(() => {
    if (!open()) return;
    const outside = (event: PointerEvent): void => {
      if (event.target instanceof Node && !container?.contains(event.target)) {
        close();
      }
    };
    document.addEventListener("pointerdown", outside);
    onCleanup(() => document.removeEventListener("pointerdown", outside));
  });
  createEffect(() => {
    if (open()) {
      list?.children.item(active())?.scrollIntoView?.({ block: "nearest" });
    }
  });

  const controlClass =
    "min-h-[2.25em] w-full rounded border-none bg-sub-alt p-2 text-text outline-none focus-visible:shadow-control-focus disabled:opacity-50 pointer-coarse:min-h-11";
  return (
    <Show
      when={props.multiple === true || props.settings?.showSearch !== false}
      fallback={
        <select
          aria-label={props.label}
          class={cn(controlClass)}
          disabled={props.disabled}
          value={selected()[0] ?? ""}
          onChange={(event) => change([event.currentTarget.value])}
        >
          <For each={options()}>
            {(option) => (
              <option value={option.value} disabled={option.disabled}>
                {option.text}
              </option>
            )}
          </For>
        </select>
      }
    >
      <div ref={(element) => (container = element)} class="relative min-w-0">
        <div class="relative">
          <input
            ref={(element) => (input = element)}
            role="combobox"
            aria-label={props.label}
            aria-expanded={open()}
            aria-controls={open() ? `${id}-list` : undefined}
            aria-autocomplete="list"
            aria-activedescendant={
              open() && filtered()[active()]
                ? `${id}-option-${active()}`
                : undefined
            }
            class={cn(controlClass, "pr-10")}
            disabled={props.disabled}
            autocomplete="off"
            placeholder={props.settings?.placeholderText ?? "Select..."}
            value={open() ? query() : summary()}
            onFocus={() => {
              if (!open()) show();
            }}
            onBlur={blur}
            onClick={() => {
              if (!open()) show();
            }}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            class="absolute inset-y-0 right-0 w-9 rounded text-sub outline-none hover:text-text focus-visible:shadow-control-focus"
            tabIndex={-1}
            aria-label={`Open ${props.label}`}
            onBlur={blur}
            disabled={props.disabled}
            onClick={() => {
              if (open()) {
                close();
              } else {
                show();
                input?.focus();
              }
            }}
          >
            <Fa icon="fa-chevron-down" />
          </button>
        </div>
        <Show
          when={
            props.multiple &&
            props.settings?.allowDeselect &&
            selected().length > (props.settings?.minSelected ?? 0)
          }
        >
          <button
            type="button"
            class="mt-1 rounded p-1 text-xs text-sub outline-none hover:text-text focus-visible:shadow-control-focus"
            aria-label={`Clear ${props.label}`}
            onBlur={blur}
            disabled={props.disabled}
            onClick={() =>
              change(selected().slice(0, props.settings?.minSelected ?? 0))
            }
          >
            clear
          </button>
        </Show>
        <Show when={open()}>
          <div
            ref={(element) => (list = element)}
            id={`${id}-list`}
            role="listbox"
            aria-label={props.label}
            aria-multiselectable={props.multiple ? true : undefined}
            class="absolute top-full left-0 z-50 mt-1 max-h-64 w-full overflow-y-auto overscroll-contain rounded bg-sub-alt p-1 shadow-control-focus"
          >
            <For each={filtered()}>
              {(option, index) => (
                <div
                  id={`${id}-option-${index()}`}
                  role="option"
                  aria-selected={
                    option.all
                      ? allSelected()
                      : selected().includes(option.value)
                  }
                  class={cn(
                    "flex cursor-pointer items-center justify-between gap-2 rounded p-2 pointer-coarse:min-h-11",
                    (option.all
                      ? allSelected()
                      : selected().includes(option.value)) && "bg-main text-bg",
                    index() === active() && "bg-text text-bg",
                  )}
                  onPointerMove={() => setActive(index())}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(index())}
                >
                  <span>
                    <Show when={option.group}>
                      <span class="mr-2 text-xs opacity-60">
                        {option.group}
                      </span>
                    </Show>
                    {option.text}
                  </span>
                  <Show
                    when={
                      option.all
                        ? allSelected()
                        : selected().includes(option.value)
                    }
                  >
                    <Fa icon="fa-check" />
                  </Show>
                </div>
              )}
            </For>
            <Show when={filtered().length === 0}>
              <div class="p-2 text-sub">No options found</div>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
}

export default Select;
