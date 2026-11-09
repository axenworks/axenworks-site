// Admin-only: turns a customer's questionnaire answers into draft website content
// (the same shape as each template's site.json). Optionally polishes the wording
// with Claude if an ANTHROPIC_API_KEY secret is set. Saves to projects.site.
import { admin, cors } from "../_shared/stripe.ts";

type Answers = Record<string, any>;

const lines = (t?: string) => String(t ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const firstSentences = (t: string, max = 180) => {
  const s = t.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > 40 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…";
};
const SPLIT = /\s+[|–—-]\s+|\s*\|\s*/;

// Palettes used when the customer asks us to choose colours, picked from their first style word.
const PALETTES: Record<string, [string, string]> = {
  Modern: ["#2563eb", "#14b8a6"], Friendly: ["#e76f51", "#2a9d8f"], Professional: ["#1d3557", "#e9c46a"],
  Playful: ["#7c3aed", "#f59e0b"], Luxury: ["#1f2937", "#c9a227"], Calm: ["#4a7c74", "#d4a373"],
  Bold: ["#e11d48", "#f5b700"], Traditional: ["#5b3a29", "#b08d57"],
};

function parseServices(t?: string) {
  return lines(t).map((l) => {
    const parts = l.split(SPLIT).map((p) => p.trim()).filter(Boolean);
    let price = "";
    const last = parts[parts.length - 1];
    if (parts.length > 1 && /£|\d/.test(last)) price = parts.pop()!;
    const name = parts.shift() ?? l;
    if (price && /^£?\d/.test(price)) price = "From " + price.replace(/^(\d)/, "£$1");
    price = price.replace(/^from\b/i, "From");
    return { name, description: parts.join(" — "), price };
  });
}
function parseReviews(t?: string) {
  return lines(t).map((l) => {
    const m = l.match(/^["“']?(.+?)["”']?\s+[–—-]\s*([^–—-]{2,40})$/);
    return m ? { quote: m[1].trim(), name: m[2].trim(), detail: "", rating: 5 } : { quote: l.replace(/^["“']|["”']$/g, ""), name: "A happy customer", detail: "", rating: 5 };
  });
}
function parseHours(t?: string) {
  return lines(t).map((l) => {
    const i = l.search(/:\s|\s[–—-]\s/);
    return i > 0 ? [l.slice(0, i).trim(), l.slice(i).replace(/^[:\s–—-]+/, "").trim()] : ["", l];
  });
}
function parseTeam(t?: string) {
  return lines(t).map((l) => {
    const parts = l.split(/\s+[–—-]\s+|,\s*/).map((p) => p.trim()).filter(Boolean);
    return { name: parts[0] ?? l, role: parts[1] ?? "", bio: parts.slice(2).join(", "), photo: null };
  });
}
function parseTitled(t?: string) {
  return lines(t).map((l) => {
    const i = l.search(/[:–—-]\s/);
    return i > 0 ? { title: l.slice(0, i).trim(), text: l.slice(i + 1).replace(/^[\s–—-]+/, "").trim() } : { title: l, text: "" };
  });
}
function parseFaq(t?: string) {
  return lines(t).map((l) => {
    const i = l.indexOf("?");
    return i > 0 ? { q: l.slice(0, i + 1).trim(), a: l.slice(i + 1).trim() } : { q: l, a: "" };
  }).filter((f) => f.q);
}
function parseProjects(t?: string) {
  return lines(t).map((l) => {
    const parts = l.split(/\s+[|–—-]\s+|,\s*/).map((p) => p.trim()).filter(Boolean);
    return { title: parts[0] ?? l, location: parts[1] ?? "", category: "", summary: parts.slice(2).join(", "), details: "", before: null, after: null, images: [] };
  });
}
function parseProcess(t?: string) {
  const ls = lines(t);
  const items = ls.length === 1 && ls[0].includes(",") ? ls[0].split(",").map((x) => x.trim()) : ls;
  return items.filter(Boolean).map((l) => {
    const i = l.search(/[:–—-]\s/);
    return i > 0 ? { title: l.slice(0, i).trim(), text: l.slice(i + 1).replace(/^[\s–—-]+/, "").trim() } : { title: l, text: "" };
  });
}
function socials(t?: string) {
  return lines(t).filter((u) => /^https?:\/\//i.test(u) || /\.\w{2,}/.test(u)).map((u) => {
    const url = /^https?:/i.test(u) ? u : "https://" + u;
    let host = ""; try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { host = u; }
    const label = host.split(".")[0];
    return { label: label.charAt(0).toUpperCase() + label.slice(1), url };
  });
}

async function polishWithClaude(a: Answers, site: any) {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return { site, polished: false };
  const prompt = `You write website copy for small UK businesses. Using the questionnaire answers and the draft content below, return ONLY a JSON object with improved versions of these fields: tagline (max 8 words), intro (1-2 sentences, max 35 words), cta_label (2-4 words), about_title (max 5 words), about (2 short paragraphs separated by a blank line), services (same items and order, each with name unchanged, a 1-sentence description, price unchanged), values (same items, title max 4 words, text 1 sentence). Use British English. Do not invent facts, awards, prices, years, numbers or guarantees that are not in the answers.

ANSWERS:
${JSON.stringify(a, null, 1).slice(0, 12000)}

DRAFT:
${JSON.stringify({ tagline: site.tagline, intro: site.intro, cta_label: site.cta_label, about_title: site.about_title, about: site.about, services: site.services, values: site.values })}`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5", max_tokens: 2500, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
    const out = await res.json();
    const text = (out.content ?? []).map((c: any) => c.text ?? "").join("");
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    for (const k of ["tagline", "intro", "cta_label", "about_title", "about"]) if (typeof json[k] === "string" && json[k].trim()) site[k] = json[k].trim();
    if (Array.isArray(json.services) && json.services.length === site.services.length) {
      site.services = site.services.map((s: any, i: number) => ({ ...s, description: json.services[i]?.description || s.description }));
    }
    if (Array.isArray(json.values) && json.values.length === (site.values ?? []).length) site.values = json.values.map((v: any, i: number) => ({ title: v.title || site.values[i].title, text: v.text || site.values[i].text }));
    return { site, polished: true };
  } catch (e) {
    console.error("AI polish skipped:", e);
    return { site, polished: false };
  }
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
    if (!auth?.user) return reply(401, { error: "Please log in again." });
    const { data: isAdmin } = await db.from("admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
    if (!isAdmin) return reply(403, { error: "Admins only." });

    const { project_id } = await req.json().catch(() => ({}));
    const { data: p } = await db.from("projects").select("*").eq("id", project_id).maybeSingle();
    if (!p) return reply(404, { error: "Project not found." });
    if (!p.template) return reply(409, { error: "The customer hasn't picked a style yet." });
    const { data: sub } = await db.from("subscriptions").select("plan").eq("user_id", p.user_id).maybeSingle();
    const level = ["starter", "standard", "pro"].includes(sub?.plan) ? sub!.plan : "starter";
    const a: Answers = p.answers ?? {};
    const name = (a.business_name || "Your business").trim();

    // Copy the customer's uploads into the public 'sites' bucket under this project's secret token.
    const folder = `${p.preview_token}`;
    async function publish(path?: string | null) {
      if (!path) return null;
      const file = path.split("/").pop()!;
      const { data: blob, error } = await db.storage.from("project-uploads").download(path);
      if (error || !blob) return null;
      const dest = `${folder}/${file}`;
      const up = await db.storage.from("sites").upload(dest, blob, { upsert: true, contentType: blob.type || undefined });
      if (up.error) return null;
      return db.storage.from("sites").getPublicUrl(dest).data.publicUrl;
    }
    const logo = await publish(a.logo);
    const photos = (await Promise.all((a.photos ?? []).map((x: string) => publish(x)))).filter(Boolean) as string[];

    const services = parseServices(a.services);
    const about = (a.story || a.business_about || "").trim();
    const colours = a.colour_choice === "mine"
      ? { main: a.colour_main || "#2430d6", accent: a.colour_second || "#ffb703" }
      : (() => { const p = PALETTES[(a.style_words ?? [])[0]]; return p ? { main: p[0], accent: p[1] } : undefined; })();
    const hours = parseHours(a.hours);
    const stats = [1, 2, 3].map((n) => ({ value: (a[`stat${n}_value`] ?? "").trim(), label: (a[`stat${n}_label`] ?? "").trim() })).filter((s) => s.value);
    const team = parseTeam(a.team).map((m, i) => ({ ...m, photo: null as string | null, _i: i }));
    const reviews = parseReviews(a.reviews);

    let site: any = {
      business_name: name,
      tagline: (a.tagline || "").trim() || `${name}${a.location ? ", " + a.location.trim() : ""}`,
      intro: firstSentences(a.business_about || a.story || ""),
      cta_label: "Get in touch",
      trust: [],
      trust_line: a.location ? `Serving ${a.location.trim()}` : "",
      highlights: stats,
      about_title: `About ${name}`,
      about,
      services: services.length ? services : [{ name: "Our services", description: firstSentences(a.business_about || "", 140), price: "" }],
      values: parseTitled(a.values),
      process: parseProcess(a.process),
      faq: parseFaq(a.faq),
      projects: parseProjects(a.projects),
      testimonials: reviews,
      team: team.map(({ _i, ...m }) => m),
      owner: team[0] ? { name: team[0].name, role: team[0].role, bio: team[0].bio, photo: null } : null,
      gallery: photos.map((src, i) => ({ src, caption: "" })),
      contact: {
        phone: (a.contact_phone || "").trim(),
        email: (a.contact_email || "").trim(),
        area: (a.location || "").trim(),
        hours: level === "starter" ? hours.map((h) => h.filter(Boolean).join(": ")).join(", ") : hours,
        address: null,
      },
      socials: socials(a.socials),
      logo,
      hero_image: photos[0] ?? null,
      about_image: photos[1] ?? photos[0] ?? null,
      packages: [],
      timeline: [],
    };
    if (colours) site.colours = colours;
    // Pro portfolio: give each project a photo, cycling through what was uploaded.
    if (photos.length) site.projects = site.projects.map((pr: any, i: number) => ({ ...pr, after: photos[i % photos.length], images: [] }));

    const polished = await polishWithClaude(a, site);
    site = polished.site;
    site._meta = { level, style: p.template, built_at: new Date().toISOString(), ai: polished.polished };

    const { error } = await db.from("projects").update({
      site, built_at: new Date().toISOString(),
      status: ["draft", "submitted", "generating"].includes(p.status) ? "in_review" : p.status,
    }).eq("id", p.id);
    if (error) throw error;

    return reply(200, { ok: true, level, style: p.template, token: p.preview_token, ai: polished.polished });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "Couldn't build the draft. Please try again." });
  }
});
