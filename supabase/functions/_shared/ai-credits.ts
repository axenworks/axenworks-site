// Adds a bought pack of AI edits to a customer, exactly once per paid Stripe Checkout session.
// The primary key on ai_edit_purchases.stripe_session_id is what makes a repeated webhook harmless.
export async function creditPack(
  db: { from: (t: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any },
  session: any,
): Promise<"credited" | "duplicate" | "ignored"> {
  const m = session?.metadata ?? {};
  const qty = Number(m.qty);
  if (m.kind !== "ai_credits" || session?.payment_status !== "paid" || !m.user_id || !Number.isInteger(qty) || qty < 1 || qty > 1000) {
    return "ignored";
  }
  const { error } = await db.from("ai_edit_purchases").insert({ stripe_session_id: session.id, user_id: m.user_id, qty });
  if (error) {
    if (error.code === "23505") return "duplicate";
    throw new Error(`Couldn't record AI edit purchase: ${error.message ?? error.code}`);
  }
  const { error: e2 } = await db.rpc("add_ai_credits", { p_user_id: m.user_id, p_qty: qty });
  if (e2) throw new Error(`Couldn't add AI edit credits: ${e2.message ?? e2.code}`);
  return "credited";
}
