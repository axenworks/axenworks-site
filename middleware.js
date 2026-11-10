// Serves customers' live websites, either at <name>.axencraft.co.uk or on the
// customer's own domain. Each live site uses one of our template folders; its
// content comes from the database. Requests to axencraft.co.uk itself (and www),
// and to our vercel.app addresses, pass straight through.

const SITE_DOMAIN = 'axencraft.co.uk';
const FN = 'https://cvkgnrrskoptdtojcwvz.supabase.co/functions/v1';
const SUB_RE = /^([a-z0-9]([a-z0-9-]{0,40}[a-z0-9])?)\.axencraft\.co\.uk$/;

const folders = new Map(); // site key -> { folder, at }
const CACHE_MS = 60 * 1000;

const pass = () => new Response(null, { headers: { 'x-middleware-next': '1' } });
const rewrite = (url) => new Response(null, { headers: { 'x-middleware-rewrite': url.toString() } });

// Which customer site (if any) a hostname belongs to, as a query string for our functions.
function siteKey(host) {
  if (host === SITE_DOMAIN || host === 'www.' + SITE_DOMAIN) return null;
  const m = host.match(SUB_RE);
  if (m) return m[1] === 'www' ? null : 'host=' + m[1];
  if (/\.vercel\.app$/.test(host) || host === 'localhost' || /^[\d.]+$/.test(host) || !host.includes('.')) return null;
  return 'domain=' + encodeURIComponent(host.replace(/^www\./, ''));
}

async function folderFor(key) {
  const hit = folders.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.folder;
  let folder = null;
  try {
    const res = await fetch(`${FN}/site-data?${key}&meta=1`);
    if (res.ok) {
      const data = await res.json();
      if (data.offline) folder = 'offline';
      else if (/^(starter|standard|pro)-[a-z]+$/.test(data.folder || '')) folder = data.folder;
    }
  } catch (_) { /* treat as not found */ }
  folders.set(key, { folder, at: Date.now() });
  return folder;
}

const page = (status, title, body) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>` +
  `<body style="font:18px/1.5 system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 24px;color:#16181d">${body}`,
  { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
);

export default async function middleware(request) {
  const url = new URL(request.url);
  const host = (request.headers.get('host') || url.hostname).toLowerCase().replace(/:\d+$/, '');
  const key = siteKey(host);
  if (!key) return pass();

  // Shared template files.
  if (url.pathname.startsWith('/_shared/')) {
    url.pathname = '/templates' + url.pathname;
    return rewrite(url);
  }

  // The site's content.
  if (url.pathname === '/site.json') {
    try {
      const res = await fetch(`${FN}/site-data?${key}`);
      return new Response(res.ok ? await res.text() : '{"error":"Not found"}', {
        status: res.ok ? 200 : 404,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-cache' },
      });
    } catch (_) {
      return new Response('{"error":"Unavailable"}', { status: 503, headers: { 'content-type': 'application/json' } });
    }
  }

  // Messages from the site's forms, passed on to be emailed to the business.
  if (url.pathname === '/api/contact') {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    try {
      const res = await fetch(`${FN}/site-contact?${key}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-axc-secret': process.env.AXC_FORM_SECRET || '',
          'x-axc-ip': request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || '',
        },
        body: (await request.text()).slice(0, 20000),
      });
      return new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    } catch (_) {
      return new Response('{"error":"Sorry, your message couldn\'t be sent. Please try again later."}', { status: 503, headers: { 'content-type': 'application/json' } });
    }
  }

  const folder = await folderFor(key);
  if (folder === 'offline') {
    return page(503, 'Temporarily unavailable',
      `<h1 style="font-size:28px">This website is temporarily unavailable</h1><p>Please check back soon.</p>` +
      `<p style="color:#585e69;font-size:15px">If this is your website, log in to your <a href="https://${SITE_DOMAIN}/account.html">Axencraft account</a> to bring it back online.</p>`);
  }
  if (!folder) {
    return page(404, 'Website not found',
      `<h1 style="font-size:28px">This website isn’t available</h1><p>There’s no live website at ${host.replace(/[<>&"]/g, '')} right now.</p>` +
      `<p><a href="https://${SITE_DOMAIN}">Visit Axencraft</a></p>`);
  }

  let path = url.pathname;
  if (path === '/' || path === '') path = '/index.html';
  if (!/^\/[a-z0-9-]+\.(html|css)$/.test(path)) {
    url.pathname = '/templates/' + folder + '/404-not-a-page';
    return rewrite(url);
  }
  url.pathname = '/templates/' + folder + path;
  return rewrite(url);
}
