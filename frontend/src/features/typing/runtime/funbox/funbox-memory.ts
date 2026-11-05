import { createAppOwned } from "../../../../app/application";
import { Config, ConfigKey, ConfigValue } from "@caret/schemas/configs";

import { setConfig } from "../../../../ts/config/setters";

type SetFunction<T> = (param: T, nosave?: boolean) => boolean;

type ValueAndSetFunction<T> = {
  value: T;
  setFunction: SetFunction<T>;
};

type SettingsMemory<T> = Record<string, ValueAndSetFunction<T>>;

const settingsMemory = createAppOwned<SettingsMemory<ConfigValue>>(() => ({}));

export function save<T extends ConfigKey>(
  settingName: T,
  value: Config[T],
): void {
  settingsMemory()[settingName] ??= {
    value,
    setFunction: (param, noSave?) =>
      setConfig(settingName, param as Config[T], {
        nosave: noSave ?? false,
      }),
  };
}

export function load(): void {
  Object.keys(settingsMemory()).forEach((setting) => {
    const memory = settingsMemory()[
      setting
    ] as ValueAndSetFunction<ConfigValue>;
    memory.setFunction(memory.value, true);
  });
  for (const key of Object.keys(settingsMemory())) {
    Reflect.deleteProperty(settingsMemory(), key);
  }
}
