import * as ConfigSchemas from "@oxytype/schemas/configs";

import { Validation } from "../../types/validation";

//TODO: remove display property and instead use optionsMetadata from configMetadata
// eventually this file should be fully merged into config metadata, probably under the 'commandline' property

type ConfigKeysWithoutCommands =
  | "minWpmCustomSpeed"
  | "minAccCustom"
  | "minBurstCustomSpeed"
  | "accountChart"
  | "customThemeColors"
  | "favThemes"
  | "paceCaretCustomSpeed"
  | "autoSwitchTheme"
  | "themeLight"
  | "themeDark"
  | "burstHeatmap"
  | "commandPaletteHotkey" //recorded via the settings page
  | "monkey";

type SkippedConfigKeys =
  | "minBurst" //this is skipped for now because it has 2 nested inputs;
  | "customBackgroundFilter" //this is skipped for now because it has 4 nested inputs;
  | "theme" //themes are sorted by color and also affected by config.favThemes
  | "funbox";

//is using a special non schema command at the top to clear funboxes

export type CommandlineConfigMetadataObject = {
  [
    K in keyof Omit<
      ConfigSchemas.Config,
      ConfigKeysWithoutCommands | SkippedConfigKeys
    >
  ]: CommandlineConfigMetadata<K, any>; // oxlint-disable-line typescript/no-explicit-any
};

export type InputProps<T extends keyof ConfigSchemas.Config> = {
  alias?: string;
  display?: string;
  afterExec?: (value: ConfigSchemas.Config[T]) => void;
  defaultValue?: () => string;
  /**
   * default value for missing validation is `{schema:true}`
   */
  validation?: Omit<Validation<ConfigSchemas.Config[T]>, "schema"> & {
    schema?: true;
  };
  hover?: () => void;
  configValue?: ConfigSchemas.Config[T];
  inputValueConvert: ConfigSchemas.Config[T] extends string
    ? ((val: string) => string) | undefined
    : (val: string) => ConfigSchemas.Config[T];
};

type SecondaryInputProps<T extends keyof ConfigSchemas.Config> = {
  secondKey: T;
} & InputProps<T>;

export type CommandlineConfigMetadata<
  T extends keyof ConfigSchemas.Config,
  T2 extends keyof ConfigSchemas.Config,
> = {
  alias?: string;
  display?: string;
  isVisible?: boolean;
  input?: InputProps<T> | SecondaryInputProps<T2> | Record<never, never>;
  subgroup?: SubgroupProps<T>;
};

export type SubgroupProps<T extends keyof ConfigSchemas.Config> = {
  alias?: (value: ConfigSchemas.Config[T]) => string;
  display?: (value: ConfigSchemas.Config[T]) => string;
  configValueMode?: (value: ConfigSchemas.Config[T]) => "include" | undefined;
  isVisible?: (value: ConfigSchemas.Config[T]) => boolean;
  isAvailable?: (value: ConfigSchemas.Config[T]) => (() => boolean) | undefined;
  customData?: (
    value: ConfigSchemas.Config[T],
  ) => Record<string, string | boolean>;
  hover?: (value: ConfigSchemas.Config[T]) => void;
  afterExec?: (value: ConfigSchemas.Config[T]) => void;
  options: "fromSchema" | ConfigSchemas.Config[T][];
};
