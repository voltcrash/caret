import { quotesContract } from "@oxytype/contracts/quotes";
import { initServer } from "../hono-adapter";
import * as QuoteService from "../../services/operations/quote";
import { callService } from "../ts-rest-adapter";

const s = initServer();
export default s.router(quotesContract, {
  get: {
    handler: async (r) => callService(QuoteService.getQuotes)(r),
  },
  isSubmissionEnabled: {
    handler: async (r) => callService(QuoteService.isSubmissionEnabled)(r),
  },
  add: {
    handler: async (r) => callService(QuoteService.addQuote)(r),
  },
  approveSubmission: {
    handler: async (r) => callService(QuoteService.approveQuote)(r),
  },
  rejectSubmission: {
    handler: async (r) => callService(QuoteService.refuseQuote)(r),
  },
  getRating: {
    handler: async (r) => callService(QuoteService.getRating)(r),
  },
  addRating: {
    handler: async (r) => callService(QuoteService.submitRating)(r),
  },
  report: {
    handler: async (r) => callService(QuoteService.reportQuote)(r),
  },
});
