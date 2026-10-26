import { stage } from "../db/mutation";
import { and, eq } from "drizzle-orm";
import type { QuoteRating } from "@caret/schemas/quotes";
import type { Language } from "@caret/schemas/languages";
import { database, statement } from "../db/client";
import { quoteRatings } from "../db/schema";
import { newId } from "../utils/id";
type DBQuoteRating = QuoteRating;
export async function submit(
  quoteId: number,
  language: Language,
  rating: number,
  update: boolean,
): Promise<void> {
  await stage(
    statement(
      "INSERT INTO quote_ratings(id,language,quote_id,ratings,total_rating) VALUES(?,?,?,?,?) ON CONFLICT(language,quote_id) DO UPDATE SET ratings=ratings+excluded.ratings,total_rating=total_rating+excluded.total_rating",
      newId(),
      language,
      quoteId,
      Number(!update),
      rating,
    ),
  );
}
export async function get(
  quoteId: number,
  language: Language,
): Promise<DBQuoteRating | null> {
  const row = await database()
    .select()
    .from(quoteRatings)
    .where(
      and(
        eq(quoteRatings.quoteId, quoteId),
        eq(quoteRatings.language, language),
      ),
    )
    .get();
  return row
    ? ({
        ...row,
        _id: row.id,
        average: row.ratings
          ? Math.round((row.totalRating / row.ratings) * 10) / 10
          : 0,
      } as DBQuoteRating)
    : null;
}
