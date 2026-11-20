import { createAppSignal } from "#app/state.ts";

import { showModal } from "#shared/states/modals.ts";

const [quoteId, setQuoteId] = createAppSignal(0);

export { quoteId };

export function showQuoteReportModal(id: number): void {
  setQuoteId(id);
  showModal("QuoteReport");
}
