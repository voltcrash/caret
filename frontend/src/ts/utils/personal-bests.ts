import type {
  Mode,
  PersonalBest,
  PersonalBests,
} from "@oxytype/schemas/shared";

export function emptyPersonalBests(): PersonalBests {
  return { time: {}, words: {}, quote: {}, zen: {}, custom: {} };
}

/** The personal bests of one mode and mode2, created on first use. */
export function personalBestList(
  bests: PersonalBests,
  mode: Mode,
  mode2: string | number,
): PersonalBest[] {
  const byMode2: Partial<Record<string | number, PersonalBest[]>> = (bests[
    mode
  ] ??= {});
  return (byMode2[mode2] ??= []);
}
