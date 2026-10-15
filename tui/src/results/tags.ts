import { z } from "zod";
import { createSignal } from "solid-js";
import { readJson, writeJson } from "../storage/json";

export type ActiveTags = {
  active: () => string[];
  set: (ids: readonly string[]) => void;
  toggle: (id: string) => void;
  flush: () => Promise<void>;
};

/** Selection is local and bound to server + account; results snapshot it at start. */
export async function openActiveTags(
  file: string,
  owner: () => string | undefined,
): Promise<ActiveTags> {
  const stored = await readJson(
    file,
    z.record(z.string(), z.array(z.string())),
  );
  const [selections, setSelections] = createSignal<Record<string, string[]>>(
    stored.status === "ok" ? stored.value : {},
  );
  let pending = Promise.resolve();
  const active = (): string[] => {
    const key = owner();
    return key === undefined ? [] : (selections()[key] ?? []);
  };
  const set = (ids: readonly string[]): void => {
    const key = owner();
    if (key === undefined) return;
    const snapshot = { ...selections(), [key]: [...new Set(ids)] };
    setSelections(snapshot);
    const save = async (): Promise<void> => writeJson(file, snapshot);
    pending = pending.then(save, save);
    void pending.catch(() => undefined);
  };
  return {
    active,
    set,
    toggle: (id) =>
      set(
        active().includes(id)
          ? active().filter((it) => it !== id)
          : [...active(), id],
      ),
    flush: async () => pending,
  };
}
