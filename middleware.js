// Serves customers' live websites at <name>.axencraft.co.uk.
// Each live site uses one of our template folders; its content comes from the database.
// Requests to axencraft.co.uk itself (and www) pass straight through.

const SITE_DOMAIN = 'axencraft.co.uk';
const SITE_API = 'https://cvkgnrrskoptdtojcwvz.supabase.co/functions/v1/site-data';
const HOST_RE = /^([a-z0-9]([a-z0-9-]{0,40}[a-z0-9])?)\.axencraft\.co\.uk$/;

const folders = new Map(); // subdomain -> { folder, at }
const CACHE_MS = 60 * 1000;

const pass = () => new Response(null, { headers: { 'x-middleware-next': '1' } });
const rewrite = (url) => new Response(null, { headers: { 'x-middleware-rewrite': url.toString() } });

async function folderFor(sub) {
  const hit = folders.get(sub);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.folder;
  let folder = null;
  try {
    const res = await fetch(`${SITE_API}?host=${sub}&meta=1`);
    if (res.ok) {
      const data = await res.json();
      if (/^(starter|standard|pro)-[a-z]+$/.test(data.folder || '')) folder = data.folder;
    }
  } catch (_) { /* treat as not found */ }
  folders.set(sub, { folder, at: Date.now() });
  return folder;
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const host = (request.headers.get('host') || url.hostname).toLowerCase().replace(/:\d+$/, '');
  const m = host.match(HOST_RE);
  if (!m || m[1] === 'www') return pass();
  const sub = m[1];

  // Shared template files.
  if (url.pathname.startsWith('/_shared/')) {
    url.pathname = '/templates' + url.pathname;
    return rewrite(url);
  }

  // The site's content.
  if (url.pathname === '/site.json') {
    try {
      const res = await fetch(`${SITE_API}?host=${sub}`);
      return new Response(res.ok ? await res.text() : '{"error":"Not found"}', {
        status: res.ok ? 200 : 404,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-cache' },
      });
    } catch (_) {
      return new Response('{"error":"Unavailable"}', { status: 503, headers: { 'content-type': 'application/json' } });
    }
  }

  const folder = await folderFor(sub);
  if (!folder) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Website not found</title>` +
      `<body style="font:18px/1.5 system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 24px;color:#16181d">` +
      `<h1 style="font-size:28px">This website isn’t available</h1><p>There’s no live website at ${sub}.${SITE_DOMAIN} right now.</p>` +
      `<p><a href="https://${SITE_DOMAIN}">Visit Axencraft</a></p>`,
      { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
    );
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
