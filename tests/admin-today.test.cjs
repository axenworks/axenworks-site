const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildToday } = require('../admin-today.js');
const now = new Date('2026-12-10T12:00:00Z');
const daysAgo = (d) => new Date(now - d * 864e5).toISOString();

test('websites waiting for a draft are listed soonest-due first, with days left', () => {
  const customers = [
    { id: 'a', email: 'a@x', stage: 'submitted', project: { submitted_at: daysAgo(2), answers: { business_name: 'Alpha' } }, changes: [] },
    { id: 'b', email: 'b@x', stage: 'submitted', project: { submitted_at: daysAgo(6), answers: {} }, changes: [] },
    { id: 'c', email: 'c@x', stage: 'live', project: { submitted_at: daysAgo(30), answers: {} }, changes: [] },
  ];
  const t = buildToday(customers, [], now);
  assert.deepEqual(t.sites.map((s) => [s.id, s.daysLeft]), [['b', 1], ['a', 5]]);
  assert.equal(t.sites[1].name, 'Alpha');
  assert.equal(t.sites[0].name, 'b@x');
});

test('a draft past 7 days shows as overdue (negative days left)', () => {
  const t = buildToday([{ id: 'a', email: 'a@x', stage: 'submitted', project: { submitted_at: daysAgo(9), answers: {} }, changes: [] }], [], now);
  assert.equal(t.sites[0].daysLeft, -2);
});

test('open change requests are listed oldest first; done ones are not', () => {
  const customers = [{ id: 'a', email: 'a@x', stage: 'live', project: { answers: {} }, changes: [
    { id: 1, status: 'requested', created_at: daysAgo(1), message: 'new' },
    { id: 2, status: 'in_progress', created_at: daysAgo(3), message: 'old' },
    { id: 3, status: 'done', created_at: daysAgo(5), message: 'x' },
  ] }];
  assert.deepEqual(buildToday(customers, [], now).changes.map((c) => c.id), [2, 1]);
});

test('shop orders to make are paid or printing, oldest first, with days left to dispatch', () => {
  const orders = [
    { ref: 'A', status: 'paid', paid_at: daysAgo(1) },
    { ref: 'B', status: 'printing', paid_at: daysAgo(5) },
    { ref: 'C', status: 'dispatched', paid_at: daysAgo(6) },
  ];
  assert.deepEqual(buildToday([], orders, now).orders.map((o) => [o.ref, o.daysLeft]), [['B', 2], ['A', 6]]);
});

test('counts new accounts this week that have no plan', () => {
  const customers = [
    { id: 'a', email: 'a@x', stage: 'no_plan', joined: daysAgo(2), changes: [] },
    { id: 'b', email: 'b@x', stage: 'no_plan', joined: daysAgo(10), changes: [] },
    { id: 'c', email: 'c@x', stage: 'draft', joined: daysAgo(1), changes: [] },
  ];
  assert.equal(buildToday(customers, [], now).newNoPlan, 1);
});
