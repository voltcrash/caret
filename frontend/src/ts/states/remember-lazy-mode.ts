import { createSignal } from "solid-js";
import { z } from "zod";
import { LocalStorageWithSchema } from "../utils/local-storage-with-schema";

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
  let initialized = false;
  const [getValue, setValue] = createSignal(false);
  return {
    get(): boolean {
      if (!initialized) {
        initialized = true;
        setValue(storage.get());
      }
      return getValue();
    },
    set(value: boolean): void {
      if (storage.set(value)) {
        initialized = true;
        setValue(value);
      }
    },
  };
}

const remember = persistedBoolean(rememberLazyModeLS);
const arabicPref = persistedBoolean(arabicLazyModeLS);

export function getRemember(): boolean {
  return remember.get();
}

export function setRemember(value: boolean): void {
  remember.set(value);
}

export function getArabicPref(): boolean {
  return arabicPref.get();
}

export function setArabicPref(value: boolean): void {
  arabicPref.set(value);
}
