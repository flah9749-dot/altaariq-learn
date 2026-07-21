import { createServerFn } from "@tanstack/react-start";

/** Returns the Firebase Web apiKey from server-side secret. Safe to expose (public Firebase config). */
export const getFirebaseApiKey = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.GOOGLE_API_KEY ?? "";
  return { apiKey: key };
});
