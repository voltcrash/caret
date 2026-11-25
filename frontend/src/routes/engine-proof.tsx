import { ClientOnly, createFileRoute } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { lazy, type JSXElement } from "solid-js";

// Proof runners load browser-only engine modules; keep them out of the server graph.
const Proof = lazy(
  createClientOnlyFn(async () => import("../testing/EngineProof")),
);

function EngineProof(): JSXElement {
  return (
    <ClientOnly>
      <Proof />
    </ClientOnly>
  );
}

export const Route = createFileRoute("/engine-proof")({
  component: import.meta.env.CARET_ENGINE_PROOF
    ? EngineProof
    : () => <p>Unavailable</p>,
});
