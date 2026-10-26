import MonkeyError from "../../utils/error";
import { newId } from "../../utils/id";

import { mutateUser } from "../../db/mutation";

import type {
  CustomTheme,
  UserInventory,
  UserProfileDetails,
  UserQuoteRatings,
  ResultFilters,
} from "@caret/schemas/users";

import type { DBUser, DBCustomTheme } from "./types";

import { getUser } from "./queries";

export async function updateQuoteRatings(
  uid: string,
  quoteRatings: UserQuoteRatings,
): Promise<boolean> {
  await mutateUser(uid, (user) => {
    user.quoteRatings = quoteRatings;
  });
  return true;
}
export async function addResultFilterPreset(
  uid: string,
  resultFilter: ResultFilters,
  maxFiltersPerUser: number,
): Promise<string> {
  const id = newId();
  await mutateUser(uid, (user) => {
    if ((user.resultFilterPresets?.length ?? 0) >= maxFiltersPerUser) {
      throw new MonkeyError(409, "Maximum number of custom filters reached");
    }
    (user.resultFilterPresets ??= []).push({ ...resultFilter, _id: id });
  });
  return id;
}
export async function removeResultFilterPreset(
  uid: string,
  id: string,
): Promise<void> {
  await mutateUser(uid, (user) => {
    if (!user.resultFilterPresets?.some((item) => item._id === id)) {
      throw new MonkeyError(404, "Custom filter not found");
    }
    user.resultFilterPresets = user.resultFilterPresets.filter(
      (item) => item._id !== id,
    );
  });
}
export async function addTheme(
  uid: string,
  { name, colors }: Omit<CustomTheme, "_id">,
): Promise<{ _id: string; name: string }> {
  const theme = { _id: newId(), name, colors };
  await mutateUser(uid, (user) => {
    if ((user.customThemes?.length ?? 0) >= 20) {
      throw new MonkeyError(409, "Maximum number of custom themes reached");
    }
    (user.customThemes ??= []).push(theme);
  });
  return { _id: theme._id, name };
}
function themeById(user: DBUser, id: string): DBCustomTheme {
  const theme = user.customThemes?.find((item) => item._id === id);
  if (!theme) throw new MonkeyError(404, "Custom theme not found");
  return theme;
}
export async function removeTheme(uid: string, id: string): Promise<void> {
  await mutateUser(uid, (user) => {
    themeById(user, id);
    user.customThemes = user.customThemes?.filter((item) => item._id !== id);
  });
}
export async function editTheme(
  uid: string,
  id: string,
  { name, colors }: Omit<CustomTheme, "_id">,
): Promise<void> {
  await mutateUser(uid, (user) => {
    Object.assign(themeById(user, id), { name, colors });
  });
}
export async function getThemes(uid: string): Promise<DBCustomTheme[]> {
  return (await getUser(uid, "get themes")).customThemes ?? [];
}
export async function getFavoriteQuotes(
  uid: string,
): Promise<NonNullable<DBUser["favoriteQuotes"]>> {
  return (await getUser(uid, "get favorite quotes")).favoriteQuotes ?? {};
}
export async function addFavoriteQuote(
  uid: string,
  language: string,
  quoteId: string,
  maxQuotes: number,
): Promise<void> {
  await mutateUser(uid, (user) => {
    const favorites = (user.favoriteQuotes ??= {});
    if (
      Object.values(favorites).reduce(
        (sum, quotes) => sum + quotes.length,
        0,
      ) >= maxQuotes
    ) {
      throw new MonkeyError(409, "Maximum number of favorite quotes reached");
    }
    const quotes = ((favorites as Record<string, string[]>)[language] ??= []);
    if (!quotes.includes(quoteId)) quotes.push(quoteId);
  });
}
export async function removeFavoriteQuote(
  uid: string,
  language: string,
  quoteId: string,
): Promise<void> {
  await mutateUser(uid, (user) => {
    if (
      user.favoriteQuotes !== undefined &&
      (user.favoriteQuotes as Record<string, string[]>)[language] !== undefined
    ) {
      (user.favoriteQuotes as Record<string, string[]>)[language] = (
        (user.favoriteQuotes as Record<string, string[]>)[language] ?? []
      ).filter((id) => id !== quoteId);
    }
  });
}
export async function updateProfile(
  uid: string,
  updates: Partial<UserProfileDetails>,
  inventory?: UserInventory,
): Promise<void> {
  await mutateUser(uid, (user) => {
    const current = (user.profileDetails ??= {
      bio: "",
      keyboard: "",
      socialProfiles: {},
    });
    if (updates.bio !== undefined) current.bio = updates.bio;
    if (updates.keyboard !== undefined) current.keyboard = updates.keyboard;
    if (updates.showActivityOnPublicProfile !== undefined) {
      current.showActivityOnPublicProfile = updates.showActivityOnPublicProfile;
    }
    if (updates.socialProfiles) {
      current.socialProfiles = {
        ...current.socialProfiles,
        ...updates.socialProfiles,
      };
    }
    if (inventory !== undefined) user.inventory = inventory;
  });
}
