/**
 * xorshift32 seeded RNG. Deterministic for a given seed.
 * Used so floors generate identically for replay/debug.
 */
export function seededRng(seed: number): () => number {
  let s = seed | 0;
  if (s === 0) s = 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

/**
 * Seeded from floor number only (world seed not readable from script API).
 * A single run is reproducible; different worlds with same floor get the same maze.
 * That's acceptable for v1.
 */
export function worldSeededRng(floorNumber: number): () => number {
  return seededRng(0xBADC0DE ^ (floorNumber * 2654435761));
}
