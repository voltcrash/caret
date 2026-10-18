import { createAppSignal } from "../../app/state";

import { showModal } from "./modals";

export type EditPresetData = {
  presetId: string;
  name: string;
};

const [editPresetData, setEditPresetData] =
  createAppSignal<EditPresetData | null>(null);

export { editPresetData };

export function showEditPresetModal(data: EditPresetData): void {
  setEditPresetData(data);
  showModal("EditPresetModal");
}
