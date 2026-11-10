// Public, read-only website content.
//  ?token=<preview token>  a customer's draft, for their private preview link.
//  ?host=<subdomain>       a live website, served at <subdomain>.axencraft.co.uk.
//  ?domain=<their domain>  a live website on the customer's own domain.
//                          Add &meta=1 to get just which template folder to use,
//                          or { offline: true } if the plan is unpaid or cancelled.
import { admin, siteFor } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": siteFor(origin),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  const notFound = () => new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  const params = new URL(req.url).searchParams;
  const db = admin();

  const host = (params.get("host") ?? "").toLowerCase();
  const domain = (params.get("domain") ?? "").toLowerCase().replace(/^www\./, "");
  if (host || domain) {
    let q = db.from("projects").select("site,template,user_id,status");
    if (host) {
      if (!/^[a-z0-9]([a-z0-9-]{0,40}[a-z0-9])?$/.test(host)) return notFound();
      q = q.eq("subdomain", host);
    } else {
      if (!/^[a-z0-9.-]{3,253}$/.test(domain)) return notFound();
      q = q.eq("custom_domain", domain);
    }
    const { data: p } = await q.maybeSingle();
    if (!p || p.status !== "live" || !p.site || !p.template) return notFound();
    const { data: sub } = await db.from("subscriptions").select("plan,status,past_due_since").eq("user_id", p.user_id).maybeSingle();
    if (!sub?.plan) return notFound();
    // Billing rules: online while trialing or paid. Failed payments get a grace period.
    // Cancelled plans stay online until the paid period ends (Stripe only marks them
    // cancelled at that point), then go offline.
    let online = ["trialing", "active"].includes(sub.status);
    if (sub.status === "past_due") {
      const { data: g } = await db.from("app_settings").select("value").eq("key", "grace_days").maybeSingle();
      const grace = Number(g?.value ?? 7) || 7;
      const since = sub.past_due_since ? new Date(sub.past_due_since).getTime() : Date.now();
      online = Date.now() < since + grace * 86400000;
    }
    if (!online) return new Response(JSON.stringify({ offline: true }), { status: params.get("meta") ? 200 : 404, headers });
    if (params.get("meta")) return new Response(JSON.stringify({ folder: `${sub.plan}-${p.template}` }), { headers });
    return new Response(JSON.stringify(p.site), { headers });
  }

  headers["X-Robots-Tag"] = "noindex";
  const token = params.get("token") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) return notFound();
  const { data } = await db.from("projects").select("site").eq("preview_token", token).maybeSingle();
  if (!data?.site) return notFound();
  return new Response(JSON.stringify(data.site), { headers });
});
