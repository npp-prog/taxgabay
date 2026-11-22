import type { TaxRule, TaxType, TaxpayerCategory } from "../types";

export const TRAIN_URL = "https://www.bir.gov.ph/";

/** Builds a seed rule row. Every seed row starts unverified. */
export function rule<V>(
  id: string,
  rule_key: string,
  tax_type: TaxType,
  taxpayer_category: TaxpayerCategory,
  value: V,
  effective_from: string,
  effective_to: string | null,
  legal_basis: string,
  source_url: string | null = null,
  note?: string,
): TaxRule<V> {
  return {
    id,
    rule_key,
    tax_type,
    taxpayer_category,
    value,
    effective_from,
    effective_to,
    legal_basis,
    source_url,
    last_verified_at: null,
    needs_verification: true,
    ...(note ? { note } : {}),
  };
}
