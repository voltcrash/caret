import { createAppSignal } from "../../app/state";

import { Mode, PersonalBests } from "@oxytype/schemas/shared";

import { showModal } from "./modals";

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
