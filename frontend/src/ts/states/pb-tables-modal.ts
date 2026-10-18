import { createAppSignal } from "../../app/state";

import { Client, Mode, PersonalBests } from "@oxytype/schemas/shared";

import { showModal } from "./modals";

const [pbTablesMode, setPbTablesMode] = createAppSignal<Mode>("time");
const [pbTablesBests, setPbTablesBests] =
  createAppSignal<Partial<PersonalBests>>();
const [pbTablesClient, setPbTablesClient] = createAppSignal<Client>("web");

export { pbTablesMode, pbTablesBests, pbTablesClient };

export function showPbTablesModal(
  mode: Mode,
  bests?: Partial<PersonalBests>,
  client: Client = "web",
): void {
  setPbTablesMode(mode);
  setPbTablesBests(bests);
  setPbTablesClient(client);
  showModal("PbTables");
}
