// Seeded keystroke plans shared by the fixture recorders.

export type Rng = () => number;

export type Action =
  | { kind: "key"; key: string; gap: number; hold: number }
  | { kind: "pause"; ms: number };

export function mulberry32(seed: number): Rng {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The scripted press used for web recordings: uniform gaps and holds. */
export function scriptedKey(rng: Rng, k: string, fast = false): Action {
  const gap = fast ? 60 + rng() * 60 : 90 + rng() * 120;
  // some holds outlast the gap to the next key so keys overlap
  const hold = 40 + rng() * 110;
  return { kind: "key", key: k, gap: Math.round(gap), hold: Math.round(hold) };
}
