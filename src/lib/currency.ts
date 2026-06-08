export const DEFAULT_CURRENCY = "INR";

export const DEAL_CURRENCY_OPTIONS = [
  { value: "INR", label: "INR" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
] as const;

const currencyLocales: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "en-GB",
  GBP: "en-GB",
};

function normalizeCurrency(currency?: string | null): string {
  return currency?.trim() || DEFAULT_CURRENCY;
}

function localeForCurrency(currency?: string | null) {
  return currencyLocales[normalizeCurrency(currency)] ?? "en-IN";
}

export function formatCurrency(
  value: number,
  currency: string | null | undefined = DEFAULT_CURRENCY,
): string {
  const resolvedCurrency = normalizeCurrency(currency);

  return new Intl.NumberFormat(localeForCurrency(currency), {
    style: "currency",
    currency: resolvedCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function getCurrencySymbol(
  currency: string | null | undefined = DEFAULT_CURRENCY,
): string {
  const resolvedCurrency = normalizeCurrency(currency);
  const parts = new Intl.NumberFormat(localeForCurrency(currency), {
    style: "currency",
    currency: resolvedCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(0);

  return parts.find((part) => part.type === "currency")?.value ?? resolvedCurrency;
}

export function formatCurrencyShort(
  value: number,
  currency: string | null | undefined = DEFAULT_CURRENCY,
): string {
  const resolvedCurrency = normalizeCurrency(currency);
  const numericValue = Number(value || 0);
  const amount = Math.abs(numericValue);
  const sign = numericValue < 0 ? "-" : "";
  const symbol = getCurrencySymbol(resolvedCurrency);

  if (resolvedCurrency === "INR") {
    if (amount >= 10_000_000) return `${sign}${symbol}${compact(amount / 10_000_000)}Cr`;
    if (amount >= 100_000) return `${sign}${symbol}${compact(amount / 100_000)}L`;
    if (amount >= 1_000) return `${sign}${symbol}${compact(amount / 1_000)}k`;
    return formatCurrency(numericValue, resolvedCurrency);
  }

  if (amount >= 1_000_000) return `${sign}${symbol}${compact(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `${sign}${symbol}${compact(amount / 1_000)}k`;
  return formatCurrency(numericValue, resolvedCurrency);
}

function compact(value: number): string {
  const fixed = value.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}
