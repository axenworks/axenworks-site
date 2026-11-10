// Lets a customer connect their own domain (e.g. joesplumbing.co.uk) to their live website.
//  action "status": the connected domain, whether it's working, and the DNS records to add
//  action "add" { domain }: attach the domain (and www.) to our Vercel project
//  action "remove": detach it
// Needs a VERCEL_TOKEN secret (a Vercel access token for the axenworks team).
import { admin, cors } from "../_shared/stripe.ts";

const PROJECT = "prj_fw5toiijNeaw7RhFzhvqdYg6nVT9";
const TEAM = "team_mAalV1hfTw0bCbcfQ32XXtiq";
const SECOND_LEVEL = ["co", "org", "me", "ltd", "plc", "net", "ac", "gov", "nhs", "sch", "com"];

async function vercel(path: string, method = "GET", body?: unknown) {
  const token = Deno.env.get("VERCEL_TOKEN");
  if (!token) throw new Error("not_configured");
  const res = await fetch(`https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${TEAM}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// "https://www.Joes-Plumbing.co.uk/about" -> "joes-plumbing.co.uk"
function normalise(input: string) {
  return String(input ?? "").trim().toLowerCase()
    .replace(/^[a-z]+:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "").replace(/\.$/, "").replace(/^www\./, "");
}
function isApex(d: string) {
  const parts = d.split(".");
  if (parts.length === 2) return true;
  return parts.length === 3 && parts[2].length === 2 && SECOND_LEVEL.includes(parts[1]);
}

async function describe(domain: string) {
  const apex = isApex(domain);
  const [cfg, pd] = await Promise.all([
    vercel(`/v6/domains/${domain}/config`),
    vercel(`/v9/projects/${PROJECT}/domains/${domain}`),
  ]);
  let verified = pd.ok ? !!pd.data.verified : false;
  let verification = pd.ok ? (pd.data.verification ?? []) : [];
  if (pd.ok && !verified) {
    const v = await vercel(`/v9/projects/${PROJECT}/domains/${domain}/verify`, "POST");
    if (v.ok) { verified = !!v.data.verified; verification = v.data.verification ?? verification; }
  }
  const ip = cfg.data?.recommendedIPv4?.[0]?.value?.[0] ?? "76.76.21.21";
  const cname = String(cfg.data?.recommendedCNAME?.[0]?.value ?? "cname.vercel-dns.com.").replace(/\.$/, "");
  const sub = apex ? "" : domain.split(".")[0];
  const records = apex
    ? [{ type: "A", name: "@", value: ip, note: "Leave the name blank or use @" },
       { type: "CNAME", name: "www", value: cname, note: "" }]
    : [{ type: "CNAME", name: sub, value: cname, note: "" }];
  const zone = apex ? domain : domain.split(".").slice(1).join(".");
  for (const v of verification) {
    const full = String(v.domain ?? "");
    const name = full === zone ? "@" : full.endsWith("." + zone) ? full.slice(0, -(zone.length + 1)) : full;
    records.push({ type: v.type, name, value: v.value, note: "Proves you own the domain" });
  }
  const connected = verified && cfg.ok && cfg.data?.misconfigured === false;
  return { domain, apex, connected, records };
}

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
    const { data: project } = await db.from("projects").select("id,status,custom_domain").eq("user_id", user.id).maybeSingle();
    if (!project || project.status !== "live") return reply(409, { error: "You can connect your own domain once your website is live." });

    if (body.action === "status") {
      if (!project.custom_domain) return reply(200, { domain: null });
      return reply(200, await describe(project.custom_domain));
    }

    if (body.action === "remove") {
      const d = project.custom_domain;
      if (d) {
        await vercel(`/v9/projects/${PROJECT}/domains/${d}`, "DELETE");
        if (isApex(d)) await vercel(`/v9/projects/${PROJECT}/domains/www.${d}`, "DELETE");
        await db.from("projects").update({ custom_domain: null }).eq("id", project.id);
      }
      return reply(200, { domain: null });
    }

    if (body.action === "add") {
      const { data: sub } = await db.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle();
      if (!["trialing", "active", "past_due"].includes(sub?.status ?? "")) return reply(409, { error: "You need an active plan to connect a domain." });
      if (project.custom_domain) return reply(409, { error: "Disconnect your current domain first." });
      const d = normalise(body.domain);
      if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d)) return reply(400, { error: "That doesn't look like a domain name. It should look like yourbusiness.co.uk." });
      if (/(^|\.)axencraft\.co\.uk$|\.vercel\.app$/.test(d)) return reply(400, { error: "Please enter a domain you own." });
      const { data: taken } = await db.from("projects").select("id").eq("custom_domain", d).neq("id", project.id).maybeSingle();
      if (taken) return reply(409, { error: "That domain is already connected to another website." });

      const add = await vercel(`/v10/projects/${PROJECT}/domains`, "POST", { name: d });
      if (!add.ok && add.data?.error?.code !== "domain_already_in_project") {
        const code = add.data?.error?.code ?? "";
        console.error("vercel add", add.status, JSON.stringify(add.data));
        if (code === "domain_already_in_use" || code === "domain_taken") return reply(409, { error: "That domain is already being used by another website host. Remove it there first, or contact us for help." });
        if (code === "invalid_domain") return reply(400, { error: "That doesn't look like a valid domain name." });
        return reply(502, { error: "Couldn't connect that domain right now. Please try again, or contact us." });
      }
      if (isApex(d)) await vercel(`/v10/projects/${PROJECT}/domains`, "POST", { name: `www.${d}`, redirect: d, redirectStatusCode: 308 });
      const { error } = await db.from("projects").update({ custom_domain: d }).eq("id", project.id);
      if (error) throw error;
      return reply(200, await describe(d));
    }

    return reply(400, { error: "Unknown action." });
  } catch (err) {
    if ((err as Error).message === "not_configured") return reply(503, { error: "Connecting your own domain isn't switched on yet. Please contact us and we'll set it up for you." });
    console.error(err);
    return reply(500, { error: "Something went wrong. Please try again." });
  }
});
