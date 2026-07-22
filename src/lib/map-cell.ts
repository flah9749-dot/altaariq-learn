// Pure, server-safe helper: convert an AI-returned grid cell like "H14" into
// (x%, y%) using the grid dimensions. No browser APIs — safe to import from
// server functions and edge runtimes.

export function cellToPercent(
  cell: string,
  cols: number,
  rows: number,
  offsetX = 0.5,
  offsetY = 0.5,
): { x: number; y: number } | null {
  if (!cell || typeof cell !== "string") return null;
  const m = /^([A-Za-z]{1,2})\s*(\d{1,3})$/.exec(cell.trim());
  if (!m) return null;
  const letters = m[1].toUpperCase();
  let colIdx = 0;
  if (letters.length === 1) colIdx = letters.charCodeAt(0) - 65;
  else colIdx = (letters.charCodeAt(0) - 64) * 26 + (letters.charCodeAt(1) - 65);
  const rowIdx = parseInt(m[2], 10) - 1;
  if (colIdx < 0 || colIdx >= cols || rowIdx < 0 || rowIdx >= rows) return null;
  const ox = Math.max(0, Math.min(1, Number.isFinite(offsetX) ? offsetX : 0.5));
  const oy = Math.max(0, Math.min(1, Number.isFinite(offsetY) ? offsetY : 0.5));
  return {
    x: Math.round(((colIdx + ox) / cols) * 1000) / 10,
    y: Math.round(((rowIdx + oy) / rows) * 1000) / 10,
  };
}
