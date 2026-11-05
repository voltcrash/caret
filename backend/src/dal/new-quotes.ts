import { and, eq, asc } from "drizzle-orm";
import type { ApproveQuote, Quote } from "@caret/schemas/quotes";
import type { Language } from "@caret/schemas/languages";
import { compareTwoStrings } from "../utils/string-similarity";
import { database, statement, encode } from "../db/client";
import { quoteSubmissions } from "../db/schema";
import { commitBatch } from "../db/commit";
import { newId } from "../utils/id";
import { envValue, runtime } from "../runtime/env";
import { integration } from "../utils/integration";
import MonkeyError from "../utils/error";
import { z } from "zod";
const QuoteDataSchema = z.object({
  quotes: z.array(z.object({ id: z.number(), text: z.string() })),
});
export type DBNewQuote = Quote;
function validateLanguage(language: string): void {
  if (!/^\w+$/.test(language)) {
    throw new MonkeyError(400, "Invalid language name", language);
  }
}
export async function add(
  text: string,
  source: string,
  language: Language,
  uid: string,
): Promise<
  | { languageError?: number; duplicateId?: number; similarityScore?: number }
  | undefined
> {
  validateLanguage(language);
  const base = envValue("QUOTES_ASSET_URL");
  const assets = runtime().env.ASSETS;
  if (base === undefined && assets === undefined) {
    throw new MonkeyError(503, "Quote assets are not configured");
  }
  const url = new URL(
    `/quotes/${language}.json`,
    base ?? "https://assets.local",
  );
  const response =
    assets === undefined
      ? await fetch(url, { signal: AbortSignal.timeout(10000) })
      : await assets.fetch(url);
  if (response.status === 404) return { languageError: 1 };
  if (!response.ok) {
    throw new MonkeyError(503, "Quote assets could not be loaded");
  }
  const quotes = QuoteDataSchema.parse(await response.json());
  for (const quote of quotes.quotes) {
    const score = compareTwoStrings(quote.text, text);
    if (score > 0.9) return { duplicateId: quote.id, similarityScore: score };
  }
  const id = newId(),
    timestamp = Date.now();
  const committed = await commitBatch([
    statement(
      "SELECT pg_advisory_xact_lock(hashtextextended(?,0))",
      `quote-submissions:${language}`,
    ),
    statement(
      "INSERT INTO quote_submissions(id,language,submitted_by,timestamp,approved,data) SELECT ?,?,?,?,false,? WHERE (SELECT count(*) FROM quote_submissions WHERE language=?) < 100",
      id,
      language,
      uid,
      timestamp,
      encode({
        _id: id,
        text,
        source,
        language,
        submittedBy: uid,
        timestamp,
        approved: false,
      }),
      language,
    ),
  ]);
  const inserted =
    committed?.[1]?.rowCount ??
    ((await statement(
      "SELECT id FROM quote_submissions WHERE id=?",
      id,
    ).first()) === null
      ? 0
      : 1);
  if (inserted === 0) {
    throw new MonkeyError(
      409,
      "There are already 100 quotes in the queue for this language.",
    );
  }
  return undefined;
}
export async function get(language: Language | "all"): Promise<DBNewQuote[]> {
  validateLanguage(language);
  return (
    await database()
      .select()
      .from(quoteSubmissions)
      .where(
        and(
          language === "all"
            ? undefined
            : eq(quoteSubmissions.language, language),
        ),
      )
      .orderBy(asc(quoteSubmissions.timestamp))
      .limit(10)
  ).map((row) => ({ ...row.data, _id: row.id }) as DBNewQuote);
}
/** Language of a pending submission; undefined once it has been reviewed. */
export async function getLanguage(
  quoteId: string,
): Promise<string | undefined> {
  const row = (
    await database()
      .select({ language: quoteSubmissions.language })
      .from(quoteSubmissions)
      .where(eq(quoteSubmissions.id, quoteId))
      .limit(1)
  )[0];
  return row?.language;
}
export async function approve(
  quoteId: string,
  editQuote: string | undefined,
  editSource: string | undefined,
  name: string,
): Promise<{ quote: ApproveQuote; message: string }> {
  // Claim the decision before delivery. A failed delivery remains retryable,
  // but refusal and later edits must not change its idempotent payload.
  await statement(
    "UPDATE quote_submissions SET approved=true,data=jsonb_set(data,'{approval}',?::jsonb) WHERE id=? AND approved=false",
    encode({
      editQuote,
      editSource,
      approvedBy: name,
      repository: envValue("QUOTES_REPOSITORY"),
    }),
    quoteId,
  ).run();
  const row = (
    await database()
      .select()
      .from(quoteSubmissions)
      .where(eq(quoteSubmissions.id, quoteId))
      .limit(1)
  )[0];
  if (!row) {
    throw new MonkeyError(
      404,
      "Quote not found. It might have already been reviewed. Please refresh the list.",
    );
  }
  const result = await integration<{ quote: ApproveQuote; message: string }>(
    "quotes/approve",
    {
      quoteId,
      quote: row.data,
      ...(
        row.data as {
          approval: {
            editQuote?: string;
            editSource?: string;
            approvedBy: string;
            repository?: string;
          };
        }
      ).approval,
    },
    `quote:${quoteId}`,
  );
  await database()
    .delete(quoteSubmissions)
    .where(eq(quoteSubmissions.id, quoteId));
  return result;
}
export async function refuse(quoteId: string): Promise<void> {
  const removed = await statement(
    "DELETE FROM quote_submissions WHERE id=? AND approved=false",
    quoteId,
  ).run();
  if (removed.rowCount === 0)
    throw new MonkeyError(409, "Quote is already being approved or reviewed");
}
