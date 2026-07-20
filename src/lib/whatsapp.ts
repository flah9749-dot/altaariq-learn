// Build a wa.me link for a parent phone / whatsapp number.
// Strips everything but digits so wa.me accepts it.
export function whatsappUrl(rawNumber: string | null | undefined, message?: string): string | null {
  if (!rawNumber) return null;
  const digits = rawNumber.replace(/\D/g, "");
  if (digits.length < 6) return null;
  const base = `https://wa.me/${digits}`;
  if (message) return `${base}?text=${encodeURIComponent(message)}`;
  return base;
}
