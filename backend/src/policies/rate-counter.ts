import { statement } from "../db/client";
export type CounterResult = { points: number; expiresAt: number };
export async function consume(
  key: string,
  duration: number,
  points = 1,
): Promise<CounterResult> {
  const now = Date.now();
  const result = await statement(
    "INSERT INTO rate_counters(key,points,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET points=CASE WHEN expires_at<=? THEN excluded.points ELSE points+excluded.points END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING points,expires_at AS expiresAt",
    key,
    points,
    now + duration,
    now,
    now,
  ).first<CounterResult>();
  if (result === null) throw new Error("Rate counter missing");
  return result;
}
