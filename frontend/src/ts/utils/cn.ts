import { twMerge } from "tailwind-merge";
import { ClassValue, clsx } from "clsx";

export function cn(...input: ClassValue[]): string {
  return twMerge(clsx(...input));
}

function isClassSeparator(code: number): boolean {
  // HTML class attributes split on ASCII whitespace.
  return code === 32 || code === 9 || code === 10 || code === 12 || code === 13;
}

function splitClassNames(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

/** Token match without allocating; for hot typing paths reading className. */
export function hasClassName(className: string, name: string): boolean {
  if (name === "") return false;
  let from = 0;
  for (;;) {
    const start = className.indexOf(name, from);
    if (start === -1) return false;
    const end = start + name.length;
    if (
      (start === 0 || isClassSeparator(className.charCodeAt(start - 1))) &&
      (end === className.length || isClassSeparator(className.charCodeAt(end)))
    ) {
      return true;
    }
    from = start + 1;
  }
}

// Preserve existing display utilities when imperative animations toggle hidden.
export function updateClassNames(
  current: string,
  names: string,
  enabled: boolean,
): string {
  const classes = splitClassNames(current);
  const changes = splitClassNames(names);
  return enabled
    ? [...new Set([...classes, ...changes])].join(" ")
    : classes.filter((name) => !changes.includes(name)).join(" ");
}
