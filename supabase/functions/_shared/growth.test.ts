import { test } from "node:test";
import assert from "node:assert/strict";
import { postageFor, newsRecipients, newsHtml, nudgeTargets } from "./growth.ts";

const P = { pence: 399, free_over_pence: 2500 };

test("postage is charged below the free threshold", () => {
  assert.equal(postageFor(2499, P), 399);
});

test("postage is free at or above the threshold", () => {
  assert.equal(postageFor(2500, P), 0);
  assert.equal(postageFor(9000, P), 0);
});

test("postage is always charged when no threshold is set", () => {
  assert.equal(postageFor(100000, { pence: 399 }), 399);
});

test("news recipients: dedupes emails, skips unsubscribed, filters by interest", () => {
  const rows = [
    { email: "A@x.com", interest: "digital,print", unsubscribed_at: null, unsubscribe_token: "t1" },
    { email: "a@x.com ", interest: "grow", unsubscribed_at: null, unsubscribe_token: "t2" },
    { email: "b@x.com", interest: "grow", unsubscribed_at: null, unsubscribe_token: "t3" },
    { email: "c@x.com", interest: "digital", unsubscribed_at: "2026-11-01", unsubscribe_token: "t4" },
    { email: "not-an-email", interest: "digital", unsubscribed_at: null, unsubscribe_token: "t5" },
  ];
  assert.deepEqual(newsRecipients(rows, "all").map((r) => r.email), ["a@x.com", "b@x.com"]);
  assert.deepEqual(newsRecipients(rows, "grow").map((r) => r.email), ["a@x.com", "b@x.com"]);
  assert.deepEqual(newsRecipients(rows, "digital").map((r) => r.email), ["a@x.com"]);
});

test("a person who unsubscribed once is never emailed, even if they signed up twice", () => {
  const rows = [
    { email: "a@x.com", interest: "digital", unsubscribed_at: "2026-11-01", unsubscribe_token: "t1" },
    { email: "a@x.com", interest: "grow", unsubscribed_at: null, unsubscribe_token: "t2" },
  ];
  assert.deepEqual(newsRecipients(rows, "all"), []);
});

test("news email escapes text, splits paragraphs and includes the unsubscribe link", () => {
  const html = newsHtml("Hello <b>you</b>\n\nSecond para", "https://axencraft.co.uk/unsub?t=abc");
  assert.match(html, /Hello &lt;b&gt;you&lt;\/b&gt;/);
  assert.equal((html.match(/<p /g) ?? []).length >= 2, true);
  assert.match(html, /unsub\?t=abc/);
  assert.match(html, /Stockleigh English/);
});

test("follow-up goes once, 24h to 7 days after sign-up, only to people with no plan", () => {
  const now = new Date("2026-12-10T12:00:00Z");
  const h = (n: number) => new Date(now.getTime() - n * 3600_000).toISOString();
  const profiles = [
    { id: "new", email: "new@x.com", created_at: h(2), nudged_at: null },
    { id: "due", email: "due@x.com", created_at: h(30), nudged_at: null },
    { id: "paid", email: "paid@x.com", created_at: h(30), nudged_at: null },
    { id: "done", email: "done@x.com", created_at: h(30), nudged_at: h(1) },
    { id: "old", email: "old@x.com", created_at: h(24 * 9), nudged_at: null },
    { id: "boss", email: "boss@x.com", created_at: h(30), nudged_at: null },
  ];
  const t = nudgeTargets(profiles, new Set(["paid"]), new Set(["boss"]), now);
  assert.deepEqual(t.map((p) => p.id), ["due"]);
});
