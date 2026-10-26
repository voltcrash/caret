import type { PSA } from "@caret/schemas/psas";
import { database } from "../db/client";
import { psas } from "../db/schema";
export type DBPSA = PSA;
export async function get(): Promise<DBPSA[]> {
  return (await database().select().from(psas)).map(
    (row) => ({ ...row.data, _id: row.id }) as unknown as DBPSA,
  );
}
