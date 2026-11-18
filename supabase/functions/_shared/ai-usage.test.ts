import { test } from "node:test";
import assert from "node:assert/strict";
import { allowanceFor, decide, underAttemptLimit } from "./ai-usage.ts";

test("allowanceFor uses the setting for the plan", () => {
  assert.equal(allowanceFor("standard", { starter: 1, standard: 7, pro: 9 }), 7);
});
test("allowanceFor falls back to the defaults for missing or bad settings", () => {
  assert.equal(allowanceFor("starter", undefined), 20);
  assert.equal(allowanceFor("pro", "nonsense"), 100);
  assert.equal(allowanceFor("standard", { standard: -3 }), 50);
  assert.equal(allowanceFor("unknown-plan", {}), 20);
});
test("decide allows an edit under the monthly allowance without using a credit", () => {
  assert.deepEqual(decide({ allowance: 20, usedThisMonth: 5, credits: 0, usedToday: 1, dailyCap: 20 }), { ok: true, useCredit: false });
});
test("decide uses a credit once the allowance is used", () => {
  assert.deepEqual(decide({ allowance: 20, usedThisMonth: 20, credits: 3, usedToday: 1, dailyCap: 20 }), { ok: true, useCredit: true });
});
test("decide says no edits left when allowance and credits are both used", () => {
  assert.deepEqual(decide({ allowance: 20, usedThisMonth: 20, credits: 0, usedToday: 1, dailyCap: 20 }), { ok: false, reason: "no_edits_left" });
});
test("decide stops at the daily cap even with credits", () => {
  assert.deepEqual(decide({ allowance: 20, usedThisMonth: 5, credits: 50, usedToday: 20, dailyCap: 20 }), { ok: false, reason: "daily_cap" });
});

test("underAttemptLimit allows attempts below the hourly limit and blocks at it", () => {
  assert.equal(underAttemptLimit(0), true);
  assert.equal(underAttemptLimit(29), true);
  assert.equal(underAttemptLimit(30), false);
  assert.equal(underAttemptLimit(5, 5), false);
});
