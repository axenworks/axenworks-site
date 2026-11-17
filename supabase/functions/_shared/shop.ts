// Shared helpers for the Print Studio and Grow Studio shop.
import { admin } from "./stripe.ts";

export const SITE = "https://axencraft.co.uk";

type Catalog = any;
let cached: { at: number; data: Catalog } | null = null;

// The live price list. Always read from the production website, never from the browser.
export async function catalog(): Promise<Catalog> {
  if (cached && Date.now() - cached.at < 60_000) return cached.data;
  const res = await fetch(`${SITE}/shop/catalog.json`, { headers: { "Cache-Control": "no-cache" } });
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  const data = await res.json();
  cached = { at: Date.now(), data };
  return data;
}

export function index(c: Catalog) {
  const items: Record<string, any> = {};
  for (const g of c.print.categories) for (const it of g.items) items[it.id] = { ...it, studio: "print", options: ["colour"] };
  for (const it of c.grow.items) items[it.id] = { ...it, studio: "grow" };
  const lists: Record<string, any[]> = { colour: c.colours, style: c.grow.styles, seed: c.grow.seeds };
  return { items, lists };
}

export const money = (p: number) => `£${(p / 100).toFixed(2)}`;
export const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export function orderLink(o: { ref: string; view_token: string }) {
  return `${SITE}/order.html?ref=${encodeURIComponent(o.ref)}&t=${o.view_token}`;
}

export function layout(title: string, body: string, button?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f3f5f0;padding:24px 12px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#15201b">
<div style="max-width:540px;margin:0 auto;background:#fff;border:1px solid #d3d9d0;border-radius:10px;padding:28px">
<div style="font-weight:800;font-size:18px;margin-bottom:18px;color:#14503c">Axencraft</div>
<h1 style="font-size:22px;line-height:1.25;margin:0 0 12px">${title}</h1>
<div style="font-size:16px;line-height:1.55">${body}</div>
${button ? `<p style="margin:22px 0 4px"><a href="${esc(button.url)}" style="display:inline-block;background:#14503c;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px">${esc(button.label)}</a></p>` : ""}
<p style="font-size:14px;color:#55605a;margin:24px 0 0">Questions? Just reply to this email.</p>
</div></body></html>`;
}

export function itemsTable(o: any) {
  const rows = (o.items as any[]).map((i) =>
    `<tr><td style="padding:6px 8px 6px 0;vertical-align:top">${i.qty} × <b>${esc(i.name)}</b>${i.details ? `<br><span style="color:#55605a;font-size:14px">${esc(i.details)}</span>` : ""}</td>` +
    `<td style="padding:6px 0;text-align:right;vertical-align:top;white-space:nowrap">${money(i.unit_pence * i.qty)}</td></tr>`).join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:15px;margin:8px 0">${rows}
<tr><td style="padding:6px 0;border-top:1px solid #d3d9d0">Postage</td><td style="padding:6px 0;border-top:1px solid #d3d9d0;text-align:right">${money(o.postage_pence)}</td></tr>
<tr><td style="padding:6px 0;font-weight:800">Total</td><td style="padding:6px 0;text-align:right;font-weight:800">${money(o.total_pence)}</td></tr></table>`;
}

export function addressText(a: any) {
  if (!a) return "";
  return [a.line1, a.line2, a.city, a.state, a.postal_code].filter(Boolean).join(", ");
}

async function settings(keys: string[]) {
  const { data } = await admin().from("app_settings").select("key,value").in("key", keys);
  const out: Record<string, string> = {};
  for (const r of data ?? []) out[r.key] = r.value;
  return out;
}

export async function send(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  const s = await settings(["email_from", "reply_to", "owner_email"]);
  if (!key || !s.email_from || !to) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: s.email_from, to: [to], reply_to: s.reply_to || s.owner_email, subject, html }),
  });
  if (!res.ok) console.error("resend", res.status, await res.text());
  return res.ok;
}

export async function ownerEmail() {
  return (await settings(["owner_email"])).owner_email ?? "";
}

// Called by the Stripe webhook when a shop checkout is paid. Safe to call twice.
export async function markPaid(session: any) {
  const db = admin();
  const orderId = session.metadata?.order_id;
  if (!orderId || session.payment_status !== "paid") return;
  const { data: o } = await db.from("shop_orders").select("*").eq("id", orderId).maybeSingle();
  if (!o) { console.warn("No shop order for session", session.id); return; }

  if (o.status === "pending") {
    const ship = session.collected_information?.shipping_details ?? session.shipping_details ?? {};
    const cust = session.customer_details ?? {};
    const { error } = await db.from("shop_orders").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent: session.payment_intent ?? null,
      email: cust.email ?? null,
      name: ship.name ?? cust.name ?? null,
      phone: cust.phone ?? null,
      address: ship.address ?? cust.address ?? null,
      total_pence: session.amount_total ?? o.total_pence,
      updated_at: new Date().toISOString(),
    }).eq("id", o.id).eq("status", "pending");
    if (error) throw error;
  }
  const { data: paid } = await db.from("shop_orders").select("*").eq("id", orderId).single();
  const c = await catalog().catch(() => ({ dispatchDays: 7 }));

  if (!paid.confirm_emailed_at && paid.email) {
    const ok = await send(paid.email, `Order ${paid.ref}: thank you`, layout(`Thanks for your order, ${esc((paid.name ?? "").split(" ")[0] || "there")}`,
      `<p style="margin:0 0 10px">We've got your order <b>${esc(paid.ref)}</b>. Everything is made to order, so we'll start printing it now. It leaves us within ${c.dispatchDays} days, and we'll email you the tracking when it's on its way.</p>
${itemsTable(paid)}
<p style="margin:12px 0 0;color:#55605a;font-size:14px">Delivering to: ${esc(paid.name)}, ${esc(addressText(paid.address))}</p>`,
      { label: "See your order", url: orderLink(paid) }));
    if (ok) await db.from("shop_orders").update({ confirm_emailed_at: new Date().toISOString() }).eq("id", paid.id);
  }
  if (!paid.owner_emailed_at) {
    const to = await ownerEmail();
    const ok = await send(to, `New order ${paid.ref}: ${money(paid.total_pence)}`, layout(`New order ${esc(paid.ref)}`,
      `<p style="margin:0 0 10px">${esc(paid.name)} (${esc(paid.email)}) has paid ${money(paid.total_pence)}.</p>${itemsTable(paid)}
<p style="margin:12px 0 0">Ship to: ${esc(paid.name)}, ${esc(addressText(paid.address))}</p>`,
      { label: "Open the order queue", url: `${SITE}/admin-orders.html` }));
    if (ok) await db.from("shop_orders").update({ owner_emailed_at: new Date().toISOString() }).eq("id", paid.id);
  }
}
