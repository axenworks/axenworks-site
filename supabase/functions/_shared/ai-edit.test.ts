import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, EDITABLE_KEYS, parseModelReply, sitesEqual, validatePatch } from "./ai-edit.ts";

const site = () => ({
  business_name: "Redline Motors",
  tagline: "Fixed right. First time.",
  intro: "MOTs, servicing and repairs.",
  about: "Our dad opened Redline in 1987.",
  services: [
    { name: "MOT test", description: "Class 4 and 7.", price: "£45" },
    { name: "Brakes", description: "Pads and discs.", price: "From £95" },
  ],
  team: [{ name: "Sam", role: "Owner", bio: "", photo: "https://x.test/sam.jpg" }],
  faq: [],
  contact: { phone: "0113 000", email: "hi@redline.test", area: "Leeds", hours: "Mon-Fri 8-6", address: null },
  colours: { main: "#1d2b4f", accent: "#b08a3e" },
  hero_image: "https://x.test/hero.jpg",
  gallery: [{ src: "https://x.test/1.jpg", caption: "" }],
  _meta: { level: "standard" },
});
const ok = (r: any) => { assert.equal(r.ok, true, r.reason); return r; };
const bad = (r: any) => { assert.equal(r.ok, false); return r.reason as string; };

test("accepts a text change to tagline", () => {
  const r = ok(validatePatch(site(), { tagline: "Honest garage work in Leeds." }));
  assert.equal(r.site.tagline, "Honest garage work in Leeds.");
  assert.equal(r.changes.length, 1);
  assert.equal(r.changes[0].before, "Fixed right. First time.");
  assert.equal(r.changes[0].after, "Honest garage work in Leeds.");
});

test("accepts adding a service with the same keys", () => {
  const services = [...site().services, { name: "Diagnostics", description: "Fault finding.", price: "£60" }];
  const r = ok(validatePatch(site(), { services }));
  assert.equal(r.site.services.length, 3);
  assert.equal(r.site.services[2].price, "£60");
});

test("does not change the original site object", () => {
  const s = site();
  validatePatch(s, { tagline: "New" });
  assert.equal(s.tagline, "Fixed right. First time.");
});

test("rejects keys outside the editable list", () => {
  for (const key of ["hero_image", "_meta", "gallery", "logo"]) {
    assert.match(bad(validatePatch(site(), { [key]: "x" })), /can't be changed|cannot be changed/i);
  }
});

test("rejects a value of the wrong type", () => {
  bad(validatePatch(site(), { services: "lots of services" }));
  bad(validatePatch(site(), { tagline: ["a"] }));
});

test("rejects html and angle brackets", () => {
  bad(validatePatch(site(), { tagline: "<script>alert(1)</script>" }));
  bad(validatePatch(site(), { tagline: "5 > 3" }));
  bad(validatePatch(site(), { services: [{ name: "<b>x</b>", description: "", price: "" }] }));
});

test("rejects javascript: in any string", () => {
  bad(validatePatch(site(), { about: "click JavaScript:alert(1)" }));
});

test("colours must be #rrggbb", () => {
  bad(validatePatch(site(), { colours: { main: "red", accent: "#b08a3e" } }));
  bad(validatePatch(site(), { colours: { main: "#12", accent: "#b08a3e" } }));
  const r = ok(validatePatch(site(), { colours: { main: "#112233", accent: "#b08a3e" } }));
  assert.equal(r.site.colours.main, "#112233");
});

test("keeps image fields: existing item keeps its photo, new item gets null", () => {
  const team = [
    { name: "Sam", role: "Owner", bio: "", photo: "https://evil.test/new.jpg" },
    { name: "Alex", role: "Mechanic", bio: "", photo: "https://evil.test/alex.jpg" },
  ];
  const r = ok(validatePatch(site(), { team }));
  assert.equal(r.site.team[0].photo, "https://x.test/sam.jpg");
  assert.equal(r.site.team[1].photo, null);
});

test("accepts new items for an empty list using the known shape and drops unknown item keys", () => {
  const r = ok(validatePatch(site(), { faq: [{ q: "Do you do MOTs?", a: "Yes.", evil: "x" }] }));
  assert.deepEqual(r.site.faq, [{ q: "Do you do MOTs?", a: "Yes." }]);
});

test("enforces length caps", () => {
  bad(validatePatch(site(), { tagline: "x".repeat(161) }));
  bad(validatePatch(site(), { about: "x".repeat(3001) }));
  const many = Array.from({ length: 31 }, (_, i) => ({ name: "S" + i, description: "", price: "" }));
  bad(validatePatch(site(), { services: many }));
});

test("contact.hours keeps its existing type", () => {
  const r = ok(validatePatch(site(), { contact: { ...site().contact, hours: "Mon-Sat 9-5" } }));
  assert.equal(r.site.contact.hours, "Mon-Sat 9-5");
  bad(validatePatch(site(), { contact: { ...site().contact, hours: [["Mon", "9-5"]] } }));
});

test("an empty patch is not a change", () => {
  bad(validatePatch(site(), {}));
  bad(validatePatch(site(), { tagline: site().tagline }));
});

test("rejects a patch that is not an object", () => {
  bad(validatePatch(site(), null));
  bad(validatePatch(site(), "tagline"));
  bad(validatePatch(site(), [1]));
});

test("parseModelReply reads plain JSON, fenced JSON, unsupported and junk", () => {
  assert.deepEqual(parseModelReply('{"patch":{"tagline":"Hi"},"note":"Done."}'), { patch: { tagline: "Hi" }, note: "Done." });
  assert.deepEqual(parseModelReply('Here you go:\n```json\n{"patch":{"tagline":"Hi"},"note":"Done."}\n```'), { patch: { tagline: "Hi" }, note: "Done." });
  assert.deepEqual(parseModelReply('{"unsupported":"I can\'t add pages."}'), { unsupported: "I can't add pages." });
  assert.equal(parseModelReply("sorry, I cannot do that"), null);
  assert.equal(parseModelReply('{"patch": 5}'), null);
});

test("sitesEqual ignores key order", () => {
  assert.equal(sitesEqual({ a: 1, b: { c: 2, d: [1, 2] } }, { b: { d: [1, 2], c: 2 }, a: 1 }), true);
  assert.equal(sitesEqual({ a: 1 }, { a: 2 }), false);
});

test("buildPrompt contains the request and editable values but not protected values", () => {
  const p = buildPrompt(site(), "Change the opening hours to 9 to 6");
  assert.match(p, /Change the opening hours to 9 to 6/);
  assert.match(p, /Redline Motors/);
  assert.doesNotMatch(p, /hero\.jpg/);
  for (const k of EDITABLE_KEYS) assert.ok(p.includes(k));
});

test("resubmitting existing items that have no image fields is not a change", () => {
  const s = { ...site(), team: [{ name: "Mick", role: "Manager", bio: "Thirty years on the tools." }] };
  assert.match(bad(validatePatch(s, { team: s.team })), /exactly as it is/);
});
