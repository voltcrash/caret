// touch screens without a precise pointer: phones, tablets
export function isCoarsePointer(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}
