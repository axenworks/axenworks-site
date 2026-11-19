/* Builds the admin "Do today" list. Works in the browser (window.buildToday) and in Node tests. */
(function (root) {
  var DAY = 864e5, PROMISE_DAYS = 7;
  function daysSince(iso, now) { return Math.floor((now - new Date(iso)) / DAY); }

  function buildToday(customers, orders, now) {
    now = now || new Date();
    var sites = customers
      .filter(function (c) { return c.stage === 'submitted' && c.project && c.project.submitted_at; })
      .map(function (c) {
        var a = c.project.answers || {};
        return { id: c.id, name: a.business_name || c.email, daysLeft: PROMISE_DAYS - daysSince(c.project.submitted_at, now), customer: c };
      })
      .sort(function (x, y) { return x.daysLeft - y.daysLeft; });

    var changes = [];
    customers.forEach(function (c) {
      (c.changes || []).forEach(function (r) {
        if (r.status === 'requested' || r.status === 'in_progress') {
          var a = (c.project && c.project.answers) || {};
          changes.push({ id: r.id, name: a.business_name || c.email, message: r.message || '', created_at: r.created_at, ageDays: daysSince(r.created_at, now), customer: c });
        }
      });
    });
    changes.sort(function (x, y) { return new Date(x.created_at) - new Date(y.created_at); });

    var toMake = (orders || [])
      .filter(function (o) { return (o.status === 'paid' || o.status === 'printing') && o.paid_at; })
      .map(function (o) { return { ref: o.ref, status: o.status, name: o.name || '', daysLeft: PROMISE_DAYS - daysSince(o.paid_at, now) }; })
      .sort(function (x, y) { return x.daysLeft - y.daysLeft; });

    var newNoPlan = customers.filter(function (c) {
      return c.stage === 'no_plan' && c.joined && daysSince(c.joined, now) < 7;
    }).length;

    return { sites: sites, changes: changes, orders: toMake, newNoPlan: newNoPlan };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { buildToday: buildToday };
  else root.buildToday = buildToday;
})(this);
