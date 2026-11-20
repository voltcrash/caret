import { createAppOwned } from "../../../app/application";
import { createSignal } from "solid-js";
import { z } from "zod";
import { LocalStorageWithSchema } from "../../../ts/utils/local-storage-with-schema";

const rememberLazyModeLS = new LocalStorageWithSchema({
  key: "rememberLazyMode",
  schema: z.boolean(),
  fallback: false,
});

const arabicLazyModeLS = new LocalStorageWithSchema({
  key: "prefersArabicLazyMode",
  schema: z.boolean(),
  fallback: true,
});

// Keep storage reads lazy, as in the legacy module; failed writes leave state alone.
function persistedBoolean(storage: LocalStorageWithSchema<boolean>): {
  get: () => boolean;
  set: (value: boolean) => void;
} {
  const [getValue, setValue] = createSignal<boolean>();
  return {
    get(): boolean {
      return getValue() ?? setValue(storage.get());
    },
    set(value: boolean): void {
      if (storage.set(value)) {
        setValue(value);
      }
    },
  };
}

const remember = createAppOwned(() => persistedBoolean(rememberLazyModeLS));
const arabicPref = createAppOwned(() => persistedBoolean(arabicLazyModeLS));

export function getRemember(): boolean {
  return remember().get();
}

export function setRemember(value: boolean): void {
  remember().set(value);
}

export function getArabicPref(): boolean {
  return arabicPref().get();
}

export function setArabicPref(value: boolean): void {
  arabicPref().set(value);
}
