import type { Quote } from "@caret/schemas/quotes";

export type DBReport = {
  _id: string;
  id: string;
  type: "quote" | "user";
  timestamp: number;
  uid: string;
  contentId: string;
  reason: string;
  comment: string;
};

export type DBQuoteApproval = {
  editQuote?: string;
  editSource?: string;
  approvedBy: string;
  repository?: string;
};

export type DBQuoteSubmissionData = Quote & {
  approval?: DBQuoteApproval;
};
