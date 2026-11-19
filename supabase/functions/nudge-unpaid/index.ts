// One friendly reminder to people who made an account but didn't choose a plan.
// Called every hour by a database job, which sends the cron_secret setting in x-cron-secret.
import { admin } from "../_shared/stripe.ts";
import { nudgeTargets, reminderHtml } from "../_shared/growth.ts";

Deno.serve(async (req) => {
  const db = admin();
  const { data: cfg } = await db.from("app_settings").select("key,value").in("key", ["cron_secret", "email_from", "reply_to", "owner_email"]);
  const s: Record<string, string> = {};
  for (const r of cfg ?? []) s[r.key] = r.value;
  if (!s.cron_secret || req.headers.get("x-cron-secret") !== s.cron_secret) return new Response("no", { status: 401 });
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || !s.email_from) return new Response("email not set up", { status: 500 });

  const [{ data: profiles }, { data: subs }, { data: admins }] = await Promise.all([
    db.from("profiles").select("id,email,created_at,nudged_at").is("nudged_at", null),
    db.from("subscriptions").select("user_id"),
    db.from("admins").select("user_id"),
  ]);
  const targets = nudgeTargets(profiles ?? [], new Set((subs ?? []).map((x: any) => x.user_id)), new Set((admins ?? []).map((a: any) => a.user_id)));

  let sent = 0;
  for (const p of targets.slice(0, 50)) {
    // Mark first, so a slow send can't cause a second email on the next run.
    const { data: claimed } = await db.from("profiles").update({ nudged_at: new Date().toISOString() })
      .eq("id", p.id).is("nudged_at", null).select("id");
    if (!claimed?.length) continue;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: s.email_from, to: [p.email], reply_to: s.reply_to || s.owner_email,
        subject: "Your website is one step away", html: reminderHtml("https://axencraft.co.uk/account.html") }),
    });
    if (res.ok) sent++;
    else { console.error("resend", res.status, await res.text()); await db.from("profiles").update({ nudged_at: null }).eq("id", p.id); }
  }
  return new Response(JSON.stringify({ due: targets.length, sent }), { headers: { "Content-Type": "application/json" } });
});
