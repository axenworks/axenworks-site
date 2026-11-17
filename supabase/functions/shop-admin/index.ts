// The owner's order queue. Admin accounts only (checked with is_admin()).
//   { action: "list" }                                   orders (newest first) and the shop_open switch
//   { action: "update", id, status, tracking?, note? }   move an order along; emails the customer on dispatch
//   { action: "shop_open", value: true|false }           pause or reopen checkout
import { createClient } from "jsr:@supabase/supabase-js@2";
import { admin, cors } from "../_shared/stripe.ts";
import { esc, itemsTable, layout, orderLink, send } from "../_shared/shop.ts";

const STATUSES = ["paid", "printing", "dispatched", "cancelled", "refunded"];

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = { ...cors(origin), "Content-Type": "application/json" };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  // Is this an admin? Ask the database as the signed-in user.
  const auth = req.headers.get("Authorization") ?? "";
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data: isAdmin } = await asUser.rpc("is_admin");
  if (isAdmin !== true) return reply(403, { error: "Admins only." });

  const db = admin();
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "list") {
      const [{ data: orders, error }, { data: open }] = await Promise.all([
        db.from("shop_orders").select("*").neq("status", "pending").order("created_at", { ascending: false }).limit(300),
        db.from("app_settings").select("value").eq("key", "shop_open").maybeSingle(),
      ]);
      if (error) throw error;
      return reply(200, { orders, shop_open: open?.value !== "false" });
    }

    if (body.action === "shop_open") {
      const { error } = await db.from("app_settings").upsert({ key: "shop_open", value: body.value ? "true" : "false" });
      if (error) throw error;
      return reply(200, { shop_open: !!body.value });
    }

    if (body.action === "update") {
      if (!STATUSES.includes(body.status)) return reply(400, { error: "Unknown status." });
      const { data: o } = await db.from("shop_orders").select("*").eq("id", String(body.id)).maybeSingle();
      if (!o || o.status === "pending") return reply(404, { error: "Order not found." });
      const patch: Record<string, unknown> = {
        status: body.status, updated_at: new Date().toISOString(),
        tracking: typeof body.tracking === "string" ? body.tracking.trim().slice(0, 80) || null : o.tracking,
        admin_note: typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : o.admin_note,
      };
      if (body.status === "dispatched" && !o.dispatched_at) patch.dispatched_at = new Date().toISOString();
      const { data: u, error } = await db.from("shop_orders").update(patch).eq("id", o.id).select().single();
      if (error) throw error;

      let emailed = false;
      if (u.status === "dispatched" && !u.dispatch_emailed_at && u.email) {
        const track = u.tracking
          ? `<p style="margin:0 0 10px">Your Royal Mail tracking number is <b>${esc(u.tracking)}</b>. You can follow it at <a href="https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(u.tracking)}" style="color:#14503c">royalmail.com</a>.</p>`
          : "";
        emailed = await send(u.email, `Order ${u.ref} is on its way`, layout("Your order is on its way",
          `<p style="margin:0 0 10px">We've printed and posted order <b>${esc(u.ref)}</b>. It should arrive in 2 to 3 working days.</p>${track}${itemsTable(u)}`,
          { label: "See your order", url: orderLink(u) }));
        if (emailed) await db.from("shop_orders").update({ dispatch_emailed_at: new Date().toISOString() }).eq("id", u.id);
      }
      return reply(200, { order: { ...u, dispatch_emailed_at: emailed ? new Date().toISOString() : u.dispatch_emailed_at }, emailed });
    }
    return reply(400, { error: "Unknown action." });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "Something went wrong. Please try again." });
  }
});
