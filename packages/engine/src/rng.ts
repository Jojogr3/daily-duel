/**
 * Deterministic random numbers. Every puzzle is generated from a seed string,
 * so the server and any client produce the identical board for the same seed.
 */

export type Rng = () => number;

/** FNV-1a 32-bit hash of a string. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: small, fast, good-enough PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFromSeed(seed: string): Rng {
  return mulberry32(hashString(seed));
}

/** Integer in [0, n). */
export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

export function pickWeighted<T>(rng: Rng, items: ReadonlyArray<readonly [T, number]>): T {
  let total = 0;
  for (const [, w] of items) total += w;
  let r = rng() * total;
  for (const [value, w] of items) {
    r -= w;
    if (r < 0) return value;
  }
  const last = items[items.length - 1];
  if (!last) throw new Error('pickWeighted: empty list');
  return last[0];
}
