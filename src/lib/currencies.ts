
import type { Currency } from './types';

export const allCurrencies: Omit<Currency, 'id'>[] = [
    { name: "US Dollar", code: "USD", symbol: "$" },
    { name: "Euro", code: "EUR", symbol: "€" },
    { name: "Japanese Yen", code: "JPY", symbol: "¥" },
    { name: "British Pound", code: "GBP", symbol: "£" },
    { name: "Australian Dollar", code: "AUD", symbol: "A$" },
    { name: "Canadian Dollar", code: "CAD", symbol: "C$" },
    { name: "Swiss Franc", code: "CHF", symbol: "CHF" },
    { name: "Chinese Yuan", code: "CNY", symbol: "¥" },
    { name: "Swedish Krona", code: "SEK", symbol: "kr" },
    { name: "New Zealand Dollar", code: "NZD", symbol: "NZ$" },
    { name: "Mexican Peso", code: "MXN", symbol: "$" },
    { name: "Singapore Dollar", code: "SGD", symbol: "S$" },
    { name: "Hong Kong Dollar", code: "HKD", symbol: "HK$" },
    { name: "Norwegian Krone", code: "NOK", symbol: "kr" },
    { name: "South Korean Won", code: "KRW", symbol: "₩" },
    { name: "Turkish Lira", code: "TRY", symbol: "₺" },
    { name: "Russian Ruble", code: "RUB", symbol: "₽" },
    { name: "Indian Rupee", code: "INR", symbol: "₹" },
    { name: "Brazilian Real", code: "BRL", symbol: "R$" },
    { name: "South African Rand", code: "ZAR", symbol: "R" },
    { name: "Philippine Peso", code: "PHP", symbol: "₱" },
    { name: "Czech Koruna", code: "CZK", symbol: "Kč" },
    { name: "Indonesian Rupiah", code: "IDR", symbol: "Rp" },
    { name: "Malaysian Ringgit", code: "MYR", symbol: "RM" },
    { name: "Hungarian Forint", code: "HUF", symbol: "Ft" },
    { name: "Icelandic Krona", code: "ISK", symbol: "kr" },
    { name: "Croatian Kuna", code: "HRK", symbol: "kn" },
    { name: "Bulgarian Lev", code: "BGN", symbol: "лв" },
    { name: "Romanian Leu", code: "RON", symbol: "lei" },
    { name: "Danish Krone", code: "DKK", symbol: "kr" },
    { name: "Thai Baht", code: "THB", symbol: "฿" },
    { name: "Polish Zloty", code: "PLN", symbol: "zł" },
    { name: "Israeli New Shekel", code: "ILS", symbol: "₪" },
    { name: "United Arab Emirates Dirham", code: "AED", symbol: "د.إ" },
    { name: "Saudi Riyal", code: "SAR", symbol: "ر.س" },
    { name: "Qatari Riyal", code: "QAR", symbol: "ر.ق" },
    { name: "Egyptian Pound", code: "EGP", symbol: "E£" },
    { name: "Nigerian Naira", code: "NGN", symbol: "₦" },
    { name: "Argentine Peso", code: "ARS", symbol: "$" },
    { name: "Chilean Peso", code: "CLP", symbol: "$" },
    { name: "Colombian Peso", code: "COP", symbol: "$" },
    { name: "Peruvian Sol", code: "PEN", symbol: "S/." },
    { name: "Vietnamese Dong", code: "VND", symbol: "₫" },
    { name: "Ukrainian Hryvnia", code: "UAH", symbol: "₴" },
    { name: "Bangladeshi Taka", code: "BDT", symbol: "৳" },
    { name: "Pakistani Rupee", code: "PKR", symbol: "₨" },
    { name: "Sri Lankan Rupee", code: "LKR", symbol: "Rs" },
    { name: "Tunisian Dinar", code: "TND", symbol: "TND" },
    { name: "Algerian Dinar", code: "DZD", symbol: "د.ج" }
];

const currencyMap = new Map(allCurrencies.map(c => [c.code, c.symbol]));

export function getCurrencySymbol(currencyCode: string): string {
  return currencyMap.get(currencyCode) || "$";
}
