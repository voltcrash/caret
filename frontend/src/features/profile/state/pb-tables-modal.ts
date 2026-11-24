import { createAppSignal } from "#app/state.ts";

import { Mode, PersonalBests } from "@caret/schemas/shared";

import { showModal } from "#shared/states/modals.ts";

const [pbTablesMode, setPbTablesMode] = createAppSignal<Mode>("time");
const [pbTablesBests, setPbTablesBests] =
  createAppSignal<Partial<PersonalBests>>();

export { pbTablesMode, pbTablesBests };

export function showPbTablesModal(
  mode: Mode,
  bests?: Partial<PersonalBests>,
): void {
  setPbTablesMode(mode);
  setPbTablesBests(bests);
  showModal("PbTables");
}
