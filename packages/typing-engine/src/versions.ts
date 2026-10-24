import generated from "../generated/versions.json" with { type: "json" };

/** Binding, scoring-behavior and event-log versions of the built engine. */
export const versions: {
  binding: number;
  behavior: number;
  eventLog: number;
} = generated;
