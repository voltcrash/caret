import { createAccountSignal, createAppSignal } from "../../app/state";

import { createEvent } from "../hooks/createEvent";
import { XpBreakdown } from "@oxytype/schemas/results";

export type XpBarData = {
  addedXp: number;
  resultingXp: number;
  breakdown?: XpBreakdown;
};

export const [getAnimatedLevel, setAnimatedLevel] = createAccountSignal(0);
export const [getAccountButtonSpinner, setAccountButtonSpinner] =
  createAppSignal(false);
export const [getXpBarData, setXpBarData] =
  createAccountSignal<XpBarData | null>(null);

export const skipBreakdownEvent = createEvent();
