import { createEvent } from "../hooks/createEvent";

export type AuthEvent =
  | { type: "snapshotUpdated"; data: { isInitial: boolean } }
  | { type: "authConfigUpdated"; data?: undefined };

export const authEvent = createEvent<AuthEvent>();
