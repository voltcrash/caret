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
