// Customer change requests.
//  action "status": how many included changes are left this month.
//  action "submit": records a request. While the preview is with the customer,
//  requests are free and don't count. After go-live, each plan includes a number
//  per calendar month; beyond that the customer must confirm a £10 charge, which
//  is added to their next Stripe invoice. The owner is emailed about every request.
import { admin, cors, stripe } from "../_shared/stripe.ts";

const DEFAULT_ALLOWANCE: Record<string, number> = { starter: 1, standard: 3, pro: 6 };
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

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
    const user = auth?.user;
    if (!user) return reply(401, { error: "Please log in again." });

    const body = await req.json().catch(() => ({}));
    const { data: project } = await db.from("projects").select("*").eq("user_id", user.id).maybeSingle();
    const { data: sub } = await db.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
    if (!project || !sub || !["trialing", "active", "past_due"].includes(sub.status)) {
      return reply(409, { error: "You don't have an active website plan." });
    }
    if (!["with_customer", "live"].includes(project.status)) {
      return reply(409, { error: "You can request changes once your preview is ready." });
    }

    const live = project.status === "live";
    const { data: setting } = await db.from("app_settings").select("value").eq("key", "change_allowance").maybeSingle();
    const allowance = Number((setting?.value ?? DEFAULT_ALLOWANCE)[sub.plan] ?? DEFAULT_ALLOWANCE[sub.plan] ?? 1);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { count } = await db.from("change_requests").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("counts_toward_allowance", true).gte("created_at", monthStart);
    const used = count ?? 0;
    const status = { live, allowance, used, remaining: live ? Math.max(0, allowance - used) : null };

    if (body.action === "status") return reply(200, status);
    if (body.action !== "submit") return reply(400, { error: "Unknown action." });

    const message = String(body.message ?? "").trim();
    const page = String(body.page ?? "").trim().slice(0, 80) || null;
    if (message.length < 3) return reply(400, { error: "Please describe the change you'd like." });
    if (message.length > 4000) return reply(400, { error: "Please keep your request under 4,000 characters." });

    let isExtra = false, invoiceItem: string | null = null;
    if (live && used >= allowance) {
      if (!body.confirm_extra) return reply(402, { ...status, needs_extra: true, error: "You've used this month's included changes." });
      const { data: priceSetting } = await db.from("app_settings").select("value").eq("key", "extra_change_price").maybeSingle();
      const item = await stripe("invoiceitems", {
        customer: sub.stripe_customer_id,
        subscription: sub.stripe_subscription_id,
        "pricing[price]": String(priceSetting?.value ?? "price_1UZtVMGbMox0LPSQX3OQO7Gs"),
        description: "Extra website change request",
        "metadata[user_id]": user.id,
      });
      isExtra = true; invoiceItem = item.id;
    }

    const { data: cr, error } = await db.from("change_requests").insert({
      project_id: project.id, user_id: user.id, page, message,
      counts_toward_allowance: live && !isExtra, is_extra: isExtra, stripe_invoice_item_id: invoiceItem,
    }).select().single();
    if (error) throw error;

    // Email the owner (best effort).
    const key = Deno.env.get("RESEND_API_KEY");
    const { data: owner } = await db.from("app_settings").select("value").eq("key", "owner_email").maybeSingle();
    if (key && owner?.value) {
      const biz = project.answers?.business_name || user.email;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Axencraft <onboarding@resend.dev>", to: [owner.value], reply_to: user.email || undefined,
          subject: `Change request: ${biz}${isExtra ? " (extra, £10)" : ""}`,
          html: `<div style="font-family:system-ui,sans-serif;font-size:15px"><h2 style="margin:0 0 6px">New change request</h2>
<p style="margin:0 0 14px;color:#585e69">${esc(biz)} · ${esc(user.email)} · ${esc(sub.plan)} plan · ${live ? (isExtra ? "extra £10 change" : `${used + 1} of ${allowance} this month`) : "during preview (free)"}</p>
${page ? `<p><b>Page:</b> ${esc(page)}</p>` : ""}<p style="white-space:pre-wrap">${esc(message)}</p></div>`,
        }),
      }).catch((e) => console.error("email failed", e));
    }

    return reply(200, { ok: true, request: cr, ...status, used: used + (cr.counts_toward_allowance ? 1 : 0),
      remaining: live ? Math.max(0, allowance - used - (cr.counts_toward_allowance ? 1 : 0)) : null });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "Couldn't send your request. Please try again." });
  }
});
