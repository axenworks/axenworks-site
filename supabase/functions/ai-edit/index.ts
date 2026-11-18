// AI Edit tool for customers. A customer describes a change in plain English; Claude proposes a patch to
// their site content; we validate it, show it as a pending edit, and the customer applies, discards or undoes it.
//  action "status"   -> allowance, credits, any pending edit, recent history, pack price
//  action "propose"  -> { message }  makes a pending edit (uses one edit only when a valid change is produced)
//  action "apply"    -> { id }       publishes a pending edit (keeps the old version so it can be undone)
//  action "discard"  -> { id }
//  action "undo"     -> { id }       restores the site as it was before the latest applied edit
//  action "buy"      -> Stripe Checkout for a pack of extra edits (credited by stripe-webhook)
import { admin, cors, siteFor, stripe } from "../_shared/stripe.ts";
import { buildPrompt, parseModelReply, sitesEqual, validatePatch } from "../_shared/ai-edit.ts";
import { allowanceFor, decide, underAttemptLimit } from "../_shared/ai-usage.ts";

const SETTING_KEYS = ["ai_edit_enabled", "ai_allowance", "ai_daily_cap", "ai_pack"];

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
    const action = String(body.action ?? "");

    const { data: rows } = await db.from("app_settings").select("key,value").in("key", SETTING_KEYS);
    const setting: Record<string, any> = Object.fromEntries((rows ?? []).map((r: any) => [r.key, r.value]));
    const { data: isAdmin } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    const enabled = setting.ai_edit_enabled === true || !!isAdmin;

    const { data: project } = await db.from("projects").select("*").eq("user_id", user.id).maybeSingle();
    const { data: sub } = await db.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
    const eligible = !!project && !!sub && ["trialing", "active", "past_due"].includes(sub.status) &&
      ["with_customer", "live"].includes(project.status) && !!project.site;

    const dailyCap = Math.max(1, Number(setting.ai_daily_cap ?? 20) || 20);
    const pack = { size: Number(setting.ai_pack?.size ?? 25) || 25, pence: Number(setting.ai_pack?.pence ?? 499) || 499 };

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

    async function usage() {
      const allowance = allowanceFor(sub?.plan, setting.ai_allowance);
      const { count: used } = await db.from("ai_edits").select("id", { count: "exact", head: true })
        .eq("user_id", user!.id).eq("counted", true).eq("used_credit", false).gte("created_at", monthStart);
      const { count: today } = await db.from("ai_edits").select("id", { count: "exact", head: true })
        .eq("user_id", user!.id).eq("counted", true).gte("created_at", dayStart);
      const credits = Number(project?.ai_credits ?? 0);
      const usedThisMonth = used ?? 0;
      return { allowance, usedThisMonth, usedToday: today ?? 0, credits, remaining: Math.max(0, allowance - usedThisMonth) + credits };
    }

    if (action === "status") {
      if (!enabled || !eligible) return reply(200, { enabled: false });
      const u = await usage();
      const { data: pending } = await db.from("ai_edits").select("id,message,changes,note,created_at")
        .eq("project_id", project.id).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data: history } = await db.from("ai_edits").select("id,message,status,note,created_at,applied_at")
        .eq("project_id", project.id).neq("status", "pending").order("created_at", { ascending: false }).limit(10);
      const latestApplied = (history ?? []).find((h: any) => h.status === "applied") ?? null;
      return reply(200, {
        enabled: true, allowance: u.allowance, used: u.usedThisMonth, credits: u.credits, remaining: u.remaining, dailyCap, pack,
        pending: pending ?? null, history: history ?? [], undoId: latestApplied?.id ?? null,
      });
    }

    if (!enabled) return reply(403, { error: "AI edits aren't available yet." });
    if (!eligible) return reply(409, { error: "You can use AI edits once your preview is ready and your plan is active." });

    if (action === "propose") {
      const message = String(body.message ?? "").trim();
      if (message.length < 3) return reply(400, { error: "Please describe the change you'd like." });
      if (message.length > 1000) return reply(400, { error: "Please keep your request under 1,000 characters." });

      const u = await usage();
      const d = decide({ allowance: u.allowance, usedThisMonth: u.usedThisMonth, credits: u.credits, usedToday: u.usedToday, dailyCap });
      if (!d.ok) {
        return d.reason === "daily_cap"
          ? reply(429, { error: "You've made a lot of changes today. Please come back tomorrow, or send us a change request." })
          : reply(402, { needs_more: true, pack, error: "You've used all your AI edits for this month." });
      }

      const key = Deno.env.get("ANTHROPIC_API_KEY");
      if (!key) return reply(503, { error: "AI edits aren't set up yet. Nothing was used." });

      // Refused or unusable answers cost us money but not the customer an edit, so limit attempts per hour too.
      const hourAgo = new Date(Date.now() - 3600_000).toISOString();
      const { count: attempts } = await db.from("form_events").select("id", { count: "exact", head: true })
        .eq("project_id", project.id).eq("kind", "ai_attempt").gte("created_at", hourAgo);
      if (!underAttemptLimit(attempts ?? 0)) return reply(429, { error: "You're going a little fast. Please wait a few minutes and try again." });
      await db.from("form_events").insert({ project_id: project.id, ip_hash: "ai-edit", kind: "ai_attempt" });

      let text = "";
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({
            model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5", max_tokens: 3000,
            messages: [{ role: "user", content: buildPrompt(project.site, message) }],
          }),
          signal: AbortSignal.timeout(25000),
        });
        if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
        const out = await res.json();
        text = (out.content ?? []).map((c: any) => c.text ?? "").join("");
      } catch (e) {
        console.error("ai-edit model call failed", e);
        return reply(502, { error: "The AI couldn't make that change right now. Nothing was used. Please try again." });
      }

      const parsed = parseModelReply(text);
      if (!parsed) return reply(502, { error: "The AI's answer wasn't usable. Nothing was used. Please try rewording your request." });
      if ("unsupported" in parsed) return reply(200, { unsupported: parsed.unsupported });

      const v = validatePatch(project.site, parsed.patch);
      if (!v.ok) return reply(200, { unsupported: `I couldn't make that change safely. ${v.reason} Nothing was used.` });

      await db.from("ai_edits").update({ status: "discarded" }).eq("project_id", project.id).eq("status", "pending");
      const { data: row, error } = await db.from("ai_edits").insert({
        project_id: project.id, user_id: user.id, message, before_site: project.site, after_site: v.site,
        changes: v.changes, note: parsed.note || null, counted: true, used_credit: d.useCredit,
      }).select("id").single();
      if (error) throw error;

      if (d.useCredit) {
        const { data: dec } = await db.from("projects").update({ ai_credits: project.ai_credits - 1 })
          .eq("id", project.id).eq("ai_credits", project.ai_credits).gt("ai_credits", 0).select("id");
        if (!dec?.length) {
          await db.from("ai_edits").delete().eq("id", row.id);
          return reply(409, { error: "Something changed while we were working. Nothing was used. Please try again." });
        }
      }
      return reply(200, { ok: true, id: row.id, changes: v.changes, note: parsed.note });
    }

    if (action === "apply" || action === "discard") {
      const { data: edit } = await db.from("ai_edits").select("*").eq("id", String(body.id ?? "")).eq("user_id", user.id).eq("status", "pending").maybeSingle();
      if (!edit) return reply(404, { error: "That change is no longer waiting. Please make the change again." });
      if (action === "discard") {
        await db.from("ai_edits").update({ status: "discarded" }).eq("id", edit.id);
        return reply(200, { ok: true });
      }
      if (!sitesEqual(edit.before_site, project.site)) {
        await db.from("ai_edits").update({ status: "discarded" }).eq("id", edit.id);
        return reply(409, { error: "Your website was updated since this change was made, so it can't be applied. Please make the change again." });
      }
      const { error } = await db.from("projects").update({ site: edit.after_site, updated_at: new Date().toISOString() }).eq("id", project.id);
      if (error) throw error;
      await db.from("ai_edits").update({ status: "applied", applied_at: new Date().toISOString() }).eq("id", edit.id);
      return reply(200, { ok: true });
    }

    if (action === "undo") {
      const { data: latest } = await db.from("ai_edits").select("*").eq("project_id", project.id).eq("status", "applied")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!latest || latest.id !== String(body.id ?? "")) return reply(404, { error: "There's nothing to undo." });
      if (!sitesEqual(latest.after_site, project.site)) return reply(409, { error: "Your website was updated since this change, so it can't be undone here." });
      const { error } = await db.from("projects").update({ site: latest.before_site, updated_at: new Date().toISOString() }).eq("id", project.id);
      if (error) throw error;
      await db.from("ai_edits").update({ status: "undone" }).eq("id", latest.id);
      return reply(200, { ok: true });
    }

    if (action === "buy") {
      if (!sub?.stripe_customer_id) return reply(409, { error: "You don't have a billing account yet." });
      const site = siteFor(origin);
      const session = await stripe("checkout/sessions", {
        mode: "payment", customer: sub.stripe_customer_id, client_reference_id: user.id,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "gbp",
        "line_items[0][price_data][unit_amount]": String(pack.pence),
        "line_items[0][price_data][product_data][name]": `${pack.size} AI website edits`,
        "metadata[kind]": "ai_credits", "metadata[user_id]": user.id, "metadata[qty]": String(pack.size),
        success_url: `${site}/account.html?ai=bought`, cancel_url: `${site}/account.html?ai=cancelled`,
      });
      return reply(200, { url: session.url });
    }

    return reply(400, { error: "Unknown action." });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "Something went wrong. Nothing was used. Please try again." });
  }
});
