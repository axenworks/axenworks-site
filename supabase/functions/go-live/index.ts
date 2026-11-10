// Admin-only: marks a customer's site as live and starts their free trial.
// The subscription has been waiting in a placeholder trial since checkout;
// this sets the real trial end to today + the customer's locked-in trial days.
import { admin, cors, slugify, SITE_DOMAIN, stripe } from "../_shared/stripe.ts";

const RESERVED = ["www","admin","api","app","mail","email","help","support","account","shop","store","blog","status","print","grow","digital"];

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = { ...cors(origin), "Content-Type": "application/json" };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  try {
    const db = admin();
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await db.auth.getUser(token);
    if (!auth?.user) return reply(401, { error: "Please log in again." });
    const { data: isAdmin } = await db.from("admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
    if (!isAdmin) return reply(403, { error: "Admins only." });

    const { project_id, subdomain: wanted } = await req.json().catch(() => ({}));
    const { data: project } = await db.from("projects").select("*").eq("id", project_id).maybeSingle();
    if (!project) return reply(404, { error: "Project not found." });
    if (project.status === "live") return reply(409, { error: "This site is already live." });

    const { data: sub } = await db.from("subscriptions").select("*").eq("user_id", project.user_id).maybeSingle();
    if (!sub?.stripe_subscription_id || !["trialing", "active", "past_due"].includes(sub.status)) {
      return reply(409, { error: "This customer doesn't have an active plan." });
    }

    // Choose the web address: the admin's choice, the existing one, or one from the business name.
    let subdomain: string = project.subdomain ?? "";
    if (wanted) {
      subdomain = slugify(String(wanted));
      if (RESERVED.includes(subdomain)) return reply(400, { error: "That web address is reserved. Please pick another." });
      const { data: taken } = await db.from("projects").select("id").eq("subdomain", subdomain).neq("id", project.id).maybeSingle();
      if (taken) return reply(409, { error: `${subdomain}.${SITE_DOMAIN} is already used by another customer.` });
    }
    if (!subdomain) {
      const base = slugify(project.answers?.business_name || project.site?.business?.name || "site");
      for (let i = 1; i < 100; i++) {
        const tryName = i === 1 ? base : `${base.slice(0, 37)}-${i}`;
        if (RESERVED.includes(tryName)) continue;
        const { data: taken } = await db.from("projects").select("id").eq("subdomain", tryName).neq("id", project.id).maybeSingle();
        if (!taken) { subdomain = tryName; break; }
      }
    }
    if (!subdomain) return reply(409, { error: "Couldn't pick a web address. Please choose one." });

    let trialEnd: string | null = null;
    if (sub.status === "trialing") {
      const days = Math.max(0, Number(sub.trial_days ?? 0));
      const end = days > 0 ? String(Math.floor(Date.now() / 1000) + days * 86400) : "now";
      const updated = await stripe(`subscriptions/${sub.stripe_subscription_id}`, {
        trial_end: end,
        proration_behavior: "none",
        "metadata[awaiting_go_live]": "",
      });
      trialEnd = updated.trial_end ? new Date(updated.trial_end * 1000).toISOString() : null;
      await db.from("subscriptions").update({
        status: updated.status, trial_end: trialEnd, updated_at: new Date().toISOString(),
      }).eq("user_id", project.user_id);
    }

    const { error } = await db.from("projects")
      .update({ status: "live", went_live_at: new Date().toISOString(), subdomain }).eq("id", project.id);
    if (error) throw error;
    return reply(200, { ok: true, trial_end: trialEnd, subdomain, url: `https://${subdomain}.${SITE_DOMAIN}` });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "Couldn't make the site live. Please try again." });
  }
});
