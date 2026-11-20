import { createFileRoute } from "@tanstack/solid-router";
import { lazy } from "solid-js";

const EngineProof = import.meta.env.CARET_ENGINE_PROOF
  ? lazy(async () => await import("../testing/EngineProof"))
  : () => <p>Unavailable</p>;

export const Route = createFileRoute("/engine-proof")({
  component: EngineProof,
});
