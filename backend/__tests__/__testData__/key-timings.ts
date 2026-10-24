import { serverAudit } from "@oxytype/typing-engine/audit.server";

const probit = (p: number): number => serverAudit().probit([p])[0] as number;

export type KeyTimings = { keySpacing: number[]; keyDuration: number[] };

/** Deterministic uniform draws, so statistical assertions stay stable. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    // keep away from 0 and 1 so probit stays finite
    return (state + 0.5) / 2 ** 32;
  };
}

/**
 * A rough model of a hand: one log-speed state drifts slowly (AR(1)) and
 * drives both gaps and holds, with lognormal noise, occasional rollover and
 * pauses. Not a substitute for real samples; it only has the properties the
 * review signals look for.
 */
export function humanTimings(
  keys: number,
  seed = 1,
  msPerKey = 80,
): KeyTimings {
  const random = seeded(seed);
  const keySpacing: number[] = [];
  const keyDuration: number[] = [];
  let speed = 0;
  for (let i = 0; i < keys; i++) {
    speed = 0.8 * speed + 0.2 * probit(random());
    const gap = msPerKey * Math.exp(0.5 * speed + 0.25 * probit(random()));
    const pause = random() < 0.03 ? 400 + 600 * random() : 0;
    keyDuration.push(
      0.9 * msPerKey * Math.exp(0.4 * speed + 0.2 * probit(random())),
    );
    if (i < keys - 1) keySpacing.push(Math.round((gap + pause) * 10) / 10);
  }
  return {
    keySpacing,
    keyDuration: keyDuration.map((value) => Math.round(value * 10) / 10),
  };
}

/** Independent draws for every gap and hold, as simple macro tools do. */
export function generatedTimings(
  keys: number,
  draw: (random: () => number, channel: "gap" | "hold") => number,
  seed = 1,
): KeyTimings {
  const random = seeded(seed);
  return {
    keySpacing: Array.from({ length: keys - 1 }, () => draw(random, "gap")),
    keyDuration: Array.from({ length: keys }, () => draw(random, "hold")),
  };
}
