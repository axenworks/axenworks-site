// Small helpers shared by the Axencraft edge functions.
import { createClient } from "jsr:@supabase/supabase-js@2";

export const PLAN_PRICES: Record<string, string> = {
  starter: "price_1UZtVKGbMox0LPSQjpv4SOaS", // £19.99 / month
  standard: "price_1UZtVLGbMox0LPSQPSrc3pjW", // £39.99 / month
  pro: "price_1UZtVMGbMox0LPSQoSRlBZcr", // £59.99 / month
};
export const SETUP_FEE_PRICE = "price_1UZtVKGbMox0LPSQNbgIuHaJ"; // £50 one-off

export const PORTAL_CONFIG = "bpc_1UZtz2GbMox0LPSQzYxEXItR";

// Which website origins may call our functions and be sent back to.
export const ORIGIN_OK =
  /^https:\/\/axenworks-site(-[a-z0-9-]+)?\.vercel\.app$|^https:\/\/([a-z0-9-]+\.)?axencraft\.co\.uk$|^http:\/\/localhost(:\d+)?$/;
export const DEFAULT_ORIGIN = "https://axencraft.co.uk";
export const SITE_DOMAIN = "axencraft.co.uk";

// Turn a business name into a web address part: "Joe's Plumbing Ltd" -> "joes-plumbing-ltd".
export function slugify(name: string) {
  return name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ")
    .replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "") || "site";
}

export function siteFor(origin: string | null) {
  return origin && ORIGIN_OK.test(origin) ? origin : DEFAULT_ORIGIN;
}

export function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": siteFor(origin),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

// Call the Stripe API without an SDK. Nested params use Stripe's bracket syntax.
export async function stripe(
  path: string,
  params?: Record<string, string>,
  method: "GET" | "POST" = "POST",
) {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "POST" && params ? new URLSearchParams(params).toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe error ${res.status}`);
  return data;
}
