/** Helpers for square grids stored as flat arrays (index = row * size + col). */

export function rowOf(index: number, size: number): number {
  return Math.floor(index / size);
}

export function colOf(index: number, size: number): number {
  return index % size;
}

/** True when a and b touch, including diagonals (8-way). */
export function isAdjacent8(a: number, b: number, size: number): boolean {
  if (a === b) return false;
  const dr = Math.abs(rowOf(a, size) - rowOf(b, size));
  const dc = Math.abs(colOf(a, size) - colOf(b, size));
  return dr <= 1 && dc <= 1;
}

/** Neighbours of a cell, 8-way. */
export function neighbors8(index: number, size: number): number[] {
  const r = rowOf(index, size);
  const c = colOf(index, size);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) out.push(nr * size + nc);
    }
  }
  return out;
}

/** Neighbours of a cell, 4-way (no diagonals). */
export function neighbors4(index: number, size: number): number[] {
  const r = rowOf(index, size);
  const c = colOf(index, size);
  const out: number[] = [];
  if (r > 0) out.push(index - size);
  if (r < size - 1) out.push(index + size);
  if (c > 0) out.push(index - 1);
  if (c < size - 1) out.push(index + 1);
  return out;
}
