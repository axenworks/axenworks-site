// Opens Stripe's billing portal so a customer can update their card,
// see invoices, switch plan or cancel.
import { admin, cors, PORTAL_CONFIG, siteFor, stripe } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = { ...cors(origin), "Content-Type": "application/json" };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  try {
    const db = admin();
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth, error: authErr } = await db.auth.getUser(token);
    if (authErr || !auth?.user) return reply(401, { error: "Please log in again." });

    const { data: row } = await db.from("subscriptions")
      .select("stripe_customer_id").eq("user_id", auth.user.id).maybeSingle();
    if (!row?.stripe_customer_id) return reply(404, { error: "You don't have a plan yet." });

    const session = await stripe("billing_portal/sessions", {
      customer: row.stripe_customer_id,
      configuration: PORTAL_CONFIG,
      return_url: `${siteFor(origin)}/account.html`,
    });
    return reply(200, { url: session.url });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "Couldn't open billing right now. Please try again." });
  }
});
