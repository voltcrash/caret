import { createAppSignal } from "../../app/state";

import { showModal } from "./modals";

const [quoteId, setQuoteId] = createAppSignal(0);

export { quoteId };

export function showQuoteReportModal(id: number): void {
  setQuoteId(id);
  showModal("QuoteReport");
}
