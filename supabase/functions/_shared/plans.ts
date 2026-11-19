// Plan prices in Stripe (test mode). Yearly is 11 months for the price of 12, so customers get one month free.
export type Interval = "month" | "year";

export const MONTHLY_PRICES: Record<string, string> = {
  starter: "price_1UZtVKGbMox0LPSQjpv4SOaS", // £19.99 / month
  standard: "price_1UZtVLGbMox0LPSQPSrc3pjW", // £39.99 / month
  pro: "price_1UZtVMGbMox0LPSQoSRlBZcr", // £59.99 / month
};
export const ANNUAL_PRICES: Record<string, string> = {
  starter: "price_1UdWocGbMox0LPSQSwuNn59x", // £219.89 / year
  standard: "price_1UdWocGbMox0LPSQ0lLP0wyZ", // £439.89 / year
  pro: "price_1UdWodGbMox0LPSQxFBKpKMS", // £659.89 / year
};
export const ANNUAL_MONTHS_PAID = 11;
export const yearlyPence = (monthlyPence: number) => monthlyPence * ANNUAL_MONTHS_PAID;

export function priceFor(plan: string, interval: Interval): string | undefined {
  const table = interval === "month" ? MONTHLY_PRICES : interval === "year" ? ANNUAL_PRICES : undefined;
  return table?.[plan];
}

export function planFromPrice(priceId: string | undefined): { plan: string; interval: Interval } | null {
  for (const [plan, id] of Object.entries(MONTHLY_PRICES)) if (id === priceId) return { plan, interval: "month" };
  for (const [plan, id] of Object.entries(ANNUAL_PRICES)) if (id === priceId) return { plan, interval: "year" };
  return null;
}

const MONTHLY_PENCE: Record<string, number> = { starter: 1999, standard: 3999, pro: 5999 };
const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;
export function priceLabel(plan: string, interval: Interval): { amount: string; per: string } | null {
  const m = MONTHLY_PENCE[plan];
  if (!m) return null;
  return interval === "year" ? { amount: pounds(yearlyPence(m)), per: "a year" } : { amount: pounds(m), per: "a month" };
}
