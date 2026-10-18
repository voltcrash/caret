import { reconcile } from "solid-js/store";

import { createAppStore } from "../../app/state";

export type AlertPsa = {
  message: string;
  level: number;
};

const [psas, setStore] = createAppStore<AlertPsa[]>([]);

/** Replaces the alerts list; a repeated fetch never duplicates entries. */
export function setPsas(list: AlertPsa[]): void {
  setStore(reconcile(list));
}

export function getPsas(): AlertPsa[] {
  return psas;
}
