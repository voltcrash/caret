import { Client } from "@oxytype/schemas/shared";
import { baseKey } from "../../queries/utils/keys";

export const queryKeys = {
  root: (client: Client = "web") => [
    ...baseKey("results", { isUserSpecific: true }),
    client,
  ],
  fullResult: (_id: string) => [...queryKeys.root(), _id],
};
