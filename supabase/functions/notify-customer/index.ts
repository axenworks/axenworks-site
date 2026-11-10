// Emails a customer when something happens on their website:
//   preview       their draft is ready to look at
//   live          their website is live (with its address)
//   change_done / change_declined   a change request was finished or declined
// Called by database triggers with { event, id }. It re-reads everything from the
// database, so calling it twice or with made-up input can't send a wrong email,
// and each email is only ever sent once.
// Sending only happens once app_settings.email_from is set (a verified sender).
// Replies go to app_settings.reply_to, or the owner's email if that isn't set.
import { admin } from "../_shared/stripe.ts";

const SITE = "https://axencraft.co.uk";
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function layout(title: string, body: string, button?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f7f8f6;padding:24px 12px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#16181d">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #d9dcd6;border-radius:14px;padding:28px">
<div style="font-weight:800;font-size:18px;letter-spacing:-.02em;margin-bottom:18px">Axencraft</div>
<h1 style="font-size:22px;line-height:1.25;margin:0 0 12px">${title}</h1>
<div style="font-size:16px;line-height:1.55">${body}</div>
${button ? `<p style="margin:22px 0 4px"><a href="${esc(button.url)}" style="display:inline-block;background:#2430d6;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${esc(button.label)}</a></p>` : ""}
<p style="font-size:14px;color:#585e69;margin:24px 0 0">Questions? Just reply to this email.</p>
</div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const { event, id } = await req.json().catch(() => ({}));
  if (!event || id == null || !/^[0-9a-z-]{1,40}$/i.test(String(id))) return new Response("Bad request", { status: 400 });

  const db = admin();
  const settings = await db.from("app_settings").select("key,value").in("key", ["email_from", "reply_to", "owner_email"]);
  const get = (k: string) => (settings.data ?? []).find((r: any) => r.key === k)?.value;
  const from = get("email_from");
  const replyTo = get("reply_to") || get("owner_email");
  const key = Deno.env.get("RESEND_API_KEY");
  if (!from || !key) return new Response("Customer emails not switched on yet");

  let userId: string, subject = "", html = "", mark: () => Promise<unknown>;

  if (event === "preview" || event === "live") {
    const { data: p } = await db.from("projects").select("*").eq("id", id).maybeSingle();
    if (!p) return new Response("Not found", { status: 404 });
    const biz = p.answers?.business_name || "your business";
    userId = p.user_id;
    if (event === "preview") {
      if (p.status !== "with_customer" || p.preview_emailed_at) return new Response("Nothing to do");
      subject = `Your website preview is ready`;
      html = layout("Your website preview is ready",
        `<p style="margin:0 0 12px">Good news: we've built the website for <b>${esc(biz)}</b>, and it's ready for you to look at.</p>
<p style="margin:0">Open your account to see the preview. If you'd like anything changed, request it there. Changes are free while you're reviewing, and nothing goes live until you're happy.</p>`,
        { label: "See your preview", url: `${SITE}/account.html` });
      mark = () => db.from("projects").update({ preview_emailed_at: new Date().toISOString() }).eq("id", p.id);
    } else {
      if (p.status !== "live" || p.live_emailed_at) return new Response("Nothing to do");
      const url = p.subdomain ? `https://${p.subdomain}.axencraft.co.uk` : `${SITE}/account.html`;
      const { data: sub } = await db.from("subscriptions").select("status,trial_end").eq("user_id", p.user_id).maybeSingle();
      const trial = sub?.status === "trialing" && sub.trial_end
        ? `<p style="margin:12px 0 0">Your free trial runs until <b>${new Date(sub.trial_end).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</b>. Your monthly plan starts after that.</p>` : "";
      subject = `${biz} is live!`;
      html = layout("Your website is live",
        `<p style="margin:0 0 12px">The website for <b>${esc(biz)}</b> is now live${p.subdomain ? ` at <a href="${esc(url)}" style="color:#2430d6">${esc(url.replace("https://", ""))}</a>` : ""}. Share it with your customers!</p>
<p style="margin:0">Need something updated? Request a change from your account at any time.</p>${trial}`,
        { label: "Visit your website", url });
      mark = () => db.from("projects").update({ live_emailed_at: new Date().toISOString() }).eq("id", p.id);
    }
  } else if (event === "change_done" || event === "change_declined") {
    const { data: c } = await db.from("change_requests").select("*").eq("id", id).maybeSingle();
    if (!c || c.done_emailed_at || `change_${c.status}` !== event) return new Response("Nothing to do");
    userId = c.user_id;
    const done = c.status === "done";
    const note = c.admin_note ? `<p style="margin:12px 0 0"><b>Our note:</b> ${esc(c.admin_note)}</p>` : "";
    subject = done ? "Your change has been made" : "About your change request";
    html = layout(done ? "Your change has been made" : "About your change request",
      `<p style="margin:0 0 12px">${done ? "We've made the change you asked for:" : "We weren't able to make this change:"}</p>
<p style="margin:0;padding:12px 14px;background:#f7f8f6;border-radius:10px;white-space:pre-wrap">${esc(c.message)}</p>${note}`,
      { label: done ? "View your account" : "Open your account", url: `${SITE}/account.html` });
    mark = () => db.from("change_requests").update({ done_emailed_at: new Date().toISOString() }).eq("id", c.id);
  } else {
    return new Response("Unknown event", { status: 400 });
  }

  const { data: u } = await db.auth.admin.getUserById(userId);
  const to = u?.user?.email;
  if (!to) return new Response("No customer email", { status: 404 });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], reply_to: replyTo || undefined, subject, html }),
  });
  if (!res.ok) {
    console.error("Resend error", res.status, await res.text());
    return new Response("Email failed", { status: 502 });
  }
  await mark();
  return new Response("Sent");
});
