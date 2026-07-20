/**
 * Browser-side image compression using canvas.
 * No external deps. Skips non-images and animated formats (gif) untouched.
 *
 * Typical use: before uploading a chat image or an avatar, run through
 * compressImage() to cut bandwidth and storage cost by 60-90%.
 */

export interface CompressOptions {
  /** Max width or height in pixels. Aspect ratio preserved. */
  maxDimension?: number;
  /** JPEG/WebP quality 0-1. Default 0.82. */
  quality?: number;
  /** Output MIME. Defaults to "image/webp" when supported, else "image/jpeg". */
  mimeType?: string;
  /** If compressed result is larger than original, return the original. */
  keepBestOf?: boolean;
}

const isImage = (file: File) =>
  file.type.startsWith("image/") &&
  file.type !== "image/gif" && // preserve animation
  file.type !== "image/svg+xml"; // vector

const loadBitmap = (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
};

const supportsWebP = (() => {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
})();

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  if (typeof window === "undefined" || !isImage(file)) return file;

  const {
    maxDimension = 1600,
    quality = 0.82,
    mimeType = supportsWebP ? "image/webp" : "image/jpeg",
    keepBestOf = true,
  } = opts;

  try {
    const bitmap = await loadBitmap(file);
    const srcW = "width" in bitmap ? bitmap.width : (bitmap as HTMLImageElement).naturalWidth;
    const srcH = "height" in bitmap ? bitmap.height : (bitmap as HTMLImageElement).naturalHeight;
    if (!srcW || !srcH) return file;

    const scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
    const w = Math.round(srcW * scale);
    const h = Math.round(srcH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);

    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, mimeType, quality));
    if (!blob) return file;

    if (keepBestOf && blob.size >= file.size) return file;

    const ext = mimeType === "image/webp" ? ".webp" : ".jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}${ext}`, { type: mimeType, lastModified: Date.now() });
  } catch {
    return file;
  }
}

/**
 * Compress multiple images in parallel. Non-images pass through unchanged.
 */
export async function compressImages(files: File[] | FileList, opts?: CompressOptions): Promise<File[]> {
  const arr = Array.from(files);
  return Promise.all(arr.map((f) => compressImage(f, opts)));
}
