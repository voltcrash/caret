import { lazy, type Component } from "solid-js";

import type { ModalId } from "../ts/states/modals";
import { createAppSignal } from "./state";

/** Host slots where features contribute lazy modals. */
export type ModalSlot = "app" | "dev";

export type LazyModal = {
  id: ModalId;
  Component: ReturnType<typeof lazy<Component>>;
};

export function lazyModal(
  id: ModalId,
  load: () => Promise<Component>,
): LazyModal {
  return { id, Component: lazy(async () => ({ default: await load() })) };
}

type ModalContribution = {
  slot: ModalSlot;
  modals: readonly LazyModal[];
};

const [contributions, setContributions] = createAppSignal<
  readonly ModalContribution[]
>([]);

/** Registers lazy modals in a host slot until the returned release runs. */
export function registerModals(
  slot: ModalSlot,
  modals: readonly LazyModal[],
): () => void {
  const contribution: ModalContribution = { slot, modals };
  setContributions((current) => [...current, contribution]);
  return () => {
    setContributions((current) =>
      current.filter((item) => item !== contribution),
    );
  };
}

/** Reactive list of lazy modals currently registered for a host slot. */
export function contributedModals(slot: ModalSlot): readonly LazyModal[] {
  return contributions().flatMap((contribution) =>
    contribution.slot === slot ? contribution.modals : [],
  );
}
