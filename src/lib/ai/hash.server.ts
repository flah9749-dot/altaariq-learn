// SHA-256 helper (works on Cloudflare Workers via SubtleCrypto).
export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Stable stringify: sorted keys so identical objects produce identical hashes. */
export function stableStringify(v: unknown): string {
  const seen = new WeakSet();
  const walk = (x: unknown): unknown => {
    if (x === null || typeof x !== "object") return x;
    if (seen.has(x as object)) return null;
    seen.add(x as object);
    if (Array.isArray(x)) return x.map(walk);
    const obj = x as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) out[k] = walk(obj[k]);
    return out;
  };
  return JSON.stringify(walk(v));
}
