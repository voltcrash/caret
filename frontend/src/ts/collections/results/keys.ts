import { Client } from "@caret/schemas/shared";
import { baseKey } from "../../../data/queries/keys";

export const queryKeys = {
  root: (client: Client = "web") => [
    ...baseKey("results", { isUserSpecific: true }),
    client,
  ],
  fullResult: (_id: string) => [...queryKeys.root(), _id],
};
