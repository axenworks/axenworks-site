// Lets a customer see their own order from the link in their email (ref + secret token).
// Returns no address or email, only what the order page shows.
import { admin, cors } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = { ...cors(origin), "Content-Type": "application/json" };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  const { ref, t } = await req.json().catch(() => ({}));
  if (!/^AX-[A-Z0-9]{6}$/.test(String(ref)) || !/^[0-9a-f]{32}$/.test(String(t))) return reply(404, { error: "Order not found." });

  const { data: o } = await admin().from("shop_orders")
    .select("ref,view_token,status,items,subtotal_pence,postage_pence,total_pence,tracking,created_at,paid_at,dispatched_at")
    .eq("ref", ref).maybeSingle();
  if (!o || o.view_token !== t) return reply(404, { error: "Order not found." });
  const { view_token: _, ...safe } = o;
  return reply(200, { order: safe });
});
