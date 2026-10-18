import { getMutableConfig } from "../config/store";
import { setConfig } from "../config/setters";
import {
  ConfigMetadata,
  configMetadata,
  getCommandlineOptionLabel,
} from "../config/metadata";
import { capitalizeFirstLetter } from "../utils/strings";
import {
  commandlineConfigMetadata,
  CommandlineConfigMetadataObject,
  InputProps,
  SubgroupProps,
} from "./commandline-metadata";
import { Command } from "./types";
import * as ConfigSchemas from "@oxytype/schemas/configs";
import type { z } from "zod";
import { getOptions } from "../utils/zod";
import type { Validation } from "../types/validation";

export function buildCommandForConfigKey<
  K extends keyof CommandlineConfigMetadataObject,
>(key: K): Command {
  const configMeta = configMetadata[key];
  const commandMeta = commandlineConfigMetadata[key];
  const schema = ConfigSchemas.ConfigSchema.shape[key];

  return _buildCommandForConfigKey(key, configMeta, commandMeta, schema);
}
function _buildCommandForConfigKey<
  K extends keyof CommandlineConfigMetadataObject,
>(
  key: K,
  configMeta: ConfigMetadata<K>,
  commandMeta: CommandlineConfigMetadataObject[K] | undefined,
  schema: z.ZodType,
): Command {
  if (commandMeta === undefined || commandMeta === null) {
    throw new Error(`No commandline metadata found for config key "${key}".`);
  }

  let result: Command | undefined = undefined;

  if ("subgroup" in commandMeta && commandMeta.subgroup !== undefined) {
    result = buildCommandWithSubgroup(
      key,
      commandMeta.alias,
      commandMeta.subgroup,
      configMeta,
      schema,
    );
  }

  if ("input" in commandMeta && commandMeta.input !== undefined) {
    const inputProps = commandMeta.input;

    const inputCommand = buildInputCommand({
      key: "secondKey" in inputProps ? inputProps.secondKey : key,
      isPartOfSubgroup: "subgroup" in commandMeta,
      inputProps: inputProps as InputProps<keyof ConfigSchemas.Config>,
      configMeta: configMeta as unknown as ConfigMetadata<
        keyof ConfigSchemas.Config
      >,
      schema:
        "secondKey" in inputProps
          ? ConfigSchemas.ConfigSchema.shape[inputProps.secondKey]
          : schema,
    });

    if (result === undefined) {
      return inputCommand;
    }

    result.subgroup?.list.push(inputCommand);
  }

  if (result === undefined) {
    throw new Error(
      `Nothing returned for config key "${key}". This is a bug in the commandline metadata.`,
    );
  }
  return result;
}

function buildCommandWithSubgroup<K extends keyof ConfigSchemas.Config>(
  key: K,
  rootAlias: string | undefined,
  subgroupProps: SubgroupProps<K>,
  configMeta: ConfigMetadata<K>,
  schema: z.ZodType,
): Command {
  if (subgroupProps === null) {
    throw new Error(`No commandline metadata found for config key "${key}".`);
  }

  const display =
    configMeta.commandline?.title ??
    `${capitalizeFirstLetter(configMeta?.displayString ?? key)}...`;

  let values =
    subgroupProps.options ?? (getOptions(schema) as ConfigSchemas.Config[K][]);

  if (values === "fromSchema") {
    values = getOptions(schema) as ConfigSchemas.Config[K][];
  }

  if (values === undefined) {
    throw new Error(
      `Unsupported schema type for key "${key}": ${schema.def.type}`,
    );
  }
  const list = values.map((value) =>
    buildSubgroupCommand<K>(key, value, subgroupProps, configMeta),
  );

  list.sort((a, b) => {
    if (a.configValue === "off" || a.configValue === false) return -1;
    if (b.configValue === "off" || b.configValue === false) return 1;
    return 0;
  });

  return {
    id: `change${capitalizeFirstLetter(key)}`,
    display: display,
    icon: configMeta?.fa?.icon ?? "fa-cog",
    subgroup: {
      title: display,
      configKey: key,
      list,
    },
    alias: rootAlias,
  };
}

function buildSubgroupCommand<K extends keyof ConfigSchemas.Config>(
  key: keyof ConfigSchemas.Config,
  value: ConfigSchemas.Config[K],
  {
    afterExec,
    hover,
    alias: commandAlias,
    configValueMode: commandConfigValueMode,
    isVisible: isCommandVisible,
    isAvailable: isCommandAvailable,
    customData: commandCustomData,
  }: SubgroupProps<K>,
  configMeta: ConfigMetadata<K>,
): Command {
  const val = value;

  const displayString = getCommandlineOptionLabel(configMeta, value);

  return {
    id: `set${capitalizeFirstLetter(key)}${capitalizeFirstLetter(
      val.toString(),
    )}`,
    display: displayString,
    configValueMode: commandConfigValueMode?.(value),
    alias: commandAlias?.(value) ?? undefined,
    configValue: val,
    visible: isCommandVisible?.(value) ?? undefined,
    available: isCommandAvailable?.(value) ?? undefined,
    exec: (): void => {
      setConfig(key, val);
      afterExec?.(val);
    },
    hover:
      hover !== undefined
        ? (): void => {
            hover?.(val);
          }
        : undefined,
    customData: commandCustomData?.(val) ?? undefined,
  };
}

function buildInputCommand<K extends keyof ConfigSchemas.Config>({
  key,
  isPartOfSubgroup,
  inputProps,
  configMeta,
  schema,
}: {
  key: K;
  isPartOfSubgroup: boolean;
  inputProps?: InputProps<K>;
  configMeta: ConfigMetadata<K>;
  schema?: z.ZodType;
}): Command {
  const validation = inputProps?.validation ?? { schema: true };

  const displayString =
    configMeta.commandline?.inputTitle ??
    (isPartOfSubgroup
      ? "custom..."
      : `${capitalizeFirstLetter(configMeta.displayString ?? key)}...`);

  const result: Omit<Command, "exec"> & {
    exec: (options: { input?: ConfigSchemas.Config[K] }) => void;
    inputValueConvert?: InputProps<K>["inputValueConvert"];
    validation?: Validation<ConfigSchemas.Config[K]>;
  } = {
    id: `set${capitalizeFirstLetter(key)}Custom`,
    defaultValue:
      inputProps?.defaultValue ??
      (() => getMutableConfig()[key]?.toString() ?? ""),
    configValue:
      inputProps !== undefined && "configValue" in inputProps
        ? (inputProps.configValue ?? undefined)
        : undefined,
    display: displayString,
    alias: inputProps?.alias ?? undefined,
    input: true,
    icon: configMeta?.fa?.icon ?? "fa-cog",

    exec: ({ input }): void => {
      if (input === undefined) return;
      setConfig(key, input);
      inputProps?.afterExec?.(input);
    },
    hover: inputProps?.hover,
  };

  if (inputProps?.inputValueConvert !== undefined) {
    result.inputValueConvert = inputProps.inputValueConvert;
  }

  result.validation = {
    // schema is ConfigSchema.shape[key], which validates Config[K]
    schema:
      validation.schema === true
        ? (schema as z.ZodType<ConfigSchemas.Config[K]> | undefined)
        : undefined,
    isValid: validation.isValid,
  };

  return result as Command;
}

export const __testing = { _buildCommandForConfigKey };

export const COMMAND_SEPARATOR_HTML =
  '<i class="fas fa-fw fa-chevron-right chevronIcon"></i>';
