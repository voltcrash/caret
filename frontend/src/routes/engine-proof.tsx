import { ClientOnly, createFileRoute, notFound } from "@tanstack/solid-router";
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
  beforeLoad: () => {
    if (import.meta.env.CARET_ENGINE_PROOF) return;
    // oxlint-disable-next-line typescript/only-throw-error -- Router's not-found control signal is intentionally not an Error.
    throw notFound();
  },
  component: EngineProof,
});
