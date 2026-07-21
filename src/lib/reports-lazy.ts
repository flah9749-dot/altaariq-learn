// Lazy wrappers — dynamically import the heavy reports bundle (xlsx + jspdf + html2canvas-pro)
// so it only loads when a user actually clicks an export button.

export async function exportToExcel<T extends Record<string, any>>(rows: T[], filename: string, sheetName = "Sheet1") {
  const m = await import("./reports");
  return m.exportToExcel(rows, filename, sheetName);
}

export async function exportToPdf(opts: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  filename: string;
}) {
  const m = await import("./reports");
  return m.exportToPdf(opts);
}
