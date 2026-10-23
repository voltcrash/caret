import type {
  EventLog,
  TestEventType,
  TestEventData,
} from "@oxytype/typing-core/events/types";
import { getEngineSession } from "../session.client";
import { getActiveWordIndex } from "../../../../ts/states/test";
import { getMutableConfig } from "../../../../ts/config/store";

/** Legacy string transport is a mechanical view of the owned native session. */
export const getTestSession = getEngineSession;
export function logTestEvent(
  type: TestEventType,
  now: number,
  data: TestEventData,
): void {
  const session = getEngineSession();
  if (!session.isPrepared()) return;
  if (type === "input") {
    throw new Error("Typing input must use native session commands");
  }
  session.observe({ type, testMs: 0, data }, now);
}
export const getCurrentInput = (): string =>
  getEngineSession().getInputForWord(getActiveWordIndex());
export const getInputForWord = (index: number): string =>
  getEngineSession().getInputForWord(index);
export const cleanupData = (): void => getEngineSession().finalize();
export const forceReleaseAllKeys = (): void => getEngineSession().finalize();
export const getAllTestEvents = (): EventLog["events"] =>
  buildEventLog().events;
export const logEventsDataToTheConsoleTable = (): void => {
  console.table(getAllTestEvents());
};
export const resetTestEvents = (): void => getEngineSession().reset();
export function buildEventLog(): EventLog {
  const log = getEngineSession().buildEventLog();
  if (getMutableConfig().funbox.length === 0) {
    delete log.context.isFunboxWithNospacePropertyActive;
  }
  // Native validation/wire fixtures check the discriminants and optional flags;
  // strings preserve the existing web DTO's UTF-16 representation.
  return log as EventLog;
}
