/** The searchable fields of a command palette entry. */
export type MatchableCommand = {
  display: string;
  alias?: string;
  singleListDisplayNoIcon?: string;
};

function stripPunctuation(str: string): string {
  return str.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, "");
}

/** Web palette filtering: prefix word matches, keeping the strongest. */
export function matchCommands(
  list: MatchableCommand[],
  availability: boolean[],
  inputValue: string,
  usingSingleList: boolean,
): boolean[] {
  const inputNoQuickSingle = inputValue
    .replace(/^>/gi, "")
    .toLowerCase()
    .trim();
  const inputSplit =
    inputNoQuickSingle.length === 0
      ? []
      : inputNoQuickSingle.split(" ").map(stripPunctuation).filter(Boolean);

  const matches: { matchCount: number; matchStrength: number }[] = [];
  const matchCounts: number[] = [];

  for (const [index, command] of list.entries()) {
    if (!availability[index]) {
      matches.push({ matchCount: -1, matchStrength: -1 });
      continue;
    }

    if (inputNoQuickSingle.length === 0 || inputSplit.length === 0) {
      matches.push({ matchCount: 0, matchStrength: 0 });
      continue;
    }

    const displaySplit = (
      usingSingleList
        ? (command.singleListDisplayNoIcon ?? "") || command.display
        : command.display
    )
      .toLowerCase()
      .split(" ")
      .map(stripPunctuation);
    const aliasSplit =
      command.alias?.toLowerCase().split(" ").map(stripPunctuation) ?? [];

    const displayAliasSplit = displaySplit.concat(aliasSplit);
    const displayAliasMatchArray: (number | null)[] = displayAliasSplit.map(
      () => null,
    );
    let matchStrength = 0;

    for (const [inputIndex, input] of inputSplit.entries()) {
      for (const [
        displayAliasIndex,
        displayAlias,
      ] of displayAliasSplit.entries()) {
        const matchedInputIndex = displayAliasMatchArray[displayAliasIndex] as
          | null
          | number;
        if (
          displayAlias.startsWith(input) &&
          matchedInputIndex === null &&
          !displayAliasMatchArray.includes(inputIndex)
        ) {
          displayAliasMatchArray[displayAliasIndex] = inputIndex;
          matchStrength += input.length;
        }
      }
    }

    const matchCount = displayAliasMatchArray.filter((i) => i !== null).length;
    matchCounts.push(matchCount);
    matches.push({ matchCount, matchStrength });
  }

  const maxMatchStrength = Math.max(...matches.map((m) => m.matchStrength));
  let minMatchCountToShow = inputSplit.length;
  do {
    const count = matchCounts.filter((m) => m >= minMatchCountToShow).length;
    if (count > 0) break;
    minMatchCountToShow--;
  } while (minMatchCountToShow > 0);

  if (minMatchCountToShow === 0) minMatchCountToShow = 1;

  return list.map((_, index) => {
    const match = matches[index];
    return (
      match !== undefined &&
      match.matchCount >= minMatchCountToShow &&
      match.matchStrength >= maxMatchStrength
    );
  });
}
