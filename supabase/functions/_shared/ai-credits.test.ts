import { test } from "node:test";
import assert from "node:assert/strict";
import { creditPack } from "./ai-credits.ts";

// A tiny stand-in for the database: one unique key on purchases, and the credit counter.
function fakeDb() {
  const seen = new Set<string>();
  const credits: Record<string, number> = {};
  return {
    credits,
    from: (_t: string) => ({
      insert: async (row: any) => {
        if (seen.has(row.stripe_session_id)) return { error: { code: "23505" } };
        seen.add(row.stripe_session_id);
        return { error: null };
      },
    }),
    rpc: async (_fn: string, a: any) => { credits[a.p_user_id] = (credits[a.p_user_id] ?? 0) + a.p_qty; return { error: null }; },
  };
}
const session = (o: any = {}) => ({ id: "cs_1", payment_status: "paid", metadata: { kind: "ai_credits", user_id: "u1", qty: "25" }, ...o });

test("credits the pack once", async () => {
  const db = fakeDb();
  assert.equal(await creditPack(db as any, session()), "credited");
  assert.equal(db.credits.u1, 25);
});
test("a repeated webhook for the same session adds nothing", async () => {
  const db = fakeDb();
  await creditPack(db as any, session());
  assert.equal(await creditPack(db as any, session()), "duplicate");
  assert.equal(db.credits.u1, 25);
});
test("ignores unpaid sessions and other kinds of payment", async () => {
  const db = fakeDb();
  assert.equal(await creditPack(db as any, session({ payment_status: "unpaid" })), "ignored");
  assert.equal(await creditPack(db as any, session({ metadata: { kind: "shop", user_id: "u1", qty: "25" } })), "ignored");
  assert.deepEqual(db.credits, {});
});
test("ignores a missing user or a quantity outside 1 to 1000", async () => {
  const db = fakeDb();
  assert.equal(await creditPack(db as any, session({ metadata: { kind: "ai_credits", qty: "25" } })), "ignored");
  assert.equal(await creditPack(db as any, session({ id: "cs_2", metadata: { kind: "ai_credits", user_id: "u1", qty: "0" } })), "ignored");
  assert.equal(await creditPack(db as any, session({ id: "cs_3", metadata: { kind: "ai_credits", user_id: "u1", qty: "5000" } })), "ignored");
  assert.equal(await creditPack(db as any, session({ id: "cs_4", metadata: { kind: "ai_credits", user_id: "u1", qty: "abc" } })), "ignored");
  assert.deepEqual(db.credits, {});
});
