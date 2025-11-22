
'use client';

// NOTE: These are static exchange rates for demonstration purposes.
// In a real-world application, you would fetch these from a reliable API.
const exchangeRatesToTND: Record<string, { rate: number, isUnofficial: boolean }> = {
  TND: { rate: 1, isUnofficial: false },
  USD: { rate: 3.12, isUnofficial: false },
  EUR: { rate: 3.35, isUnofficial: false },
  DZD: { rate: 1 / 75, isUnofficial: true }, // 1 TND = 75 DZD (black market rate)
  GBP: { rate: 3.95, isUnofficial: false },
  JPY: { rate: 0.02, isUnofficial: false },
  CAD: { rate: 2.28, isUnofficial: false },
  AUD: { rate: 2.05, isUnofficial: false },
  CHF: { rate: 3.45, isUnofficial: false },
};

/**
 * Converts an amount from a given currency to TND.
 * @param amount The amount to convert.
 * @param fromCurrency The currency code to convert from (e.g., 'USD').
 * @returns The converted amount in TND.
 */
export function convertToTND(amount: number, fromCurrency: string): number {
  const rateInfo = exchangeRatesToTND[fromCurrency];
  if (rateInfo === undefined) {
    console.warn(`Exchange rate for ${fromCurrency} not found. Defaulting to 1.`);
    return amount;
  }
  return amount * rateInfo.rate;
}

/**
 * Gets the exchange rate for a given currency to TND.
 * @param currencyCode The currency code (e.g., 'USD').
 * @returns The exchange rate info, or null if not found.
 */
export function getExchangeRate(currencyCode: string): { rate: number; isUnofficial: boolean } | null {
  const rateInfo = exchangeRatesToTND[currencyCode];
  if (rateInfo === undefined) {
    return null;
  }
  return rateInfo;
}

/**
 * Returns the base currency for the application.
 */
export function getBaseCurrency(): string {
  return 'TND';
}
