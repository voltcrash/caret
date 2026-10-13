import type { Config } from "@oxytype/schemas/configs";

import {
  getOptionSearchKeywords,
  getVisibleOptions,
  sharedConfigMetadata,
} from "@oxytype/typing-core/config/metadata";
import { getDefaultConfig } from "@oxytype/typing-core/config/default-config";
import { isDeepStrictEqual } from "node:util";

import type { ConfigStore } from "../config/store";
import type { Palette } from "../palette/palette";
import type { Command } from "../palette/types";

import { isWebOnly } from "../config/support";
import {
  configCommand,
  optionLabel,
  type ConfigCommandSpec,
} from "../palette/config-commands";

type Key = keyof Config;

type Choice = { label: string; active: boolean; select: () => void };

export type SettingRow = {
  id: string;
  title: string;
  description?: string;
  /** Extra search terms, e.g. option labels. */
  keywords?: string;
  /** Inline options; left/right cycles them. */
  choices?: () => Choice[];
  /** Current value, or extra detail beside inline options. */
  value?: () => string | undefined;
  /** Enter: opens a picker or input, or runs an action. */
  activate?: () => void;
  /** Settings restored by reset. */
  resetKeys?: Key[];
  /** e.g. "web only". */
  note?: string;
  available?: () => boolean;
};

type SettingGroup = {
  title: string;
  rows: SettingRow[];
  available?: () => boolean;
};

export type SettingSection = {
  id: string;
  title: string;
  groups: SettingGroup[];
  available?: () => boolean;
};

export type RowContext = {
  store: ConfigStore;
  palette?: Palette;
};

function settingTitle(key: Key): string {
  return sharedConfigMetadata[key].displayString ?? key;
}

/** Opens a command's list or input in the palette. */
export function openCommand(context: RowContext, command: Command): void {
  if (command.subgroup !== undefined) {
    context.palette?.open({ group: command.subgroup() });
  } else if (command.input !== undefined) {
    context.palette?.open({ command });
  } else {
    void command.exec?.();
  }
}

const defaults = getDefaultConfig();

export function isDefault(store: ConfigStore, keys: Key[]): boolean {
  return keys.every((key) =>
    isDeepStrictEqual(store.config[key], defaults[key]),
  );
}

/**
 * A setting row like the web's automatic settings: up to `inlineMax`
 * options inline, otherwise a picker; an `input` adds a custom value.
 */
export function configRow<K extends Key>(
  context: RowContext,
  key: K,
  spec: ConfigCommandSpec<K> & {
    title?: string;
    inlineMax?: number;
    /** Shown after the options, e.g. the custom speed. */
    detail?: () => string | undefined;
    /** Replaces the current value text of a picker or input row. */
    value?: () => string;
    resetKeys?: Key[];
  } = {},
): SettingRow {
  const { store } = context;
  const metadata = sharedConfigMetadata[key];
  const options = spec.options ?? getVisibleOptions(key) ?? [];
  const label = (value: Config[K]): string =>
    spec.optionDisplay?.(value) ?? optionLabel(key, value);
  // Inline options must fit beside the title on an 80-column terminal.
  const inline =
    options.length > 0 &&
    options.length <= (spec.inlineMax ?? 6) &&
    options.reduce((width, option) => width + label(option).length + 3, 0) <=
      46;
  const command = (): Command => configCommand(store, key, spec);
  const inputCommand = (): Command | undefined => {
    const built = command();
    if (built.input !== undefined) return built;
    return built.subgroup?.().list.find((it) => it.input !== undefined);
  };
  const current = (): string => {
    const value = store.config[key];
    const match = options.find((option) => isDeepStrictEqual(option, value));
    const text =
      match !== undefined
        ? label(match)
        : Array.isArray(value)
          ? value.join(" ") || "none"
          : String(value);
    const detail = spec.detail?.();
    return detail === undefined ? text : `${text} (${detail})`;
  };
  return {
    id: key,
    title: spec.title ?? settingTitle(key),
    description: metadata.description,
    keywords: getOptionSearchKeywords(key),
    note: spec.note ?? (isWebOnly(key) ? "web only" : undefined),
    available: spec.available,
    resetKeys: spec.resetKeys ?? [key],
    ...(inline
      ? {
          choices: () =>
            options.map((option) => ({
              label: label(option),
              active: isDeepStrictEqual(store.config[key], option),
              select: () => {
                store.set(key, option);
              },
            })),
          ...(spec.input === undefined
            ? {}
            : {
                value: spec.detail,
                activate: () => {
                  const input = inputCommand();
                  if (input !== undefined) openCommand(context, input);
                },
              }),
        }
      : {
          value: spec.value ?? current,
          activate: () => {
            const built = command();
            openCommand(context, built);
          },
        }),
  };
}
