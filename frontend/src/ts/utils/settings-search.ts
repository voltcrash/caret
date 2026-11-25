export type SettingSearchIndex = {
  names: string[];
  options: string[];
  description: string[];
};

// Common names people use for the same controls. Expand names only, so a
// passing mention in a description doesn't become a high-priority match.
const aliases: Record<string, string> = {
  caret: "cursor cursors",
  font: "fonts typeface typefaces",
  sound: "sounds audio",
  background: "wallpaper",
  keymap: "keyboard virtual onscreen on screen",
  layout: "keyboard",
  speed: "wpm",
  accuracy: "acc",
  min: "minimum",
  max: "maximum",
  opacity: "transparency",
  colors: "colours",
  colorful: "colourful",
  tips: "shortcuts hotkeys",
  palette: "commandline command line",
  shortcut: "hotkey hotkeys keybind keybinds",
  pace: "ghost",
  timer: "countdown",
  fps: "framerate frames frame rate",
  playtimewarning: "sound sounds audio",
};

export function tokenizeSettingsSearch(text: string): string[] {
  return [
    ...new Set(
      text
        .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu) ?? [],
    ),
  ];
}

function nameWords(words: string[]): string[] {
  return [
    ...new Set([
      ...words,
      ...words.flatMap((word) =>
        tokenizeSettingsSearch(
          Object.hasOwn(aliases, word) ? (aliases[word] ?? "") : "",
        ),
      ),
    ]),
  ];
}

export function createSettingSearchIndex(setting: {
  key?: string;
  title: string;
  description?: string;
  keywords?: string;
}): SettingSearchIndex {
  const names = tokenizeSettingsSearch(
    `${setting.title} ${setting.key ?? ""} ${setting.key?.toLowerCase() ?? ""}`,
  );
  return {
    names: nameWords(names),
    options: tokenizeSettingsSearch(setting.keywords ?? ""),
    description: tokenizeSettingsSearch(setting.description ?? ""),
  };
}

// Optimal string alignment (restricted Damerau-Levenshtein) distance bounded by
// `limit`: counts single-character insertions, deletions, substitutions and
// adjacent transpositions, exiting early once every cell in a row exceeds limit.
function withinEditDistance(a: string, b: string, limit: number): boolean {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > limit) return false;
  if (m === 0) return n <= limit;
  if (n === 0) return m <= limit;

  let prevPrev = new Array<number>(n + 1).fill(0);
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1).fill(0);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = i;
    const ai = a.charCodeAt(i - 1);
    const aiPrev = i > 1 ? a.charCodeAt(i - 2) : -1;

    for (let j = 1; j <= n; j++) {
      const bj = b.charCodeAt(j - 1);
      const cost = ai === bj ? 0 : 1;
      let dist = Math.min(
        (prev[j] as number) + 1,
        (curr[j - 1] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        ai !== bj &&
        ai === b.charCodeAt(j - 2) &&
        aiPrev === bj
      ) {
        dist = Math.min(dist, (prevPrev[j - 2] as number) + 1);
      }
      curr[j] = dist;
      if (dist < rowMin) rowMin = dist;
    }

    if (rowMin > limit) return false;
    const recycled = prevPrev;
    prevPrev = prev;
    prev = curr;
    curr = recycled;
  }

  return (prev[n] as number) <= limit;
}

function matchWord(
  word: string,
  token: string,
): "literal" | "typo" | undefined {
  if (word.startsWith(token)) return "literal";
  // Short words/numbers are too ambiguous to correct. Longer words allow one
  // edit (including a swapped pair); eight or more letters allow two.
  if (token.length < 4 || word.length < 4 || !/^\p{L}+$/u.test(token)) {
    return undefined;
  }
  const limit = token.length >= 8 ? 2 : 1;
  return withinEditDistance(word, token, limit) ? "typo" : undefined;
}

export function scoreSettingSearch(
  index: SettingSearchIndex,
  tokens: string[],
): number {
  if (tokens.length === 0) return 0;
  const fields = [index.names, index.options, index.description];
  let literalMatches = 0;
  let relevance = 0;
  for (const token of tokens) {
    let literalRank = 0;
    let typoRank = 0;
    for (const [i, words] of fields.entries()) {
      for (const word of words) {
        const match = matchWord(word, token);
        if (match === "literal") {
          literalRank = 3 - i;
          break;
        }
        if (match === "typo") typoRank = Math.max(typoRank, 3 - i);
      }
      if (literalRank > 0) break;
    }
    // Every query word must match; unrelated partial results are misleading.
    if (literalRank === 0 && typoRank === 0) return 0;
    if (literalRank > 0) literalMatches++;
    relevance += literalRank || typoRank;
  }
  // Literal matches always outrank typo corrections. Then prefer names and
  // aliases over option labels, and option labels over descriptions.
  return literalMatches * 4 + relevance / tokens.length;
}

export function getSettingsSearchHighlights(
  text: string,
  tokens: string[],
  includeAliases = false,
): { text: string; matched: boolean }[] {
  return text
    .split(/([\p{L}\p{N}]+)/u)
    .filter((part) => part !== "")
    .map((part) => {
      const words = tokenizeSettingsSearch(part);
      return {
        text: part,
        matched: (includeAliases ? nameWords(words) : words).some((word) =>
          tokens.some((token) => matchWord(word, token) !== undefined),
        ),
      };
    });
}
