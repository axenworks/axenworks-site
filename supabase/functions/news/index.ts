// The product news list.
//   { action: "unsubscribe", token }                       public: stop all news emails to that address
//   { action: "stats" }                                    admin: how many people per studio, recent sends
//   { action: "send", audience, subject, body, test }      admin: test = send only to you; otherwise everyone in the audience
import { createClient } from "jsr:@supabase/supabase-js@2";
import { admin, cors } from "../_shared/stripe.ts";
import { newsHtml, newsRecipients } from "../_shared/growth.ts";

const SITE = "https://axencraft.co.uk";
const AUDIENCES = ["all", "digital", "print", "grow"];

async function settings(db: any, keys: string[]) {
  const { data } = await db.from("app_settings").select("key,value").in("key", keys);
  const out: Record<string, string> = {};
  for (const r of data ?? []) out[r.key] = r.value;
  return out;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = { ...cors(origin), "Content-Type": "application/json" };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  const db = admin();
  const body = await req.json().catch(() => ({}));

  try {
    if (body.action === "unsubscribe") {
      const token = String(body.token ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(token)) return reply(400, { error: "That unsubscribe link isn't complete." });
      const { data: row } = await db.from("waitlist").select("email").eq("unsubscribe_token", token).maybeSingle();
      if (!row) return reply(404, { error: "We couldn't find that sign-up. You may already be removed." });
      // Every sign-up with the same address (exact match, ignoring case and spaces).
      const want = row.email.trim().toLowerCase();
      const { data: all } = await db.from("waitlist").select("id,email").is("unsubscribed_at", null);
      const ids = (all ?? []).filter((r: any) => String(r.email).trim().toLowerCase() === want).map((r: any) => r.id);
      if (ids.length) {
        const { error } = await db.from("waitlist").update({ unsubscribed_at: new Date().toISOString() }).in("id", ids);
        if (error) throw error;
      }
      return reply(200, { ok: true });
    }

    // Everything else is for admins.
    const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false },
    });
    const { data: isAdmin } = await asUser.rpc("is_admin");
    if (isAdmin !== true) return reply(403, { error: "Admins only." });
    const { data: { user } } = await asUser.auth.getUser();

    const { data: rows, error } = await db.from("waitlist").select("email,interest,unsubscribed_at,unsubscribe_token,created_at");
    if (error) throw error;

    if (body.action === "stats") {
      const counts: Record<string, number> = {};
      for (const a of AUDIENCES) counts[a] = newsRecipients(rows ?? [], a).length;
      const weekAgo = Date.now() - 7 * 864e5;
      const newThisWeek = (rows ?? []).filter((r: any) => !r.unsubscribed_at && new Date(r.created_at).getTime() > weekAgo).length;
      const { data: sends } = await db.from("news_sends").select("subject,audience,recipients,created_at").order("created_at", { ascending: false }).limit(5);
      return reply(200, { counts, newThisWeek, sends: sends ?? [] });
    }

    if (body.action === "send") {
      const audience = AUDIENCES.includes(body.audience) ? body.audience : "all";
      const subject = String(body.subject ?? "").trim().slice(0, 150);
      const text = String(body.body ?? "").trim().slice(0, 20000);
      if (!subject || !text) return reply(400, { error: "Add a subject and a message." });

      const key = Deno.env.get("RESEND_API_KEY");
      const s = await settings(db, ["email_from", "reply_to", "owner_email"]);
      if (!key || !s.email_from) return reply(500, { error: "Email isn't set up." });

      const list = body.test
        ? [{ email: user?.email || s.owner_email, token: "00000000-0000-0000-0000-000000000000" }]
        : newsRecipients(rows ?? [], audience);
      if (!list.length) return reply(400, { error: "Nobody on the list for that studio yet." });

      let sent = 0;
      for (let i = 0; i < list.length; i += 100) {
        const batch = list.slice(i, i + 100).map((r) => {
          const unsub = `${SITE}/unsubscribe.html?t=${r.token}`;
          return {
            from: s.email_from, to: [r.email], reply_to: s.reply_to || s.owner_email,
            subject: body.test ? `[Test] ${subject}` : subject,
            html: newsHtml(text, unsub),
            headers: { "List-Unsubscribe": `<${unsub}>` },
          };
        });
        const res = await fetch("https://api.resend.com/emails/batch", {
          method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(batch),
        });
        if (!res.ok) {
          console.error("resend batch", res.status, await res.text());
          return reply(502, { error: `Sending stopped after ${sent} emails. Check Resend, then try again.`, sent });
        }
        sent += batch.length;
      }
      if (!body.test) await db.from("news_sends").insert({ subject, audience, recipients: sent, sent_by: user?.id ?? null });
      return reply(200, { sent, test: !!body.test });
    }

    return reply(400, { error: "Unknown action." });
  } catch (e) {
    console.error(e);
    return reply(500, { error: "Something went wrong." });
  }
});
