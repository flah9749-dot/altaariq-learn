// Client-side helper: overlay a labeled reference grid on top of a map image
// so vision models can pick a *grid cell* instead of guessing raw pixel coords.
// Cell size = ~5% of the image, which is far more accurate than typical LLM
// pixel estimates. Columns are letters (A..), rows are numbers (1..).

export type GridInfo = {
  cols: number;
  rows: number;
  colLabels: string[]; // e.g. ["A","B",...]
  rowLabels: string[]; // e.g. ["1","2",...]
};

function colLetters(n: number): string[] {
  // A..Z, then AA, AB... (handles up to 26 well enough)
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    if (i < 26) out.push(String.fromCharCode(65 + i));
    else {
      const a = Math.floor(i / 26) - 1;
      const b = i % 26;
      out.push(String.fromCharCode(65 + a) + String.fromCharCode(65 + b));
    }
  }
  return out;
}

export async function buildGridOverlay(
  dataUrl: string,
  cols = 20,
  rows = 20,
): Promise<{ dataUrl: string; info: GridInfo }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("image load failed"));
    el.src = dataUrl;
  });

  // Keep the image at a reasonable size (vision models don't need > ~1600px)
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.round(img.naturalWidth * scale);
  const H = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d unavailable");
  ctx.drawImage(img, 0, 0, W, H);

  const cw = W / cols;
  const rh = H / rows;
  const colLabels = colLetters(cols);
  const rowLabels = Array.from({ length: rows }, (_, i) => String(i + 1));

  // Grid lines — thin translucent black + white halo for contrast on any map.
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  for (let i = 1; i < cols; i++) {
    const x = Math.round(i * cw) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let i = 1; i < rows; i++) {
    const y = Math.round(i * rh) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  for (let i = 1; i < cols; i++) {
    const x = Math.round(i * cw) - 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let i = 1; i < rows; i++) {
    const y = Math.round(i * rh) - 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Cell labels in the top-left of each cell (small, high-contrast).
  const fontPx = Math.max(10, Math.min(16, Math.floor(Math.min(cw, rh) * 0.28)));
  ctx.font = `bold ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const label = `${colLabels[c]}${rowLabels[r]}`;
      const x = c * cw + 3;
      const y = r * rh + 2;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.strokeText(label, x, y);
      ctx.fillStyle = "rgba(200,20,40,0.95)";
      ctx.fillText(label, x, y);
    }
  }

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.9),
    info: { cols, rows, colLabels, rowLabels },
  };
}

// Convert an AI-returned cell like "H14" into (x%, y%) using the grid dims.
export function cellToPercent(cell: string, cols: number, rows: number): { x: number; y: number } | null {
  const m = /^([A-Za-z]{1,2})\s*(\d{1,3})$/.exec(cell.trim());
  if (!m) return null;
  const letters = m[1].toUpperCase();
  let colIdx = 0;
  if (letters.length === 1) colIdx = letters.charCodeAt(0) - 65;
  else colIdx = (letters.charCodeAt(0) - 64) * 26 + (letters.charCodeAt(1) - 65);
  const rowIdx = parseInt(m[2], 10) - 1;
  if (colIdx < 0 || colIdx >= cols || rowIdx < 0 || rowIdx >= rows) return null;
  return {
    x: Math.round(((colIdx + 0.5) / cols) * 1000) / 10,
    y: Math.round(((rowIdx + 0.5) / rows) * 1000) / 10,
  };
}
