// Receives Stripe events and keeps public.subscriptions in sync.
// Security: we never trust the posted body. We take only the event ID and
// fetch the event (and the subscription) fresh from Stripe with our secret key.
import { admin, PLAN_PRICES, stripe } from "../_shared/stripe.ts";

const PRICE_TO_PLAN = Object.fromEntries(
  Object.entries(PLAN_PRICES).map(([plan, price]) => [price, plan]),
);
const ts = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

// Ask notify-customer to email the customer (best effort; it de-duplicates itself).
async function notify(event: string, id: string) {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-customer`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, id }),
    });
  } catch (e) { console.error("notify failed", e); }
}

async function syncSubscription(subId: string): Promise<string | undefined> {
  const db = admin();
  const sub = await stripe(`subscriptions/${subId}`, undefined, "GET");

  let userId: string | undefined = sub.metadata?.user_id;
  if (!userId) {
    const { data } = await db.from("subscriptions")
      .select("user_id").eq("stripe_customer_id", sub.customer).maybeSingle();
    userId = data?.user_id;
  }
  if (!userId) {
    console.warn("No Axencraft user for subscription", sub.id);
    return;
  }
  const { data: before } = await db.from("subscriptions")
    .select("status,past_due_since").eq("user_id", userId).maybeSingle();

  const item = sub.items?.data?.find((i: any) => PRICE_TO_PLAN[i.price?.id]) ?? sub.items?.data?.[0];
  // Price first: customers can switch plans in the billing portal.
  const plan = PRICE_TO_PLAN[item?.price?.id] ?? sub.metadata?.plan ?? null;
  const periodEnd = sub.current_period_end ?? item?.current_period_end;

  const row: Record<string, unknown> = {
    user_id: userId,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    plan,
    status: sub.status,
    trial_end: ts(sub.trial_end),
    current_period_end: ts(periodEnd),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };
  if (sub.trial_end) row.trial_used = true;
  // Billing rules: remember when payments started failing (sites go offline after the grace period).
  if (sub.status === "past_due") row.past_due_since = before?.past_due_since ?? new Date().toISOString();
  else { row.past_due_since = null; row.payment_failed_emailed_at = null; }

  const { error } = await db.from("subscriptions").upsert(row);
  if (error) throw error;
  if (sub.status === "past_due" && before?.status !== "past_due") await notify("payment_failed", userId);
  return userId;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let eventId: string | undefined;
  try {
    eventId = (await req.json())?.id;
  } catch { /* fall through */ }
  if (!eventId || !/^evt_[A-Za-z0-9]+$/.test(eventId)) {
    return new Response("Bad request", { status: 400 });
  }

  let event: any;
  try {
    event = await stripe(`events/${eventId}`, undefined, "GET");
  } catch {
    return new Response("Unknown event", { status: 400 });
  }

  try {
    const obj = event.data?.object;
    switch (event.type) {
      case "checkout.session.completed":
        if (obj?.subscription) await syncSubscription(obj.subscription);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await syncSubscription(obj.id);
        break;
      case "customer.subscription.trial_will_end": {
        // Stripe sends this 3 days before a trial ends.
        const uid = await syncSubscription(obj.id);
        if (uid) await notify("trial_ending", uid);
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response("Handler error", { status: 500 }); // Stripe will retry
  }
});
