import { createHash } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import type { User } from "@caret/schemas/users";
import { database } from "../db/client";
import { blocklist } from "../db/schema";
type Properties = Pick<User, "name" | "email">;
function entries(user: Partial<Properties>): { kind: string; hash: string }[] {
  return Object.entries(user)
    .filter(([, value]) => value !== undefined)
    .map(([kind, value]) => ({ kind, hash: hash(value) }));
}
export function hash(value: string): string {
  return createHash("sha256").update(value.toLocaleLowerCase()).digest("hex");
}
export async function contains(user: Partial<Properties>): Promise<boolean> {
  const filter = entries(user);
  if (!filter.length) return false;
  return (
    (
      await database()
        .select()
        .from(blocklist)
        .where(
          or(
            ...filter.map((entry) =>
              and(
                eq(blocklist.kind, entry.kind),
                eq(blocklist.hash, entry.hash),
              ),
            ),
          ),
        )
        .limit(1)
    ).length > 0
  );
}
