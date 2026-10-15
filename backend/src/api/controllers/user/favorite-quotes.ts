import { adaptService } from "../../service-adapter";
import * as services from "../../../services/operations/user/favorite-quotes";
export const getFavoriteQuotes = adaptService(services.getFavoriteQuotes);
export const addFavoriteQuote = adaptService(services.addFavoriteQuote);
export const removeFavoriteQuote = adaptService(services.removeFavoriteQuote);
