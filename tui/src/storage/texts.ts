import { z } from "zod/v3";
import {
  CustomTextSettingsSchema,
  type CustomTextSettings,
} from "@oxytype/schemas/results";
import { defaultCustomTextSettings } from "@oxytype/typing-core/custom-text";
import { createSignal } from "solid-js";
import { readJson, writeJson } from "./json";

const savedTextSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(64),
  settings: CustomTextSettingsSchema,
});
const librarySchema = z.object({
  current: CustomTextSettingsSchema,
  texts: z.array(savedTextSchema),
});
type SavedText = z.infer<typeof savedTextSchema>;
export type TextLibrary = {
  current: () => CustomTextSettings;
  texts: () => SavedText[];
  setCurrent: (settings: CustomTextSettings) => void;
  save: (name: string, settings: CustomTextSettings, id?: string) => void;
  remove: (id: string) => void;
  flush: () => Promise<void>;
};
export function createTextLibrary(
  initial: z.infer<typeof librarySchema> = {
    current: defaultCustomTextSettings,
    texts: [],
  },
  file?: string,
): TextLibrary {
  const [state, setState] = createSignal(structuredClone(initial));
  let pending = Promise.resolve();
  const saveState = (next: z.infer<typeof librarySchema>): void => {
    const snapshot = librarySchema.parse(next);
    setState(snapshot);
    if (file === undefined) return;
    const write = async (): Promise<void> => writeJson(file, snapshot);
    pending = pending.then(write, write);
    void pending.catch(() => undefined);
  };
  return {
    current: () => state().current,
    texts: () => state().texts,
    flush: async () => pending,
    setCurrent: (settings) =>
      saveState({ ...state(), current: structuredClone(settings) }),
    save: (name, settings, id = crypto.randomUUID()) =>
      saveState({
        ...state(),
        texts: [
          ...state().texts.filter((it) => it.id !== id),
          { id, name, settings: structuredClone(settings) },
        ],
      }),
    remove: (id) =>
      saveState({
        ...state(),
        texts: state().texts.filter((it) => it.id !== id),
      }),
  };
}
export async function openTextLibrary(file: string): Promise<TextLibrary> {
  const stored = await readJson(file, librarySchema);
  return createTextLibrary(
    stored.status === "ok" ? stored.value : undefined,
    file,
  );
}
