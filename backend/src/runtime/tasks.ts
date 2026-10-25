import { statement } from "../db/client";
import { commitBatch } from "../db/commit";
import { updateLeaderboards } from "../jobs/update-leaderboards";

/** Cron expressions in every Wrangler config; each trigger owns one job. */
export const LEADERBOARD_CRON = "*/15 * * * *";
export const MAINTENANCE_CRON = "0 * * * *";

export async function scheduled(cron: string): Promise<void> {
  if (cron === LEADERBOARD_CRON) await updateLeaderboards();
  if (cron === MAINTENANCE_CRON) {
    const now = Date.now();
    await commitBatch([
      statement(
        "DELETE FROM audit_logs WHERE important=0 AND timestamp<?",
        now - 30 * 86400000,
      ),
      statement("DELETE FROM auth_sessions WHERE expires_at<=?", now),
      statement("DELETE FROM auth_verifications WHERE expires_at<=?", now),
      statement("DELETE FROM daily_entries WHERE expires_at<=?", now),
      statement("DELETE FROM weekly_entries WHERE expires_at<=?", now),
      statement(
        "DELETE FROM write_receipts WHERE created_at<?",
        now - 7 * 86400000,
      ),
    ]);
  }
}
