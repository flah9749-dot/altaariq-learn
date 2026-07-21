// Server-only helper to validate Bearer tokens for /api/public/v1/*
import type { SupabaseClient } from "@supabase/supabase-js";

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type ApiAuth = { ok: true; tokenId: string; scopes: string[] } | { ok: false; status: number; message: string };

export async function authenticateApiRequest(request: Request): Promise<ApiAuth> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return { ok: false, status: 401, message: "Missing Bearer token" };
  const token = auth.slice(7).trim();
  if (!token) return { ok: false, status: 401, message: "Missing token" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hash = await sha256Hex(token);
  const { data: row, error } = await (supabaseAdmin as SupabaseClient)
    .from("api_tokens")
    .select("id, scopes, revoked_at, expires_at")
    .eq("token_hash", hash)
    .maybeSingle();

  if (error || !row) return { ok: false, status: 401, message: "Invalid token" };
  if ((row as any).revoked_at) return { ok: false, status: 401, message: "Token revoked" };
  if ((row as any).expires_at && new Date((row as any).expires_at) < new Date()) {
    return { ok: false, status: 401, message: "Token expired" };
  }
  await (supabaseAdmin as SupabaseClient)
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", (row as any).id);

  return { ok: true, tokenId: (row as any).id, scopes: ((row as any).scopes ?? []) as string[] };
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
  });
}
