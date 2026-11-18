// Allowance rules for AI edits (pure, tested). Numbers come from app_settings; these are the fallbacks.
export const DEFAULT_ALLOWANCE: Record<string, number> = { starter: 20, standard: 50, pro: 100 };

export function allowanceFor(plan: string, setting: unknown): number {
  const fallback = DEFAULT_ALLOWANCE[plan] ?? DEFAULT_ALLOWANCE.starter;
  const n = Number((setting && typeof setting === "object" ? (setting as Record<string, unknown>)[plan] : undefined) ?? NaN);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function decide(i: { allowance: number; usedThisMonth: number; credits: number; usedToday: number; dailyCap: number }):
  { ok: true; useCredit: boolean } | { ok: false; reason: "daily_cap" | "no_edits_left" } {
  if (i.usedToday >= i.dailyCap) return { ok: false, reason: "daily_cap" };
  if (i.usedThisMonth < i.allowance) return { ok: true, useCredit: false };
  if (i.credits > 0) return { ok: true, useCredit: true };
  return { ok: false, reason: "no_edits_left" };
}
