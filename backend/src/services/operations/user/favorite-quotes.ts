import * as UserDAL from "../../../dal/user";
import { MonkeyResponse } from "../../../utils/monkey-response";
import {
  AddFavoriteQuoteRequest,
  GetFavoriteQuotesResponse,
  RemoveFavoriteQuoteRequest,
} from "@oxytype/contracts/users";
import type { ServiceContext, OperationInput } from "../../context";

export async function getFavoriteQuotes(
  context: ServiceContext,
  _input: OperationInput,
): Promise<GetFavoriteQuotesResponse> {
  const { uid } = context.actor;

  const quotes = await UserDAL.getFavoriteQuotes(uid);

  return new MonkeyResponse("Favorite quotes retrieved", quotes);
}
export async function addFavoriteQuote(
  context: ServiceContext,
  input: OperationInput<undefined, AddFavoriteQuoteRequest>,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;

  const { language, quoteId } = input.body;

  await UserDAL.addFavoriteQuote(
    uid,
    language,
    quoteId,
    context.configuration.quotes.maxFavorites,
  );

  return new MonkeyResponse("Quote added to favorites", null);
}
export async function removeFavoriteQuote(
  context: ServiceContext,
  input: OperationInput<undefined, RemoveFavoriteQuoteRequest>,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;

  const { quoteId, language } = input.body;
  await UserDAL.removeFavoriteQuote(uid, language, quoteId);

  return new MonkeyResponse("Quote removed from favorites", null);
}
