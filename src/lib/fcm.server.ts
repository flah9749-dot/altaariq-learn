/**
 * FCM HTTP v1 sender using Web Crypto for RS256 JWT signing.
 * Server-only. Reads FIREBASE_SERVICE_ACCOUNT (JSON string) from env.
 */

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  token_uri?: string;
}

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT env var is not set");
  const sa = JSON.parse(raw) as ServiceAccount;
  if (!sa.project_id || !sa.client_email || !sa.private_key) throw new Error("Invalid service account JSON");
  return sa;
}

function b64urlEncode(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else if (input instanceof Uint8Array) bytes = input;
  else bytes = new Uint8Array(input);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<{ token: string; projectId: string }> {
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) return { token: cachedToken.token, projectId: sa.project_id };

  const header = { alg: "RS256", typ: "JWT", kid: sa.private_key_id };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64urlEncode(JSON.stringify(header))}.${b64urlEncode(JSON.stringify(payload))}`;
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${b64urlEncode(sig)}`;

  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: j.access_token, expiresAt: now + j.expires_in };
  return { token: j.access_token, projectId: sa.project_id };
}

export interface FcmPayload {
  token: string;
  title: string;
  body: string;
  link?: string | null;
  data?: Record<string, string>;
}

export interface FcmSendResult {
  token: string;
  ok: boolean;
  invalidToken?: boolean;
  error?: string;
}

export async function sendFcm(payloads: FcmPayload[]): Promise<FcmSendResult[]> {
  if (!payloads.length) return [];
  const { token: accessToken, projectId } = await getAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const results = await Promise.all(payloads.map(async (p) => {
    try {
      const message: any = {
        token: p.token,
        webpush: {
          notification: {
            title: p.title,
            body: p.body,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            dir: "rtl",
            lang: "ar",
            data: { link: p.link ?? "/" },
          },
        },
        data: { ...(p.data ?? {}), title: p.title, body: p.body, link: p.link ?? "/" },
      };
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (res.ok) return { token: p.token, ok: true };
      const text = await res.text();
      // Detect unregistered / invalid token
      const invalid = res.status === 404 || res.status === 400 && /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/i.test(text);
      return { token: p.token, ok: false, invalidToken: invalid, error: `${res.status} ${text}` };
    } catch (e: any) {
      return { token: p.token, ok: false, error: e?.message ?? "network error" };
    }
  }));
  return results;
}
