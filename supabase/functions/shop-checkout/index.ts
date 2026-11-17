// Starts a Stripe Checkout for a Print Studio / Grow Studio basket. No login needed.
// The browser sends only product ids, options and quantities. Every price comes
// from the live catalogue, so a changed basket in the browser can't change a price.
import { admin, cors, siteFor, stripe } from "../_shared/stripe.ts";
import { catalog, index } from "../_shared/shop.ts";

const REF_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newRef() {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return "AX-" + Array.from(b, (x) => REF_CHARS[x % REF_CHARS.length]).join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = { ...cors(origin), "Content-Type": "application/json" };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  try {
    const db = admin();
    const { data: open } = await db.from("app_settings").select("value").eq("key", "shop_open").maybeSingle();
    if (open?.value === "false") {
      return reply(503, { error: "We've paused new orders for a few days while we catch up. Please try again soon." });
    }

    const body = await req.json().catch(() => ({}));
    const raw = Array.isArray(body?.items) ? body.items : [];
    if (!raw.length || raw.length > 40) return reply(400, { error: "Your basket is empty." });

    const cat = await catalog();
    const { items, lists } = index(cat);
    const lines: any[] = [];
    for (const r of raw) {
      const it = items[String(r?.id)];
      const qty = Math.floor(Number(r?.qty));
      if (!it || !(qty >= 1 && qty <= 20)) return reply(400, { error: "Something in your basket is no longer available. Please remove it and try again." });
      const details: string[] = [];
      const opts: Record<string, string> = {};
      for (const k of it.options ?? []) {
        const v = String(r?.opts?.[k] ?? "");
        const hit = (lists[k] ?? []).find((x: any) => x.id === v);
        if (!hit) return reply(400, { error: `Please choose a ${k} for ${it.name}.` });
        opts[k] = v;
        details.push(hit.name);
      }
      if (it.pack) details.push(it.pack);
      lines.push({ id: it.id, studio: it.studio, name: it.name, details: details.join(" · "), opts, qty, unit_pence: it.price });
    }
    const subtotal = lines.reduce((n, l) => n + l.unit_pence * l.qty, 0);
    const postage = Number(cat.postage.pence);

    // Save the order first, so the webhook only has to mark it paid.
    let order: any = null;
    for (let i = 0; i < 3 && !order; i++) {
      const { data, error } = await db.from("shop_orders").insert({
        ref: newRef(), items: lines, subtotal_pence: subtotal, postage_pence: postage, total_pence: subtotal + postage,
      }).select().single();
      if (!error) order = data;
      else if (!String(error.message).includes("duplicate")) throw error;
    }
    if (!order) throw new Error("could not create order");

    const site = siteFor(origin);
    const p: Record<string, string> = {
      mode: "payment",
      currency: "gbp",
      client_reference_id: order.ref,
      "metadata[kind]": "shop",
      "metadata[order_id]": order.id,
      "metadata[ref]": order.ref,
      "payment_intent_data[metadata][order_ref]": order.ref,
      "payment_intent_data[description]": `Axencraft order ${order.ref}`,
      "shipping_address_collection[allowed_countries][0]": "GB",
      "phone_number_collection[enabled]": "false",
      "shipping_options[0][shipping_rate_data][type]": "fixed_amount",
      "shipping_options[0][shipping_rate_data][display_name]": `${cat.postage.name} (made to order, dispatched within ${cat.dispatchDays} days)`,
      "shipping_options[0][shipping_rate_data][fixed_amount][amount]": String(postage),
      "shipping_options[0][shipping_rate_data][fixed_amount][currency]": "gbp",
      "shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]": "business_day",
      "shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]": "3",
      "shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]": "business_day",
      "shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]": String(Number(cat.dispatchDays) + 3),
      "custom_text[submit][message]":
        `Made to order in Devon: dispatched within ${cat.dispatchDays} days. By paying you agree to our terms at axencraft.co.uk/terms.html, including your 14-day right to cancel.`,
      success_url: `${site}/order.html?ref=${order.ref}&t=${order.view_token}&paid=1`,
      cancel_url: `${site}/${lines.some((l) => l.studio === "grow") ? "grow" : "print"}.html?checkout=cancelled`,
      expires_at: String(Math.floor(Date.now() / 1000) + 3600),
    };
    lines.forEach((l, i) => {
      p[`line_items[${i}][quantity]`] = String(l.qty);
      p[`line_items[${i}][price_data][currency]`] = "gbp";
      p[`line_items[${i}][price_data][unit_amount]`] = String(l.unit_pence);
      p[`line_items[${i}][price_data][product_data][name]`] = l.name;
      if (l.details) p[`line_items[${i}][price_data][product_data][description]`] = l.details;
    });

    const session = await stripe("checkout/sessions", p);
    await db.from("shop_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    return reply(200, { url: session.url });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "We couldn’t open checkout. Please try again in a moment." });
  }
});
