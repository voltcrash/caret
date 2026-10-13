/**
 * Minimal JSON lint covering the `@eslint/json` recommended rules:
 * no-duplicate-keys, no-empty-keys, no-unnormalized-keys, no-unsafe-values.
 */

export type JsonProblem = {
  line: number;
  column: number;
  message: string;
};

type Frame = {
  keys: Set<string> | undefined;
  expectKey: boolean;
};

const numberPattern = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const loneSurrogatePattern =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const minNormalNumber = 2.2250738585072014e-308;

function getPosition(
  source: string,
  index: number,
): Pick<JsonProblem, "line" | "column"> {
  const before = source.slice(0, index);
  const line = before.split("\n").length;
  return { line, column: index - before.lastIndexOf("\n") };
}

function checkNumber(lexeme: string): string | undefined {
  const value = Number(lexeme);
  if (!Number.isFinite(value)) return `number ${lexeme} evaluates to Infinity`;

  const mantissa = lexeme.split(/[eE]/)[0] as string;
  if (!/[.eE]/.test(lexeme) && !Number.isSafeInteger(value)) {
    return `integer ${lexeme} is outside the safe integer range`;
  }
  if (value === 0 && /[1-9]/.test(mantissa)) {
    return `number ${lexeme} rounds to zero`;
  }
  if (value !== 0 && Math.abs(value) < minNormalNumber) {
    return `number ${lexeme} is subnormal`;
  }
  return undefined;
}

function checkKey(key: string, keys: Set<string>): string | undefined {
  if (keys.has(key)) return `duplicate key "${key}"`;
  keys.add(key);
  if (key.trim() === "") return "empty key";
  if (key !== key.normalize("NFC")) return `key "${key}" is not NFC normalized`;
  return undefined;
}

export function lintJson(source: string): JsonProblem[] {
  try {
    JSON.parse(source);
  } catch (e) {
    return [
      {
        line: 1,
        column: 1,
        message: `Unable to parse ${e instanceof Error ? e.message : e}`,
      },
    ];
  }

  const problems: JsonProblem[] = [];
  const report = (index: number, message: string | undefined): void => {
    if (message === undefined) return;
    problems.push({ ...getPosition(source, index), message });
  };

  // source is valid JSON, so the scanner only has to track structure
  const stack: Frame[] = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i] as string;

    if (char === '"') {
      const start = i++;
      while (source[i] !== '"') i += source[i] === "\\" ? 2 : 1;
      i++;
      const raw = source.slice(start, i);
      const value = raw.includes("\\")
        ? (JSON.parse(raw) as string)
        : raw.slice(1, -1);

      const frame = stack.at(-1);
      if (frame?.keys !== undefined && frame.expectKey) {
        frame.expectKey = false;
        report(start, checkKey(value, frame.keys));
      }
      if (loneSurrogatePattern.test(value)) {
        report(start, "string contains a lone surrogate");
      }
      continue;
    }

    if (char === "-" || (char >= "0" && char <= "9")) {
      numberPattern.lastIndex = i;
      const lexeme = (numberPattern.exec(source) as RegExpExecArray)[0];
      report(i, checkNumber(lexeme));
      i += lexeme.length;
      continue;
    }

    if (char === "{") {
      stack.push({ keys: new Set(), expectKey: true });
    } else if (char === "[") {
      stack.push({ keys: undefined, expectKey: false });
    } else if (char === "}" || char === "]") {
      stack.pop();
    } else if (char === ",") {
      const frame = stack.at(-1);
      if (frame?.keys !== undefined) frame.expectKey = true;
    }
    i++;
  }

  return problems;
}
