import { createAppSignal } from "#app/state.ts";

import { showModal } from "#shared/states/modals.ts";

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
