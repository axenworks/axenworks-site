// Public, read-only website content.
//  ?token=<preview token>  a customer's draft, for their private preview link.
//  ?host=<subdomain>       a live website, served at <subdomain>.axencraft.co.uk.
//                          Add &meta=1 to get just which template folder to use.
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
  if (host) {
    if (!/^[a-z0-9]([a-z0-9-]{0,40}[a-z0-9])?$/.test(host)) return notFound();
    const { data: p } = await db.from("projects").select("site,template,user_id,status").eq("subdomain", host).maybeSingle();
    if (!p || p.status !== "live" || !p.site || !p.template) return notFound();
    if (params.get("meta")) {
      const { data: sub } = await db.from("subscriptions").select("plan").eq("user_id", p.user_id).maybeSingle();
      if (!sub?.plan) return notFound();
      return new Response(JSON.stringify({ folder: `${sub.plan}-${p.template}` }), { headers });
    }
    return new Response(JSON.stringify(p.site), { headers });
  }

  headers["X-Robots-Tag"] = "noindex";
  const token = params.get("token") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) return notFound();
  const { data } = await db.from("projects").select("site").eq("preview_token", token).maybeSingle();
  if (!data?.site) return notFound();
  return new Response(JSON.stringify(data.site), { headers });
});
