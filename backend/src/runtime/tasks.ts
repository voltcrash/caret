import type { MessageBatch } from "@cloudflare/workers-types";
import { z } from "zod";
import { statement, binding } from "../db/client";
import { runtime } from "./env";
import { jobHandler } from "../workers/later-worker";
import type { LaterTask, LaterTaskType } from "../queues/later-queue";
import * as UserDAL from "../dal/user";
import type { MonkeyMail } from "@oxytype/schemas/users";
import type { Configuration } from "@oxytype/schemas/configuration";
import { updateLeaderboards } from "../jobs/update-leaderboards";

const DeliverySchema = z
  .object({ id: z.string().min(1), kind: z.enum(["outbox", "job"]) })
  .strict();
type Delivery = z.infer<typeof DeliverySchema>;
export async function dispatch(): Promise<void> {
  const queue = runtime().env.TASKS;
  if (queue === undefined) return;
  const now = Date.now();
  const outbox = await statement(
    "SELECT id FROM outbox WHERE completed_at IS NULL AND (sent_at IS NULL OR sent_at<?) ORDER BY created_at LIMIT 10",
    now - 900000,
  ).all<{ id: string }>();
  const jobs = await statement(
    "SELECT id FROM scheduled_jobs WHERE status<>'done' AND status<>'failed' AND due_at<=? AND lease_until<=? ORDER BY due_at LIMIT 10",
    now,
    now,
  ).all<{ id: string }>();
  const messages: Delivery[] = [
    ...outbox.results.map((row) => ({ id: row.id, kind: "outbox" as const })),
    ...jobs.results.map((row) => ({ id: row.id, kind: "job" as const })),
  ];
  if (messages.length === 0) return;
  await queue.sendBatch(messages.map((body) => ({ body })));
  await binding().batch([
    ...outbox.results.map((row) =>
      statement(
        "UPDATE outbox SET sent_at=? WHERE id=? AND completed_at IS NULL",
        now,
        row.id,
      ),
    ),
    ...jobs.results.map((row) =>
      statement(
        "UPDATE scheduled_jobs SET status='queued',lease_until=? WHERE id=? AND status IN ('pending','queued') AND lease_until<=?",
        now + 600000,
        row.id,
        now,
      ),
    ),
  ]);
}
async function consume(delivery: Delivery): Promise<void> {
  if (delivery.kind === "job") {
    const claim = await statement(
      "UPDATE scheduled_jobs SET status='processing',attempts=attempts+1,lease_until=? WHERE id=? AND status IN ('pending','queued','processing') AND due_at<=? AND (status='queued' OR lease_until<=?) RETURNING data,attempts",
      Date.now() + 300000,
      delivery.id,
      Date.now(),
      Date.now(),
    ).first<{ data: string; attempts: number }>();
    if (claim === null) return;
    try {
      await jobHandler(JSON.parse(claim.data) as LaterTask<LaterTaskType>);
      await statement(
        "UPDATE scheduled_jobs SET status='done',lease_until=0 WHERE id=? AND attempts=?",
        delivery.id,
        claim.attempts,
      ).run();
    } catch (error) {
      await statement(
        "UPDATE scheduled_jobs SET status=?,lease_until=? WHERE id=? AND attempts=?",
        claim.attempts >= 23 ? "failed" : "pending",
        Date.now() + 60000,
        delivery.id,
        claim.attempts,
      ).run();
      throw error;
    }
    return;
  }
  const row = await statement(
    "SELECT type,data,completed_at AS completedAt FROM outbox WHERE id=?",
    delivery.id,
  ).first<{ type: string; data: string; completedAt: number | null }>();
  if (row?.completedAt !== null) return;
  const data: unknown = JSON.parse(row.data);
  if (row.type === "reward") {
    const reward = data as {
      uid: string;
      mail: MonkeyMail[];
      inboxConfig: Configuration["users"]["inbox"];
    };
    if (await UserDAL.exists(reward.uid)) {
      await UserDAL.addToInbox(reward.uid, reward.mail, reward.inboxConfig);
    }
  } else {
    throw new Error(`Unknown delivery type: ${row.type}`);
  }
  await statement(
    "UPDATE outbox SET completed_at=? WHERE id=?",
    Date.now(),
    delivery.id,
  ).run();
}
export async function consumeBatch(batch: MessageBatch): Promise<void> {
  for (const message of batch.messages) {
    try {
      await consume(DeliverySchema.parse(message.body));
      message.ack();
    } catch (error) {
      console.error("Queue delivery failed", {
        id: message.id,
        error: String(error),
      });
      message.retry({ delaySeconds: 60 });
    }
  }
}
export async function scheduled(scheduledTime: number): Promise<void> {
  await dispatch();
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
      statement("DELETE FROM outbox WHERE completed_at<?", now - 90 * 86400000),
      statement(
        "DELETE FROM daily_entries WHERE expires_at<=? AND NOT EXISTS (SELECT 1 FROM scheduled_jobs WHERE status<>'done' AND json_extract(data,'$.ctx.yesterdayTimestamp')=daily_entries.period)",
        now,
      ),
      statement(
        "DELETE FROM weekly_entries WHERE expires_at<=? AND NOT EXISTS (SELECT 1 FROM scheduled_jobs WHERE status<>'done' AND json_extract(data,'$.ctx.lastWeekTimestamp')=weekly_entries.period)",
        now,
      ),
    ]);
  }
}
export const __testing = { consume };
