import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Cache the platform default country code across the app (Egypt "20" as fallback).
let cached: string | null = null;
let inflight: Promise<string> | null = null;

async function fetchDefault(): Promise<string> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "platform.default_country_code")
      .maybeSingle();
    const raw = (data?.value as string | number | null | undefined) ?? "20";
    const digits = String(raw).replace(/\D/g, "") || "20";
    cached = digits;
    return digits;
  })();
  try { return await inflight; } finally { inflight = null; }
}

export function useDefaultCountryCode(): string {
  const [code, setCode] = useState<string>(cached ?? "20");
  useEffect(() => {
    let ok = true;
    fetchDefault().then((c) => { if (ok) setCode(c); }).catch(() => {});
    return () => { ok = false; };
  }, []);
  return code;
}

export function invalidateDefaultCountryCodeCache() {
  cached = null;
}
