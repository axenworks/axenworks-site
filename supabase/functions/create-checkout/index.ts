// Creates a Stripe Checkout page for a logged-in customer:
// £50 setup fee charged now + chosen monthly plan, billed only once the site goes live.
import { admin, cors, PLAN_PRICES, SETUP_FEE_PRICE, siteFor, stripe } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = { ...cors(origin), "Content-Type": "application/json" };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  try {
    const db = admin();

    // Who is asking?
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth, error: authErr } = await db.auth.getUser(token);
    if (authErr || !auth?.user) return reply(401, { error: "Please log in again." });
    const user = auth.user;

    const { plan } = await req.json().catch(() => ({}));
    const price = PLAN_PRICES[plan];
    if (!price) return reply(400, { error: "Please choose a plan." });

    const { data: existing } = await db
      .from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
    if (existing && ["active", "trialing", "past_due"].includes(existing.status)) {
      return reply(409, { error: "You already have a plan." });
    }

    // One Stripe customer per account.
    let customerId: string = existing?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe("customers", {
        email: user.email ?? "",
        "metadata[user_id]": user.id,
      });
      customerId = customer.id;
      const { error } = await db.from("subscriptions").upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    }

    // Trial length is read from app_settings now and locked in for this customer.
    // The trial itself only starts when their site goes live (see go-live function).
    const { data: setting } = await db
      .from("app_settings").select("value").eq("key", "trial_days").maybeSingle();
    const trialDays = Math.max(0, Math.min(365, Number(setting?.value ?? 0)));
    const { error: tdErr } = await db.from("subscriptions")
      .update({ trial_days: trialDays }).eq("user_id", user.id);
    if (tdErr) throw tdErr;

    const site = siteFor(origin);
    const params: Record<string, string> = {
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      "line_items[1][price]": SETUP_FEE_PRICE,
      "line_items[1][quantity]": "1",
      "subscription_data[metadata][user_id]": user.id,
      "subscription_data[metadata][plan]": plan,
      success_url: `${site}/account.html?checkout=success`,
      cancel_url: `${site}/account.html?checkout=cancelled`,
    };
    // Hold monthly billing until go-live: the subscription waits in a placeholder
    // trial (Stripe allows up to ~2 years). Go-live replaces this end date with
    // today + the customer's trial days. The setup fee is still charged today.
    if (!existing?.trial_used) {
      params["subscription_data[trial_end]"] = String(Math.floor(Date.now() / 1000) + 720 * 86400);
      params["subscription_data[metadata][awaiting_go_live]"] = "true";
    }

    const session = await stripe("checkout/sessions", params);
    return reply(200, { url: session.url });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "Something went wrong starting checkout. Please try again." });
  }
});
