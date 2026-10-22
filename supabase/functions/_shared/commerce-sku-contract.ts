import commerceSkuContract from "../../../docs/commerce/commerce-sku-contract.v1.json" with { type: "json" };

export type CanonicalSkuKey = "sku_id" | "sku" | "marketplace_listing_id";
export type CanonicalSkuResolution = {
  key: CanonicalSkuKey;
  value: string;
  rawValue: string;
};

export const COMMERCE_SKU_CONTRACT = commerceSkuContract;

export function normalizeCanonicalSku(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const mappings = COMMERCE_SKU_CONTRACT.offer_mappings as Record<string, string>;
  return mappings[raw] || raw;
}

export function resolveCanonicalSku(
  metadata: Record<string, unknown> | null | undefined
): CanonicalSkuResolution | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  for (const key of COMMERCE_SKU_CONTRACT.key_priority as CanonicalSkuKey[]) {
    const candidate = metadata[key];
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    const rawValue = candidate.trim();
    return {
      key,
      rawValue,
      value: key === "marketplace_listing_id" ? rawValue : normalizeCanonicalSku(rawValue)
    };
  }
  return null;
}
