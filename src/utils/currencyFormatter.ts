/**
 * WhatIf Decision Simulation — Currency & INR Localization Utility
 *
 * Implements Indian Rupee (₹) formatting and conversion for synthetic infrastructure cost estimates.
 * Reference Exchange Rate: 1 USD = ₹84.00 INR (Configurable benchmark reference rate).
 * Discloses that all costs are model-based planning estimates, not contractor bids.
 */

export const USD_TO_INR_REFERENCE_RATE = 84.0; // Benchmark reference exchange rate: 1 USD ~ ₹84.0 INR

export interface INRConversionResult {
  inrTotal: number;
  formatted: string;
  formattedFull: string;
  usdOriginalMillion: number;
  disclosure: string;
}

/**
 * Converts a USD-denominated estimate in Millions ($M) to Indian Rupees (₹).
 * e.g., 10.8 ($10.8M USD) -> 10.8 * 1,000,000 * 84 = ₹90,72,00,000 = ₹90.7 crore
 */
export function convertUsdMillionToINR(usdMillion: number): INRConversionResult {
  const safeUsdMillion = Number.isFinite(usdMillion) ? Math.max(0, usdMillion) : 0;
  const inrTotal = safeUsdMillion * 1_000_000 * USD_TO_INR_REFERENCE_RATE;

  let formatted = '';
  if (inrTotal >= 10_000_000) {
    // 1 crore = 10,000,000
    const crores = inrTotal / 10_000_000;
    formatted = `₹${crores >= 100 ? crores.toFixed(0) : crores.toFixed(1)} crore`;
  } else if (inrTotal >= 100_000) {
    // 1 lakh = 100,000
    const lakhs = inrTotal / 100_000;
    formatted = `₹${lakhs.toFixed(1)} lakh`;
  } else {
    formatted = `₹${Math.round(inrTotal).toLocaleString('en-IN')}`;
  }

  const formattedFull = `₹${Math.round(inrTotal).toLocaleString('en-IN')}`;
  const disclosure = `Model estimate based on benchmark conversion (1 USD ≈ ₹${USD_TO_INR_REFERENCE_RATE}). Not a contractor quotation.`;

  return {
    inrTotal,
    formatted,
    formattedFull,
    usdOriginalMillion: safeUsdMillion,
    disclosure
  };
}

/**
 * Formats a USD million cost value directly into clean INR display string.
 * @param usdMillion Cost in millions USD
 * @param options Display options
 */
export function formatCostEstimate(
  usdMillion: number,
  options?: {
    showTechnicalDetails?: boolean;
    includeLabel?: boolean;
  }
): string {
  if (usdMillion === undefined || usdMillion === null || !Number.isFinite(usdMillion) || usdMillion <= 0) {
    return 'Cost not estimated';
  }

  const converted = convertUsdMillionToINR(usdMillion);

  if (options?.showTechnicalDetails) {
    return `${converted.formatted} ($${usdMillion.toFixed(1)}M USD reference @ ₹${USD_TO_INR_REFERENCE_RATE}/USD)`;
  }

  if (options?.includeLabel) {
    return `Estimated cost: ${converted.formatted} (model estimate)`;
  }

  return converted.formatted;
}

/**
 * Formats an arbitrary INR amount in rupees with Indian number grouping and unit suffixes.
 */
export function formatINR(
  rupees: number,
  options?: {
    compact?: boolean;
    decimals?: number;
  }
): string {
  const safeRupees = Number.isFinite(rupees) ? Math.max(0, rupees) : 0;
  const decimals = options?.decimals ?? 1;

  if (options?.compact !== false) {
    if (safeRupees >= 10_000_000) {
      const cr = safeRupees / 10_000_000;
      return `₹${cr.toFixed(decimals)} crore`;
    }
    if (safeRupees >= 100_000) {
      const lk = safeRupees / 100_000;
      return `₹${lk.toFixed(decimals)} lakh`;
    }
  }

  return `₹${Math.round(safeRupees).toLocaleString('en-IN')}`;
}
