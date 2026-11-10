// Emails the Axencraft owner when a customer submits their questionnaire.
// Called by a database trigger with { project_id }. Safe to call more than once:
// it re-reads the project and only sends if it's submitted and not yet notified.
import { admin } from "../_shared/stripe.ts";

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const row = (label: string, value: unknown) =>
  value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)
    ? ""
    : `<tr><td style="padding:6px 12px 6px 0;color:#585e69;vertical-align:top;white-space:nowrap">${esc(label)}</td>` +
      `<td style="padding:6px 0;white-space:pre-wrap">${esc(Array.isArray(value) ? value.join(", ") : value)}</td></tr>`;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const { project_id } = await req.json().catch(() => ({}));
  if (!project_id || !/^[0-9a-f-]{36}$/i.test(project_id)) return new Response("Bad request", { status: 400 });

  const db = admin();
  const { data: p } = await db.from("projects").select("*").eq("id", project_id).maybeSingle();
  if (!p || p.status !== "submitted" || p.notified_at) return new Response("Nothing to do");

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    console.error("RESEND_API_KEY is not set");
    return new Response("Email not configured", { status: 500 });
  }

  const [{ data: owner }, { data: fromRow }, { data: sub }, { data: userRes }] = await Promise.all([
    db.from("app_settings").select("value").eq("key", "owner_email").maybeSingle(),
    db.from("app_settings").select("value").eq("key", "email_from").maybeSingle(),
    db.from("subscriptions").select("plan,status").eq("user_id", p.user_id).maybeSingle(),
    db.auth.admin.getUserById(p.user_id),
  ]);
  const to = owner?.value;
  if (!to) return new Response("No owner email", { status: 500 });
  const customerEmail = userRes?.user?.email ?? "";
  const a = p.answers ?? {};

  // Links to uploaded files, valid for 7 days.
  const paths: string[] = [...(a.logo ? [a.logo] : []), ...(a.photos ?? [])];
  let links = "";
  if (paths.length) {
    const { data: signed } = await db.storage.from("project-uploads").createSignedUrls(paths, 60 * 60 * 24 * 7);
    links = (signed ?? []).filter((s) => s.signedUrl).map((s, i) =>
      `<a href="${esc(s.signedUrl)}">${i === 0 && a.logo ? "Logo" : "Photo " + (a.logo ? i : i + 1)}</a>`
    ).join(" · ");
  }

  const colours = a.colour_choice === "mine"
    ? `${a.colour_main ?? ""} and ${a.colour_second ?? ""}`
    : a.colour_choice === "you_choose" ? "Choose for them" : "";

  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#16181d">
<h2 style="margin:0 0 4px">New questionnaire: ${esc(a.business_name || "Unnamed business")}</h2>
<p style="margin:0 0 16px;color:#585e69">From ${esc(customerEmail)} · ${esc(sub?.plan ?? "no")} plan · ${esc(p.template ?? "no")} template</p>
<table style="border-collapse:collapse">
${row("What they do", a.business_about)}${row("Customers", a.audience)}${row("Location", a.location)}
${row("Contact email", a.contact_email)}${row("Phone", a.contact_phone)}${row("Socials", a.socials)}
${row("Feel", a.style_words)}${row("Colours", colours)}${row("Inspiration", a.inspiration)}
${row("Pages", ["Home", ...(a.pages ?? [])])}${row("Other needs", a.pages_other)}
${row("Tagline", a.tagline)}${row("Services", a.services)}${row("Story", a.story)}
${row("Reviews", a.reviews)}${row("Notes", a.notes)}${row("Stock photos OK", a.stock_ok ? "Yes" : "")}
</table>
${links ? `<p style="margin-top:16px"><b>Uploads</b> (links work for 7 days): ${links}</p>` : ""}
</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromRow?.value || "Axencraft <onboarding@resend.dev>",
      to: [to],
      reply_to: customerEmail || undefined,
      subject: `New questionnaire: ${a.business_name || "Unnamed business"}`,
      html,
    }),
  });
  if (!res.ok) {
    console.error("Resend error", res.status, await res.text());
    return new Response("Email failed", { status: 502 });
  }

  await db.from("projects").update({ notified_at: new Date().toISOString() }).eq("id", p.id);
  return new Response("Sent");
});
