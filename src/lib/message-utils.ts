import {
  FileText, Image as ImageIcon, FileArchive, FileVideo, FileAudio,
  FileSpreadsheet, Presentation, File, FileCode,
} from "lucide-react";

export function fileIconFor(mime: string | null | undefined) {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return ImageIcon;
  if (m.startsWith("video/")) return FileVideo;
  if (m.startsWith("audio/")) return FileAudio;
  if (m.includes("pdf")) return FileText;
  if (m.includes("sheet") || m.includes("excel") || m.includes("csv")) return FileSpreadsheet;
  if (m.includes("presentation") || m.includes("powerpoint")) return Presentation;
  if (m.includes("zip") || m.includes("rar") || m.includes("7z") || m.includes("archive")) return FileArchive;
  if (m.includes("word") || m.includes("document")) return FileText;
  if (m.includes("json") || m.includes("xml") || m.includes("html")) return FileCode;
  return File;
}

export function humanSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatChatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    const yest = new Date(Date.now() - 86400_000);
    if (d.toDateString() === yest.toDateString()) return "أمس";
    return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
  } catch { return ""; }
}

export function formatChatDetailedTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "الآن";
  if (min < 60) return `منذ ${min} د`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `منذ ${hr} س`;
  const days = Math.floor(hr / 24);
  return `منذ ${days} يوم`;
}

export function isImageMime(mime: string | null | undefined): boolean {
  return !!mime && mime.toLowerCase().startsWith("image/");
}

// Compress image via canvas
export async function compressImage(file: File, maxSize = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality));
  } catch { return file; }
}

export type TemplateVars = Record<string, string | number | undefined | null>;

export function applyTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export const EMOJIS = [
  "😀","😁","😂","🤣","😊","😍","🥰","😘","😎","🤩",
  "🥳","🤔","😇","🙃","😉","😌","🤗","🤓","🧐","🤨",
  "😐","😒","😔","😞","😢","😭","😤","😠","😡","🤯",
  "👍","👏","🙏","💪","👌","✌️","🤝","❤️","💯","🔥",
  "⭐","🌟","🎉","🎊","🏆","🥇","🥈","🥉","🎯","📚",
  "✅","❌","⚠️","💡","📝","📢","📌","🗓️","⏰","🎓",
];
