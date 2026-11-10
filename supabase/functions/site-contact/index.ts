// Delivers messages from customers' live websites (contact form, Pro booking form,
// Pro newsletter sign-up) to the business owner by email.
// Only our website router may call this: it adds a shared secret header and tells us
// which site the message came from (?host=<subdomain> or ?domain=<custom domain>).
// Spam protection: hidden honeypot field, per-visitor and per-site rate limits.
// No message content is stored; only a timestamp and a hashed IP for rate limiting.
import { admin } from "../_shared/stripe.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const clean = (v: unknown, max: number) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const db = admin();
  const settings = await db.from("app_settings").select("key,value").in("key", ["form_secret", "email_from", "grace_days"]);
  const get = (k: string) => (settings.data ?? []).find((r: any) => r.key === k)?.value;
  const secret = get("form_secret");
  if (!secret || req.headers.get("x-axc-secret") !== secret) return json(403, { error: "Forbidden" });

  const params = new URL(req.url).searchParams;
  const host = (params.get("host") ?? "").toLowerCase();
  const domain = (params.get("domain") ?? "").toLowerCase().replace(/^www\./, "");
  let q = db.from("projects").select("id,user_id,status,site");
  if (host && /^[a-z0-9]([a-z0-9-]{0,40}[a-z0-9])?$/.test(host)) q = q.eq("subdomain", host);
  else if (domain && /^[a-z0-9.-]{3,253}$/.test(domain)) q = q.eq("custom_domain", domain);
  else return json(400, { error: "Unknown website." });
  const { data: p } = await q.maybeSingle();
  if (!p || p.status !== "live" || !p.site) return json(404, { error: "This website isn't accepting messages right now." });

  const { data: sub } = await db.from("subscriptions").select("status,past_due_since").eq("user_id", p.user_id).maybeSingle();
  let online = ["trialing", "active"].includes(sub?.status ?? "");
  if (sub?.status === "past_due") {
    const grace = Number(get("grace_days") ?? 7) || 7;
    online = Date.now() < new Date(sub.past_due_since ?? Date.now()).getTime() + grace * 86400000;
  }
  if (!online) return json(404, { error: "This website isn't accepting messages right now." });

  const body = await req.json().catch(() => ({}));
  if (body.hp) return json(200, { ok: true }); // honeypot filled in: quietly ignore
  const kind = ["enquiry", "booking", "newsletter"].includes(body.kind) ? body.kind : "";
  if (!kind) return json(400, { error: "Unknown form." });
  const f = body.fields ?? {};
  const v = {
    name: clean(f.name, 120), email: clean(f.email, 200), phone: clean(f.phone, 40),
    service: clean(f.service, 120), message: clean(f.message, 5000),
    date: clean(f.date, 20), time: clean(f.time, 30), postcode: clean(f.postcode, 12),
  };
  if (!EMAIL.test(v.email)) return json(400, { error: "Please check your email address." });
  if (kind !== "newsletter" && !v.name) return json(400, { error: "Please add your name." });
  if (kind === "enquiry" && v.message.length < 2) return json(400, { error: "Please add a message." });

  // Rate limits: 5 per visitor per hour, 60 per website per day.
  const ip = (req.headers.get("x-axc-ip") ?? "").split(",")[0].trim() || "unknown";
  const ipHash = await sha256(ip + "|" + secret);
  const hourAgo = new Date(Date.now() - 3600000).toISOString(), dayAgo = new Date(Date.now() - 86400000).toISOString();
  const [{ count: mine }, { count: all }] = await Promise.all([
    db.from("form_events").select("id", { count: "exact", head: true }).eq("project_id", p.id).eq("ip_hash", ipHash).gte("created_at", hourAgo),
    db.from("form_events").select("id", { count: "exact", head: true }).eq("project_id", p.id).gte("created_at", dayAgo),
  ]);
  if ((mine ?? 0) >= 5 || (all ?? 0) >= 60) return json(429, { error: "Too many messages. Please try again later, or contact the business directly." });

  // Send to the business: their contact email, or the email on their account.
  const site = p.site ?? {};
  let to = clean(site.contact?.email, 200);
  if (!EMAIL.test(to)) {
    const { data: u } = await db.auth.admin.getUserById(p.user_id);
    to = u?.user?.email ?? "";
  }
  const key = Deno.env.get("RESEND_API_KEY");
  if (!to || !key) return json(500, { error: "Sorry, your message couldn't be sent. Please try again later." });

  const biz = clean(site.business_name, 80) || "your website";
  const row = (label: string, val: string) => val
    ? `<tr><td style="padding:6px 14px 6px 0;color:#585e69;vertical-align:top;white-space:nowrap">${esc(label)}</td><td style="padding:6px 0;white-space:pre-wrap">${esc(val)}</td></tr>` : "";
  const title = kind === "booking" ? "New booking request" : kind === "newsletter" ? "New newsletter sign-up" : "New message from your website";
  const subject = kind === "booking" ? `Booking request from ${v.name}` : kind === "newsletter" ? `Newsletter sign-up: ${v.email}` : `New message from ${v.name}`;
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;color:#16181d;max-width:560px">
<h2 style="margin:0 0 4px">${title}</h2>
<p style="margin:0 0 16px;color:#585e69">Sent from the ${esc(biz)} website. Reply to this email to answer them directly.</p>
<table style="border-collapse:collapse">${row("Name", v.name)}${row("Email", v.email)}${row("Phone", v.phone)}${row("Service", v.service)}${row("Preferred date", v.date)}${row("Time of day", v.time)}${row("Postcode", v.postcode)}${row("Message", v.message)}</table>
<p style="font-size:13px;color:#8a8f98;margin-top:22px">Delivered by Axencraft, who host your website.</p></div>`;

  const from = String(get("email_from") ?? "Axencraft <support@axencraft.co.uk>");
  const addr = from.match(/<([^>]+)>/)?.[1] ?? from;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${biz.replace(/[<>"]/g, "")} website <${addr}>`, to: [to], reply_to: v.email, subject, html }),
  });
  if (!res.ok) {
    console.error("Resend error", res.status, await res.text());
    return json(502, { error: "Sorry, your message couldn't be sent. Please try again later." });
  }
  await db.from("form_events").insert({ project_id: p.id, ip_hash: ipHash, kind });
  // Keep the spam-protection log for 30 days at most (see the privacy policy).
  await db.from("form_events").delete().lt("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
  return json(200, { ok: true });
});
