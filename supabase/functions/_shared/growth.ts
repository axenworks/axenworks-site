// Small pure rules for postage, the news list and the unpaid follow-up. No imports, so they run in tests and in Deno.

export type Postage = { pence: number; free_over_pence?: number };

// Postage for a basket. Free once the items reach free_over_pence (if set).
export function postageFor(subtotalPence: number, p: Postage): number {
  const free = Number(p.free_over_pence);
  if (Number.isFinite(free) && free > 0 && subtotalPence >= free) return 0;
  return Number(p.pence);
}

export type NewsRow = { email: string; interest: string | null; unsubscribed_at: string | null; unsubscribe_token: string };

// Who gets a news email. "all" or one studio (digital, print, grow). One email per address;
// anyone who has ever unsubscribed is left out.
export function newsRecipients(rows: NewsRow[], audience: string): { email: string; token: string }[] {
  const out = new Map<string, { email: string; token: string; picks: Set<string> }>();
  const stopped = new Set<string>();
  for (const r of rows) {
    const email = String(r.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
    if (r.unsubscribed_at) { stopped.add(email); continue; }
    const cur = out.get(email) ?? { email, token: r.unsubscribe_token, picks: new Set<string>() };
    for (const k of String(r.interest ?? "").split(",")) if (k.trim()) cur.picks.add(k.trim());
    out.set(email, cur);
  }
  return [...out.values()]
    .filter((r) => !stopped.has(r.email) && (audience === "all" || r.picks.has(audience)))
    .map(({ email, token }) => ({ email, token }));
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

// Plain text (blank line = new paragraph) into a simple branded email with the legal footer.
export function newsHtml(text: string, unsubscribeUrl: string): string {
  const paras = String(text).trim().split(/\n\s*\n/).map((p) =>
    `<p style="margin:0 0 14px">${esc(p.trim()).replace(/\n/g, "<br>").replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" style="color:#14503c">$1</a>')}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f3f5f0;padding:24px 12px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#15201b">
<div style="max-width:540px;margin:0 auto;background:#fff;border:1px solid #d3d9d0;border-radius:10px;padding:28px">
<div style="font-weight:800;font-size:18px;margin-bottom:18px;color:#14503c">Axencraft</div>
<div style="font-size:16px;line-height:1.55">${paras}</div>
</div>
<p style="max-width:540px;margin:16px auto 0;font-size:13px;line-height:1.5;color:#55605a;text-align:center">You're getting this because you joined the Axencraft news list.
<a href="${esc(unsubscribeUrl)}" style="color:#55605a">Unsubscribe</a>.<br>Axencraft, Upover, Stockleigh English, Crediton, EX17 4DD</p>
</body></html>`;
}

export type Profile = { id: string; email: string; created_at: string; nudged_at: string | null };

// Accounts that signed up 24 hours to 7 days ago, never bought a plan, aren't admins and haven't been reminded.
export function nudgeTargets(profiles: Profile[], paying: Set<string>, admins: Set<string>, now = new Date()): Profile[] {
  const age = (iso: string) => (now.getTime() - new Date(iso).getTime()) / 3600_000;
  return profiles.filter((p) =>
    p.email && !p.nudged_at && !paying.has(p.id) && !admins.has(p.id) && age(p.created_at) >= 24 && age(p.created_at) <= 24 * 7);
}

// The one-off reminder email to people who made an account but didn't choose a plan.
export function reminderHtml(accountUrl: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f3f5f0;padding:24px 12px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#15201b">
<div style="max-width:540px;margin:0 auto;background:#fff;border:1px solid #d3d9d0;border-radius:10px;padding:28px">
<div style="font-weight:800;font-size:18px;margin-bottom:18px;color:#14503c">Axencraft</div>
<h1 style="font-size:22px;line-height:1.25;margin:0 0 12px">Your website is one step away</h1>
<div style="font-size:16px;line-height:1.55">
<p style="margin:0 0 10px">You made an Axencraft account but haven't chosen a plan yet. When you're ready, pick a style and a plan, pay the £50 setup fee, and answer a few questions. We'll have your first draft ready within 7 days.</p>
<p style="margin:0 0 10px">You don't pay for your plan until your website is live, and paying yearly gets you a month free.</p>
</div>
<p style="margin:22px 0 4px"><a href="${esc(accountUrl)}" style="display:inline-block;background:#14503c;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px">Choose your plan</a></p>
<p style="font-size:14px;color:#55605a;margin:24px 0 0">If you have a question first, just reply. This is the only reminder we'll send.</p>
</div>
<p style="max-width:540px;margin:16px auto 0;font-size:13px;color:#55605a;text-align:center">Axencraft, Upover, Stockleigh English, Crediton, EX17 4DD</p>
</body></html>`;
}
