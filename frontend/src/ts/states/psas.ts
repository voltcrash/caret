import { createAppStore } from "../../app/state";

export type AlertPsa = {
  message: string;
  level: number;
};

const [psas, setPsas] = createAppStore<AlertPsa[]>([]);

export function addPsa(message: string, level: number): void {
  setPsas((prev) => [...prev, { message, level }]);
}

export function getPsas(): AlertPsa[] {
  return psas;
}
