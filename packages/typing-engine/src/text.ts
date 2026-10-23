import type { Text } from "../generated/types/Text";
import type { Event } from "../generated/types/Event";
import type { Log } from "../generated/types/Log";
import type { JsonValue } from "../generated/types/serde_json/JsonValue";

export function encodeText(value: string): Text {
  return Array.from({ length: value.length }, (_, index) =>
    value.charCodeAt(index),
  );
}
export function decodeText(units: Text): string {
  if (
    !units.every(
      (unit) => Number.isInteger(unit) && unit >= 0 && unit <= 0xffff,
    )
  ) {
    throw new RangeError("Invalid UTF-16 code unit");
  }
  let value = "";
  for (let index = 0; index < units.length; index += 4096) {
    value += String.fromCharCode(...units.slice(index, index + 4096));
  }
  return value;
}
type WebContext = Omit<
  Log["context"],
  "targetWords" | "customTextLimitMode" | "customTextLimitValue"
> & {
  targetWords: string[];
  customTextLimitMode?: string;
  customTextLimitValue?: number;
  isFunboxWithNospacePropertyActive?: boolean;
};
export type WebLog = { version: number; context: WebContext; events: Event[] };

function fields(
  data: JsonValue,
  transform: (text: JsonValue) => JsonValue,
): JsonValue {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      key === "inputValue" || key === "data" ? transform(value) : value,
    ]),
  );
}
/** Mechanical v1 wire conversion. No string ever passes through Rust String. */
export function toEngineEvent(event: Event): Event {
  return {
    ...event,
    data: fields(event.data, (value) =>
      typeof value === "string" ? encodeText(value) : value,
    ),
  };
}
export function toWebEvent(event: Event): Event {
  return {
    ...event,
    data: fields(event.data, (value) =>
      Array.isArray(value) ? decodeText(value as Text) : value,
    ),
  };
}
export function toEngineLog(log: WebLog): Log {
  return {
    ...log,
    context: {
      ...log.context,
      targetWords: log.context.targetWords.map(encodeText),
    },
    events: log.events.map(toEngineEvent),
  };
}
export function toWebLog(log: Log): WebLog {
  return {
    ...log,
    context: {
      ...log.context,
      targetWords: log.context.targetWords.map(decodeText),
    },
    events: log.events.map(toWebEvent),
  };
}
