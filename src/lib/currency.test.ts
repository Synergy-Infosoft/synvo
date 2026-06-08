import { describe, expect, it } from "vitest";
import {
  DEAL_CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  formatCurrency,
  formatCurrencyShort,
} from "./currency";

describe("currency helpers", () => {
  it("uses INR as the default deal currency", () => {
    expect(DEFAULT_CURRENCY).toBe("INR");
    expect(DEAL_CURRENCY_OPTIONS[0].value).toBe("INR");
  });

  it("formats INR values with Indian digit grouping", () => {
    const formatted = formatCurrency(123456);

    expect(formatted).toContain("1,23,456");
    expect(formatted).not.toContain("$");
    expect(formatted).not.toContain("EUR");
    expect(formatted).not.toContain("GBP");
  });

  it("still supports non-default deal currencies", () => {
    expect(formatCurrency(1000, "USD")).toBe("$1,000");
  });

  it("falls back to INR for missing currency values", () => {
    const formatted = formatCurrency(5000, null);

    expect(formatted).toContain("5,000");
    expect(formatted).not.toContain("$");
  });

  it("shortens INR values using lakh/crore labels", () => {
    expect(formatCurrencyShort(150000)).toMatch(/1\.5L$/);
    expect(formatCurrencyShort(12500000)).toMatch(/1\.3Cr$/);
  });
});
