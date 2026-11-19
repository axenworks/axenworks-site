import { test } from "node:test";
import assert from "node:assert/strict";
import { ANNUAL_PRICES, MONTHLY_PRICES, ANNUAL_MONTHS_PAID, priceFor, planFromPrice, yearlyPence } from "./plans.ts";

test("priceFor picks the monthly or yearly price for a plan", () => {
  assert.equal(priceFor("starter", "month"), MONTHLY_PRICES.starter);
  assert.equal(priceFor("pro", "year"), ANNUAL_PRICES.pro);
});

test("priceFor returns undefined for an unknown plan or interval", () => {
  assert.equal(priceFor("gold", "month"), undefined);
  assert.equal(priceFor("starter", "week" as never), undefined);
});

test("planFromPrice maps every monthly and yearly price back to plan and interval", () => {
  for (const plan of ["starter", "standard", "pro"]) {
    assert.deepEqual(planFromPrice(MONTHLY_PRICES[plan]), { plan, interval: "month" });
    assert.deepEqual(planFromPrice(ANNUAL_PRICES[plan]), { plan, interval: "year" });
  }
  assert.equal(planFromPrice("price_unknown"), null);
});

test("a year costs 11 months, so customers get one month free", () => {
  assert.equal(ANNUAL_MONTHS_PAID, 11);
  assert.equal(yearlyPence(1999), 21989);
  assert.equal(yearlyPence(3999), 43989);
  assert.equal(yearlyPence(5999), 65989);
});

test("priceLabel shows the amount and period for each plan and interval", async () => {
  const { priceLabel } = await import("./plans.ts");
  assert.deepEqual(priceLabel("starter", "month"), { amount: "£19.99", per: "a month" });
  assert.deepEqual(priceLabel("standard", "year"), { amount: "£439.89", per: "a year" });
  assert.equal(priceLabel("gold", "month"), null);
});
