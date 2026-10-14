export function pickStripeApiKey(apiKey, secretKey) {
  const primary = typeof apiKey === "string" ? apiKey.trim() : "";
  if (primary.length > 0) return primary;

  const fallback = typeof secretKey === "string" ? secretKey.trim() : "";
  if (fallback.length > 0) return fallback;

  return null;
}
