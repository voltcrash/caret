import type { Config } from "@oxytype/schemas/configs";

import {
  getOptionLabel,
  getVisibleOptions,
  sharedConfigMetadata,
} from "@oxytype/typing-core/config/metadata";
import { isDeepStrictEqual } from "node:util";

import type { ConfigStore } from "../config/store";
import type { Command } from "./types";

type Key = keyof Config;

export type ConfigCommandSpec<K extends Key> = {
  display?: string;
  alias?: string;
  /** Defaults to the visible schema options. */
  options?: Config[K][];
  optionDisplay?: (value: Config[K]) => string;
  /** Array settings: an option is active when included. */
  includes?: boolean;
  optionAvailable?: (value: Config[K]) => boolean;
  input?: {
    display?: string;
    /** Sets this key instead, after setting the command's key to `value`. */
    secondKey?: Key;
    value?: Config[K];
    defaultValue?: () => string;
    convert: (input: string) => unknown;
  };
  /** Shown as a hint for settings that only affect the web client. */
  note?: string;
  available?: () => boolean;
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Option label; blank web labels (e.g. blind mode's button) read on/off. */
export function optionLabel<K extends Key>(key: K, value: Config[K]): string {
  const label = getOptionLabel(key, value);
  if (label.trim() !== "") return label;
  return value === true ? "on" : value === false ? "off" : String(value);
}

/** Setting label used by the web palette, e.g. "Quick restart...". */
function configDisplay(key: Key): string {
  return `${capitalize(sharedConfigMetadata[key].displayString ?? key)}...`;
}

/** Web-style command for one setting: a list of values and/or an input. */
export function configCommand<K extends Key>(
  store: ConfigStore,
  key: K,
  spec: ConfigCommandSpec<K> = {},
): Command {
  const display = spec.display ?? configDisplay(key);
  const setInput = (raw: string): string | undefined => {
    const input = spec.input;
    if (input === undefined) return undefined;
    const value = input.convert(raw.trim());
    if (typeof value === "number" && Number.isNaN(value)) {
      return "Enter a number";
    }
    if (input.secondKey !== undefined) {
      if (input.value !== undefined && !store.set(key, input.value)) {
        return "Setting rejected";
      }
      return store.set(input.secondKey, value as never)
        ? undefined
        : "Invalid value";
    }
    return store.set(key, value as Config[K]) ? undefined : "Invalid value";
  };
  const inputCommand = (nested: boolean): Command | undefined =>
    spec.input === undefined
      ? undefined
      : {
          id: `set${capitalize(key)}Custom`,
          display: spec.input.display ?? (nested ? "custom..." : display),
          alias: spec.alias,
          note: spec.note,
          available: spec.available,
          active:
            spec.input.value === undefined
              ? undefined
              : () => isDeepStrictEqual(store.config[key], spec.input?.value),
          input: {
            placeholder: spec.input.display ?? display,
            defaultValue:
              spec.input.defaultValue ??
              (() => String(store.config[spec.input?.secondKey ?? key])),
            submit: setInput,
          },
        };
  const options = spec.options ?? getVisibleOptions(key);
  if (options === undefined || options.length === 0) {
    const command = inputCommand(false);
    if (command === undefined) {
      throw new Error(`No palette options for setting ${key}`);
    }
    return command;
  }
  return {
    id: `change${capitalize(key)}`,
    display,
    alias: spec.alias,
    note: spec.note,
    available: spec.available,
    subgroup: () => {
      // The web lists "off" first.
      const sorted = [
        ...options.filter((value) => value === "off" || value === false),
        ...options.filter((value) => value !== "off" && value !== false),
      ];
      const list: Command[] = sorted.map((value) => ({
        id: `set${capitalize(key)}${capitalize(String(value))}`,
        display: spec.optionDisplay?.(value) ?? optionLabel(key, value),
        available:
          spec.optionAvailable === undefined
            ? undefined
            : () => spec.optionAvailable?.(value) ?? true,
        active: () =>
          spec.includes === true &&
          Array.isArray(value) &&
          Array.isArray(store.config[key])
            ? value.every((item: unknown) =>
                (store.config[key] as unknown[]).includes(item),
              )
            : isDeepStrictEqual(store.config[key], value),
        exec: () => {
          store.set(key, value);
        },
      }));
      const custom = inputCommand(true);
      return {
        title: display,
        list: custom === undefined ? list : [...list, custom],
      };
    },
  };
}
