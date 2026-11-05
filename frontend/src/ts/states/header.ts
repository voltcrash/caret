import { createAccountSignal } from "../../app/state";
import { captureAccount } from "../../app/account-scope";

import { createEvent } from "../hooks/createEvent";
import { XpBreakdown } from "@caret/schemas/results";

export type XpBarData = {
  addedXp: number;
  resultingXp: number;
  breakdown?: XpBreakdown;
};

export const [getAnimatedLevel, setAnimatedLevel] = createAccountSignal(0);
const [pendingWork, setPendingWork] = createAccountSignal(0);
export const getAccountButtonSpinner = (): boolean => pendingWork() > 0;
export async function trackAccountWork<T>(work: () => Promise<T>): Promise<T> {
  const lease = captureAccount();
  setPendingWork((count) => count + 1);
  try {
    return await work();
  } finally {
    if (lease.isCurrent()) setPendingWork((count) => count - 1);
  }
}
export const [getXpBarData, setXpBarData] =
  createAccountSignal<XpBarData | null>(null);

export const skipBreakdownEvent = createEvent();
