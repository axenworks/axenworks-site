// Public, read-only: returns a customer's draft website content for its private
// preview link (?token=...). Only someone with the secret token can load it.
import { admin, siteFor } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = {
    "Access-Control-Allow-Origin": siteFor(origin),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });

  const { data } = await admin().from("projects").select("site").eq("preview_token", token).maybeSingle();
  if (!data?.site) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
  return new Response(JSON.stringify(data.site), { headers });
});
