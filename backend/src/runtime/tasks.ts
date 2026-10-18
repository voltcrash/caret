import { statement, binding } from "../db/client";
import { updateLeaderboards } from "../jobs/update-leaderboards";

export async function scheduled(scheduledTime: number): Promise<void> {
  if (Math.floor(scheduledTime / 60000) % 15 === 0) await updateLeaderboards();
  if (Math.floor(scheduledTime / 60000) % 60 === 0) {
    const now = Date.now();
    await binding().batch([
      statement(
        "DELETE FROM audit_logs WHERE important=0 AND timestamp<?",
        now - 30 * 86400000,
      ),
      statement("DELETE FROM rate_counters WHERE expires_at<=?", now),
      statement("DELETE FROM auth_sessions WHERE expires_at<=?", now),
      statement("DELETE FROM auth_verifications WHERE expires_at<=?", now),
      statement(
        "DELETE FROM auth_rate_limits WHERE last_request<?",
        now - 86400000,
      ),
      statement("DELETE FROM daily_entries WHERE expires_at<=?", now),
      statement("DELETE FROM weekly_entries WHERE expires_at<=?", now),
    ]);
  }
}
