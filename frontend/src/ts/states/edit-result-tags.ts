import { createAppSignal } from "../../app/state";
import { Result } from "@oxytype/schemas/results";
import { Mode } from "@oxytype/schemas/shared";

import { showModal } from "./modals";
import { showErrorNotification } from "./notifications";

type IdAndTags = Pick<Result<Mode>, "_id" | "tags" | "client"> & {
  source?: "resultPage";
};
const [getSelectedResult, setSelectedResult] =
  createAppSignal<IdAndTags | null>(null);

export { getSelectedResult };

export function showEditResultTagsModal(options: IdAndTags): void {
  if (options._id === "") {
    showErrorNotification(
      "Failed to show edit result tags modal: result id is empty",
    );
    return;
  }
  setSelectedResult(options);
  showModal("EditResultTags");
}
