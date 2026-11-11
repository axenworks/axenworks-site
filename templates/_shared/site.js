/* Axencraft website engine.
   One script renders every customer website. The <body> says which plan level
   (starter, standard, pro), which style and which page this is. Content comes from:
     - site.json next to the page            (template previews, sample business)
     - /site.json on the site's own address  (live customer websites)
     - the site-data function, ?site=<token> (a customer's private draft preview)
   Nothing here invents facts about a business: every claim on the page comes from the data. */
(function () {
  'use strict';
  var B = document.body, LV = B.dataset.level, ST = B.dataset.style, PAGE = B.dataset.page || 'home';
  var Q = new URLSearchParams(location.search), TOKEN = Q.get('site');
  var LIVE = !/\/templates\//.test(location.pathname);
  var FN = 'https://cvkgnrrskoptdtojcwvz.supabase.co/functions/v1';
  var app = document.getElementById('app'), d, C, SAMPLE = false, artN = 0, INIT = 'A';
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PREVIEW_NOTE = 'This is a preview, so nothing was sent. On the live website, messages go straight to the business by email.';
  var NAV = {
    starter: [],
    standard: [['home', 'Home', 'index.html'], ['about', 'About', 'about.html'], ['services', 'Services', 'services.html'], ['gallery', 'Gallery', 'gallery.html'], ['contact', 'Contact', 'contact.html']],
    pro: [['home', 'Home', 'index.html'], ['about', 'About', 'about.html'], ['services', 'Services', 'services.html'], ['portfolio', 'Our work', 'portfolio.html'], ['reviews', 'Reviews', 'reviews.html'], ['faq', 'FAQ', 'faq.html'], ['contact', 'Contact', 'contact.html']]
  };

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function paras(t) { return String(t || '').split(/\n\s*\n/).filter(Boolean).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join(''); }
  function href(p) { return TOKEN ? p + (p.indexOf('?') > -1 ? '&' : '?') + 'site=' + encodeURIComponent(TOKEN) : p; }
  function tel(p) { return String(p).replace(/[^\d+]/g, ''); }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function photos() { return arr(d.gallery).filter(function (g) { return g && (g.src || SAMPLE); }); }
  function has(key) {
    if (key === 'gallery') return photos().length > 0;
    if (key === 'portfolio') return arr(d.projects).length > 0;
    if (key === 'reviews') return arr(d.testimonials).length > 0;
    if (key === 'faq') return arr(d.faq).length > 0;
    return true;
  }
  function hours() {
    var h = C.hours;
    if (Array.isArray(h)) return h.filter(function (r) { return r && (r[0] || r[1]); });
    return h ? [['', String(h)]] : [];
  }
  function stars(n) { n = Math.max(1, Math.min(5, Math.round(n || 5))); return '<span class="stars" role="img" aria-label="' + n + ' out of 5 stars">' + '★★★★★'.slice(0, n) + '</span>'; }

  /* ---------- colour: any two customer colours must stay readable ---------- */
  function hex(h) { var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || '').trim()); if (!m) return null; var s = m[1]; if (s.length === 3) s = s.replace(/./g, '$&$&'); return [0, 2, 4].map(function (i) { return parseInt(s.substr(i, 2), 16); }); }
  function lum(c) { var a = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function mix(a, b, t) { return a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }); }
  function rgb(c) { return 'rgb(' + c.join(',') + ')'; }
  function tune(c, bg, toward, min) { for (var t = 0; t <= 1.001; t += 0.06) { var m = mix(c, toward, t); if (contrast(m, bg) >= (min || 4.5)) return m; } return toward; }
  function applyColours(col) {
    var root = document.documentElement, cs = getComputedStyle(root), got = {}, on = {};
    ['main', 'accent'].forEach(function (k) {
      var c = hex(col && col[k]) || hex(cs.getPropertyValue('--' + k));
      if (!c) return;
      got[k] = c; on[k] = contrast(c, [255, 255, 255]) >= contrast(c, [17, 17, 17]) ? [255, 255, 255] : [17, 17, 17];
      root.style.setProperty('--' + k, rgb(c));
      root.style.setProperty('--on-' + k, rgb(on[k]));
      /* -ink reads on light paper, -bright reads on dark */
      root.style.setProperty('--' + k + '-ink', rgb(tune(c, [255, 255, 255], [0, 0, 0], 5.8)));
      root.style.setProperty('--' + k + '-bright', rgb(tune(c, [28, 28, 28], [255, 255, 255], 5.8)));
    });
    if (got.main && got.accent) {
      root.style.setProperty('--accent-on-main', rgb(tune(got.accent, got.main, on.main)));
      root.style.setProperty('--main-on-accent', rgb(tune(got.main, got.accent, on.accent)));
    }
  }

  /* ---------- artwork: each style has its own drawn language for picture slots ---------- */
  function rand(seed) { var s = (seed * 9301 + 49297) % 233280; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function art(seed, tall) {
    var r = rand(seed + 3), W = 400, H = tall ? 500 : 300, id = 'a' + (++artN), o = '';
    function n(a, b) { return Math.round(a + (b - a) * r()); }
    if (ST === 'classic') {
      var k = seed % 3, cy = H / 2;
      o += '<rect class="a-ln" x="14" y="14" width="' + (W - 28) + '" height="' + (H - 28) + '"/><rect class="a-ln" x="21" y="21" width="' + (W - 42) + '" height="' + (H - 42) + '"/>';
      if (k === 0) o += '<ellipse class="a-m" cx="200" cy="' + cy + '" rx="' + (H * 0.27) + '" ry="' + (H * 0.34) + '"/>';
      else if (k === 1) o += '<path class="a-m" d="M120 ' + (H - 40) + 'V' + (H * 0.42) + 'a80 80 0 0 1 160 0V' + (H - 40) + 'z"/>';
      else o += '<path class="a-m" d="M200 ' + (cy - H * 0.36) + 'L' + (200 + H * 0.3) + ' ' + cy + 'L200 ' + (cy + H * 0.36) + 'L' + (200 - H * 0.3) + ' ' + cy + 'z"/>';
      o += '<text class="a-t" x="200" y="' + (cy + (k === 1 ? H * 0.1 : 0)) + '" text-anchor="middle" dominant-baseline="central" font-size="' + (H * 0.3) + '">' + INIT + '</text>';
      o += '<path class="a-a" d="M52 ' + cy + 'l9 -9 9 9 -9 9zM330 ' + cy + 'l9 -9 9 9 -9 9z"/>';
    } else if (ST === 'bold') {
      o += '<rect class="a-a" width="' + W + '" height="' + H + '"/><rect class="a-m" x="' + n(-20, 120) + '" y="' + n(H * 0.5, H * 0.7) + '" width="' + n(180, 300) + '" height="' + H + '"/>';
      o += '<g transform="rotate(-24 ' + n(240, 320) + ' 80)">';
      for (var i = 0; i < 7; i++) o += '<rect class="a-i" x="' + (240 + i * 26) + '" y="-60" width="12" height="260"/>';
      o += '</g><text class="a-ti" x="' + n(40, 150) + '" y="' + (H * 0.74) + '" font-size="' + (H * 1.05) + '" transform="rotate(' + n(-8, 6) + ' 200 ' + (H / 2) + ')">' + INIT + '</text>';
    } else if (ST === 'minimal') {
      var cx = n(150, 250), cyy = H * 0.44, rr = n(58, 88);
      o += '<circle class="a-ln" cx="' + cx + '" cy="' + cyy + '" r="' + rr + '"/><circle class="a-a" cx="' + (cx + rr * 0.72) + '" cy="' + (cyy - rr * 0.7) + '" r="10"/>';
      o += '<path class="a-ln" d="M40 ' + (H * 0.8) + 'H' + (W - 40) + '"/>';
      if (seed % 2) o += '<path class="a-ln" d="M' + (cx - rr - 30) + ' ' + (H * 0.8) + 'a' + (rr + 30) + ' ' + (rr + 30) + ' 0 0 1 ' + (2 * rr + 60) + ' 0"/>';
    } else if (ST === 'playful') {
      o += '<circle class="a-m" cx="' + n(130, 220) + '" cy="' + n(H * 0.4, H * 0.55) + '" r="' + n(95, 125) + '"/>';
      o += '<rect class="a-a" x="' + n(210, 260) + '" y="' + n(H * 0.45, H * 0.6) + '" width="130" height="130" rx="38" transform="rotate(' + n(-18, 18) + ' 290 ' + (H * 0.6) + ')"/>';
      o += '<path class="a-sq" d="M' + n(30, 70) + ' ' + n(H * 0.78, H * 0.88) + 'q18 -30 36 0t36 0t36 0t36 0t36 0"/>';
      for (var j = 0; j < 4; j++) { var sx = n(30, 370), sy = n(24, H * 0.36); o += '<path class="a-i" d="M' + sx + ' ' + (sy - 11) + 'l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z"/>'; }
      o += '<circle class="a-o" cx="' + n(300, 350) + '" cy="' + n(50, 110) + '" r="22"/>';
    } else if (ST === 'modern') {
      o += '<defs><radialGradient id="' + id + 'm"><stop offset="0" stop-color="var(--main)" stop-opacity=".95"/><stop offset="1" stop-color="var(--main)" stop-opacity="0"/></radialGradient><radialGradient id="' + id + 'c"><stop offset="0" stop-color="var(--accent)" stop-opacity=".95"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></radialGradient></defs>';
      o += '<circle fill="url(#' + id + 'm)" cx="' + n(60, 180) + '" cy="' + n(40, H * 0.5) + '" r="' + n(190, 250) + '"/><circle fill="url(#' + id + 'c)" cx="' + n(260, 380) + '" cy="' + n(H * 0.5, H) + '" r="' + n(170, 230) + '"/>';
      for (var g = 1; g < 8; g++) o += '<path class="a-gr" d="M' + (g * 50) + ' 0V' + H + '"/>';
      for (var g2 = 1; g2 < H / 50; g2++) o += '<path class="a-gr" d="M0 ' + (g2 * 50) + 'H' + W + '"/>';
      var gx = n(70, 130), gy = n(H * 0.3, H * 0.5);
      o += '<rect class="a-gl" x="' + gx + '" y="' + gy + '" width="200" height="110" rx="20"/><rect class="a-glb" x="' + (gx + 22) + '" y="' + (gy + 28) + '" width="96" height="12" rx="6"/><rect class="a-glb" x="' + (gx + 22) + '" y="' + (gy + 52) + '" width="150" height="8" rx="4" opacity=".6"/><circle class="a-a" cx="' + (gx + 168) + '" cy="' + (gy + 82) + '" r="10"/>';
    } else if (ST === 'rustic') {
      var sunx = n(90, 310), h1 = H * 0.56, h2 = H * 0.68, h3 = H * 0.8;
      o += '<circle class="a-a" cx="' + sunx + '" cy="' + n(H * 0.2, H * 0.32) + '" r="' + n(34, 46) + '"/>';
      o += '<path class="a-m" opacity=".3" d="M0 ' + h1 + 'C90 ' + (h1 - n(30, 70)) + ' 190 ' + (h1 + 20) + ' 400 ' + (h1 - n(20, 60)) + 'V' + H + 'H0z"/>';
      o += '<path class="a-m" opacity=".6" d="M0 ' + h2 + 'C120 ' + (h2 - n(10, 50)) + ' 250 ' + (h2 + 30) + ' 400 ' + (h2 - n(10, 40)) + 'V' + H + 'H0z"/>';
      o += '<path class="a-m" d="M0 ' + h3 + 'C140 ' + (h3 - n(10, 40)) + ' 260 ' + (h3 + 20) + ' 400 ' + (h3 - 16) + 'V' + H + 'H0z"/>';
      for (var f = 0; f < 6; f++) o += '<path class="a-fw" d="M' + (20 + f * 70) + ' ' + H + 'q20 -' + (H * 0.1) + ' 50 -' + (H * 0.16) + '"/>';
      o += '<path class="a-bd" d="M' + n(60, 300) + ' ' + n(40, 80) + 'q7 -8 14 0q7 -8 14 0M' + n(180, 330) + ' ' + n(80, 110) + 'q6 -7 12 0q6 -7 12 0"/>';
    } else {
      var rx = n(46, 110), ry = n(30, 60), rw = n(140, 190), rh = H * 0.58;
      o += '<rect class="a-a" x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '"/>';
      o += '<circle class="a-m a-mul" cx="' + n(230, 300) + '" cy="' + (H * n(55, 68) / 100) + '" r="' + n(74, 100) + '"/>';
      o += '<rect class="a-ln" x="16" y="16" width="' + (W - 32) + '" height="' + (H - 32) + '"/><path class="a-ln" d="M' + (rx + rw + 20) + ' ' + (ry + 10) + 'h' + n(50, 90) + '"/>';
    }
    return '<svg class="art" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><rect class="a-bg" width="' + W + '" height="' + H + '"/>' + o + '</svg>';
  }
  function pic(src, alt, seed, tall) {
    return src ? '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '" loading="lazy" decoding="async">' : art(seed, tall);
  }
  function seal() {
    var id = 's' + (++artN), t = esc((d.business_name + ' • ' + (C.area || d.trust_line || 'Welcome') + ' • ').toUpperCase());
    return '<svg class="seal" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><defs><path id="' + id + '" d="M60 60m-45 0a45 45 0 1 1 90 0a45 45 0 1 1 -90 0"/></defs><circle class="seal-bg" cx="60" cy="60" r="58"/><circle class="seal-ring" cx="60" cy="60" r="33"/><text class="seal-t"><textPath href="#' + id + '" textLength="278" lengthAdjust="spacingAndGlyphs">' + t + '</textPath></text><text class="seal-c" x="60" y="61" text-anchor="middle" dominant-baseline="central">' + INIT + '</text></svg>';
  }

  /* ---------- page furniture ---------- */
  function navItems() { return NAV[LV].filter(function (p) { return has(p[0]); }); }
  function header() {
    var brand = '<a class="brand" href="' + href('index.html') + '">' + (d.logo ? '<img src="' + esc(d.logo) + '" alt="">' : '<span class="brand-mark" aria-hidden="true">' + INIT + '</span>') + '<span class="brand-name">' + esc(d.business_name) + '</span></a>';
    if (LV === 'starter') {
      return '<header class="top"><div class="wrap top-in">' + brand + '<nav class="nav" aria-label="On this page"><a href="#services">Services</a><a href="#about">About</a><a href="#contact">Contact</a></nav>' + (C.phone ? '<a class="top-tel" href="tel:' + tel(C.phone) + '">' + esc(C.phone) + '</a>' : '') + '</div></header>';
    }
    var links = navItems().map(function (p) { return '<a href="' + href(p[2]) + '"' + (p[0] === PAGE || (PAGE === 'project' && p[0] === 'portfolio') ? ' aria-current="page"' : '') + '>' + p[1] + '</a>'; }).join('');
    return '<header class="top"><div class="wrap top-in">' + brand +
      '<nav class="nav" id="nav" aria-label="Main">' + links + '</nav>' +
      '<a class="btn small top-cta" href="' + href('contact.html') + '">' + esc(d.cta_label || 'Get in touch') + '</a>' +
      (LV === 'pro' ? '<button class="theme" type="button" aria-label="Switch between light and dark"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" fill="currentColor"/></svg></button>' : '') +
      '<button class="burger" type="button" aria-expanded="false" aria-controls="nav" aria-label="Menu"><span></span><span></span></button>' +
      '</div></header>';
  }
  function footer() {
    var links = LV === 'starter' ? '' : '<nav class="foot-nav" aria-label="Footer">' + navItems().map(function (p) { return '<a href="' + href(p[2]) + '">' + p[1] + '</a>'; }).join('') + '</nav>';
    var soc = arr(d.socials).map(function (s) { return '<a href="' + esc(s.url) + '" rel="noopener" target="_blank">' + esc(s.label) + '</a>'; }).join('');
    var news = LV === 'pro' ? '<form class="newsletter" novalidate><label for="nl-email">Occasional news by email</label><div class="nl-row"><input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true"><input id="nl-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required><button class="btn small" type="submit">Sign up</button></div><p class="nl-done" role="status" hidden></p></form>' : '';
    return '<footer class="foot"><div class="wrap foot-in"><div class="foot-brand"><p class="foot-name">' + esc(d.business_name) + '</p>' + (d.trust_line ? '<p>' + esc(d.trust_line) + '</p>' : '') + '</div>' + links +
      '<address class="foot-contact">' + (C.phone ? '<a href="tel:' + tel(C.phone) + '">' + esc(C.phone) + '</a>' : '') + (C.email ? '<a href="mailto:' + esc(C.email) + '">' + esc(C.email) + '</a>' : '') + (C.address ? '<span>' + esc(C.address) + '</span>' : '') + '</address>' + news + '</div>' +
      '<div class="wrap foot-base"><span>© ' + new Date().getFullYear() + ' ' + esc(d.business_name) + '</span>' + (soc ? '<span class="foot-soc">' + soc + '</span>' : '') + '<a class="foot-by" href="https://axencraft.co.uk" rel="noopener">Website by Axencraft</a></div></footer>' +
      (LV === 'pro' ? '<div class="dock">' + (C.phone ? '<a class="btn alt" href="tel:' + tel(C.phone) + '">Call</a>' : '') + '<a class="btn" href="' + href('contact.html') + '">' + esc(d.cta_label || 'Get in touch') + '</a></div>' : '');
  }
  function head(title, sub, link) {
    return '<div class="sec-head"><div><h2>' + esc(title) + '</h2>' + (sub ? '<p class="lede">' + esc(sub) + '</p>' : '') + '</div>' + (link ? '<a class="more" href="' + href(link[1]) + '">' + link[0] + '</a>' : '') + '</div>';
  }
  function pagehead(title, sub) {
    return '<section class="pagehead"><div class="wrap"><h1>' + esc(title) + '</h1>' + (sub ? '<p class="lede">' + esc(sub) + '</p>' : '') + '</div></section>';
  }

  /* ---------- sections ---------- */
  function rating() {
    var t = arr(d.testimonials); if (!t.length) return null;
    var sum = t.reduce(function (a, x) { return a + (+x.rating || 5); }, 0);
    return { avg: (sum / t.length).toFixed(1).replace(/\.0$/, ''), n: t.length };
  }
  function hero() {
    var st = LV === 'starter', pro = LV === 'pro', work = pro && has('portfolio');
    var cta = '<a class="btn" href="' + (st ? '#contact' : href('contact.html')) + '">' + esc(d.cta_label || 'Get in touch') + '</a>';
    var second = st ? (C.phone ? '<a class="btn alt" href="tel:' + tel(C.phone) + '">Call ' + esc(C.phone) + '</a>' : '')
      : '<a class="btn alt" href="' + href(work ? 'portfolio.html' : 'services.html') + '">' + (work ? 'See our work' : 'What we do') + '</a>';
    var trust = arr(d.trust).length ? '<ul class="hero-trust">' + d.trust.slice(0, 4).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '';
    var h = hours(), facts = [];
    if (h.length) facts.push(['Open', h.map(function (r) { return esc(r[0] ? r[0] + ', ' + r[1] : r[1]); }).slice(0, 2).join('<br>')]);
    if (C.phone) facts.push(['Call', '<a href="tel:' + tel(C.phone) + '">' + esc(C.phone) + '</a>']);
    if (C.address || C.area) facts.push(['Find us', esc(C.address || C.area)]);
    var rt = pro && rating();
    var artHtml = st ? '' : '<div class="hero-art"><div class="ph">' + pic(d.hero_image, '', 1, true) + '</div>' + seal() +
      (rt ? '<a class="hero-badge" href="' + href('reviews.html') + '">' + stars(Math.round(rt.avg)) + '<b>' + rt.avg + ' out of 5</b><span>from ' + rt.n + ' review' + (rt.n > 1 ? 's' : '') + '</span></a>' : '') + '</div>';
    return '<section class="hero"><div class="wrap hero-in"><div class="hero-copy">' +
      (d.trust_line ? '<p class="hero-place">' + esc(d.trust_line) + '</p>' : '') +
      '<h1>' + esc(d.tagline || d.business_name) + '</h1>' +
      (d.intro ? '<p class="hero-intro">' + esc(d.intro) + '</p>' : '') +
      '<div class="hero-cta">' + cta + second + '</div>' + trust + '</div>' + artHtml +
      (facts.length ? '<dl class="hero-facts">' + facts.map(function (f) { return '<div><dt>' + f[0] + '</dt><dd>' + f[1] + '</dd></div>'; }).join('') + '</dl>' : '') +
      '</div></section>';
  }
  function marquee() {
    var items = arr(d.trust).length ? d.trust : arr(d.services).map(function (s) { return s.name; });
    if (!items.length) return '';
    return '<div class="marquee" aria-hidden="true"><div class="marquee-track">' + items.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div></div>';
  }
  function secStats() {
    var s = arr(d.highlights).filter(function (x) { return x && x.value; }); if (!s.length) return '';
    return '<section class="sec stats-sec"><div class="wrap"><ul class="stats">' + s.map(function (x) { return '<li><b data-count="' + esc(x.value) + '">' + esc(x.value) + '</b><span>' + esc(x.label) + '</span></li>'; }).join('') + '</ul></div></section>';
  }
  function secServices(limit, full) {
    var s = arr(d.services); if (!s.length) return '';
    var list = limit ? s.slice(0, limit) : s;
    return '<section class="sec services" id="services"><div class="wrap">' + (full ? '' : head('What we do', '', limit && s.length > limit ? ['All services', 'services.html'] : null)) +
      '<ul class="svc">' + list.map(function (x) {
        return '<li><div class="svc-t"><h3>' + esc(x.name) + '</h3>' + (x.price ? '<span class="price">' + esc(x.price) + '</span>' : '') + '</div>' + (x.description ? '<p>' + esc(x.description) + '</p>' : '') + '</li>';
      }).join('') + '</ul></div></section>';
  }
  function secAbout(full) {
    if (!d.about) return '';
    var st = LV === 'starter', text = String(d.about), first = text.split(/\n\s*\n/)[0];
    var img = d.about_image || (st ? null : d.hero_image && full ? d.hero_image : null);
    var showArt = !st;
    return '<section class="sec about" id="about"><div class="wrap about-in' + (img || showArt ? '' : ' no-pic') + '">' +
      (img || showArt ? '<div class="about-pic"><div class="ph">' + pic(img, '', 2, false) + '</div></div>' : '') +
      '<div class="about-copy">' + (full && LV !== 'starter' ? '' : '<h2>' + esc(d.about_title || 'About us') + '</h2>') +
      '<div class="prose">' + paras(st || full ? text : first) + '</div>' +
      (!st && !full ? '<a class="more" href="' + href('about.html') + '">More about us</a>' : '') + '</div></div></section>';
  }
  function secValues() {
    var v = arr(d.values); if (!v.length) return '';
    return '<section class="sec values"><div class="wrap">' + head('What matters to us') + '<ul class="vals">' + v.map(function (x) { return '<li><h3>' + esc(x.title) + '</h3><p>' + esc(x.text) + '</p></li>'; }).join('') + '</ul></div></section>';
  }
  function secProcess() {
    var p = arr(d.process); if (!p.length) return '';
    return '<section class="sec process"><div class="wrap">' + head(d.process_title || 'How it works') + '<ol class="steps">' + p.map(function (x) { return '<li><h3>' + esc(x.title) + '</h3>' + (x.text ? '<p>' + esc(x.text) + '</p>' : '') + '</li>'; }).join('') + '</ol></div></section>';
  }
  function secTeam() {
    var t = arr(d.team); if (!t.length) return '';
    return '<section class="sec team-sec"><div class="wrap">' + head(t.length > 1 ? 'The team' : 'Who you will meet') + '<ul class="team">' + t.map(function (m) {
      return '<li>' + (m.photo ? '<img class="avatar" src="' + esc(m.photo) + '" alt="" loading="lazy">' : '<span class="avatar" aria-hidden="true">' + esc(String(m.name || '?').split(/\s+/).map(function (w) { return w.charAt(0); }).slice(0, 2).join('').toUpperCase()) + '</span>') +
        '<div><h3>' + esc(m.name) + '</h3>' + (m.role ? '<p class="role">' + esc(m.role) + '</p>' : '') + (m.bio ? '<p>' + esc(m.bio) + '</p>' : '') + '</div></li>';
    }).join('') + '</ul></div></section>';
  }
  function secReviews(limit, full) {
    var t = arr(d.testimonials); if (!t.length) return '';
    var rt = rating(), list = limit ? t.slice(0, limit) : t;
    return '<section class="sec reviews"><div class="wrap">' + (full ? '<p class="rev-sum">' + stars(Math.round(rt.avg)) + ' <b>' + rt.avg + ' out of 5</b> from ' + rt.n + ' review' + (rt.n > 1 ? 's' : '') + '</p>' : head('What customers say', '', LV === 'pro' && t.length > list.length ? ['All reviews', 'reviews.html'] : null)) +
      '<div class="revs">' + list.map(function (x) {
        return '<figure class="rev">' + stars(x.rating) + '<blockquote>' + esc(x.quote) + '</blockquote><figcaption><b>' + esc(x.name) + '</b>' + (x.detail ? '<span>' + esc(x.detail) + '</span>' : '') + '</figcaption></figure>';
      }).join('') + '</div></div></section>';
  }
  function secGallery(limit) {
    var g = photos(); if (!g.length) return limit ? '' : '<section class="sec"><div class="wrap"><p class="lede">Photos are coming soon.</p></div></section>';
    var list = limit ? g.slice(0, limit) : g;
    return '<section class="sec gallery"><div class="wrap">' + (limit ? head('A look around', '', g.length > limit && LV === 'standard' ? ['See the gallery', 'gallery.html'] : null) : '') +
      '<div class="gal">' + list.map(function (x, i) {
        return '<button type="button" class="gal-item" data-i="' + i + '" aria-label="Open photo' + (x.caption ? ': ' + esc(x.caption) : ' ' + (i + 1)) + '"><span class="ph">' + pic(x.src, x.caption, 10 + i, i % 3 === 0) + '</span>' + (x.caption ? '<span class="cap">' + esc(x.caption) + '</span>' : '') + '</button>';
      }).join('') + '</div></div></section>';
  }
  function projCard(p, i) {
    var img = p.after || arr(p.images)[0] || p.before;
    return '<a class="proj-card" href="' + href('project.html?p=' + i) + '" data-cat="' + esc(p.category || '') + '">' + (img || SAMPLE ? '<span class="ph">' + pic(img, p.title, 20 + i, false) + '</span>' : '') +
      '<span class="proj-meta">' + esc([p.category, p.location].filter(Boolean).join(', ')) + '</span><h3>' + esc(p.title) + '</h3>' + (p.summary ? '<p>' + esc(p.summary) + '</p>' : '') + '</a>';
  }
  function secProjects(limit, full) {
    var p = arr(d.projects); if (!p.length) return '';
    var cats = p.map(function (x) { return x.category; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; });
    var filter = full && cats.length > 1 ? '<div class="filter" role="group" aria-label="Filter by type"><button type="button" aria-pressed="true" data-cat="">All</button>' + cats.map(function (c) { return '<button type="button" aria-pressed="false" data-cat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' : '';
    return '<section class="sec projects"><div class="wrap">' + (full ? filter : head(d.projects_title || 'Recent work', '', p.length > limit ? ['See all our work', 'portfolio.html'] : null)) +
      '<div class="proj">' + (limit ? p.slice(0, limit) : p).map(projCard).join('') + '</div></div></section>';
  }
  function projectPage() {
    var all = arr(d.projects), i = Math.max(0, Math.min(all.length - 1, parseInt(Q.get('p'), 10) || 0)), p = all[i];
    if (!p) return pagehead('Our work') + secCta();
    var both = (p.before && p.after) || (SAMPLE && !p.before && !p.after), imgs = arr(p.images), nx = all[(i + 1) % all.length];
    var media = both
      ? '<div class="ba"><div class="ba-a">' + pic(p.after, 'After', 30 + i, false) + '</div><div class="ba-b">' + pic(p.before, 'Before', 40 + i, false) + '</div><span class="ba-l ba-lb">Before</span><span class="ba-l ba-la">After</span><input type="range" min="0" max="100" value="50" aria-label="Slide to compare before and after"></div>'
      : (p.after || p.before || imgs[0] ? '<div class="ph proj-hero">' + pic(p.after || p.before || imgs[0], p.title, 30 + i, false) + '</div>' : '');
    return '<section class="pagehead"><div class="wrap"><a class="back" href="' + href('portfolio.html') + '">All work</a><h1>' + esc(p.title) + '</h1><p class="lede">' + esc([p.category, p.location].filter(Boolean).join(', ')) + '</p></div></section>' +
      '<section class="sec project"><div class="wrap">' + media + '<div class="prose project-copy">' + (p.summary ? '<p class="lede">' + esc(p.summary) + '</p>' : '') + paras(p.details) + '</div>' +
      (imgs.length > 1 ? '<div class="gal">' + imgs.map(function (s, k) { return '<button type="button" class="gal-item" data-i="' + k + '" aria-label="Open photo ' + (k + 1) + '"><span class="ph">' + pic(s, p.title, 50 + k, false) + '</span></button>'; }).join('') + '</div>' : '') +
      (all.length > 1 ? '<a class="next-proj" href="' + href('project.html?p=' + ((i + 1) % all.length)) + '"><span>Next</span><b>' + esc(nx.title) + '</b></a>' : '') + '</div></section>' + secCta();
  }
  function secFaq(limit) {
    var f = arr(d.faq); if (!f.length) return '';
    return '<section class="sec faq"><div class="wrap">' + (limit ? head('Questions people ask', '', f.length > limit ? ['All questions', 'faq.html'] : null) : '') +
      '<div class="qs">' + (limit ? f.slice(0, limit) : f).map(function (x) { return '<details class="q"><summary>' + esc(x.q) + '</summary><div class="prose">' + paras(x.a) + '</div></details>'; }).join('') + '</div></div></section>';
  }
  function secCta() {
    return '<section class="cta-band"><div class="wrap cta-in"><div><h2>' + esc(d.cta_title || 'Ready when you are') + '</h2>' + (C.phone ? '<p>Call <a href="tel:' + tel(C.phone) + '">' + esc(C.phone) + '</a>' + (C.email ? ' or email <a href="mailto:' + esc(C.email) + '">' + esc(C.email) + '</a>' : '') + '.</p>' : '') + '</div><a class="btn" href="' + href('contact.html') + '">' + esc(d.cta_label || 'Get in touch') + '</a></div></section>';
  }
  var HP = '<p class="hp" aria-hidden="true"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label></p>';
  function formEnquiry() {
    var svc = arr(d.services);
    return '<form class="form enquiry" id="enquiry" novalidate><h2>Send a message</h2>' +
      '<label>Your name<input name="name" autocomplete="name" required></label>' +
      '<label>Email<input name="email" type="email" autocomplete="email" required></label>' +
      '<label><span>Phone <small>(optional)</small></span><input name="phone" type="tel" autocomplete="tel"></label>' +
      (LV !== 'starter' && svc.length ? '<label>What is it about?<select name="service"><option value="">Choose one</option>' + svc.map(function (s) { return '<option>' + esc(s.name) + '</option>'; }).join('') + '<option>Something else</option></select></label>' : '') +
      '<label>Your message<textarea name="message" rows="5" required></textarea></label>' + HP +
      '<button class="btn" type="submit">Send message</button><p class="form-msg" role="status" hidden></p></form>';
  }
  function formBooking() {
    var svc = arr(d.services);
    return '<form class="form booking" id="book" novalidate>' +
      '<div class="steps-bar" aria-hidden="true"><span class="on"></span><span></span><span></span></div><p class="step-label" aria-live="polite">Step 1 of 3</p>' +
      '<fieldset class="bstep" data-step="1"><legend>What can we help with?</legend><div class="choices">' + svc.map(function (s) { return '<label class="choice"><input type="radio" name="service" value="' + esc(s.name) + '"><span><b>' + esc(s.name) + '</b>' + (s.price ? '<small>' + esc(s.price) + '</small>' : '') + '</span></label>'; }).join('') +
      '<label class="choice"><input type="radio" name="service" value="Something else"><span><b>Something else</b><small>Tell us in step 3</small></span></label></div></fieldset>' +
      '<fieldset class="bstep" data-step="2" hidden><legend>When suits you?</legend><label>Preferred date<input type="date" name="date" required></label><div class="choices small">' + ['Morning', 'Afternoon', 'Any time'].map(function (t, i) { return '<label class="choice"><input type="radio" name="time" value="' + t + '"' + (i === 2 ? ' checked' : '') + '><span><b>' + t + '</b></span></label>'; }).join('') + '</div></fieldset>' +
      '<fieldset class="bstep" data-step="3" hidden><legend>Your details</legend><label>Your name<input name="name" autocomplete="name" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label><span>Phone <small>(optional)</small></span><input name="phone" type="tel" autocomplete="tel"></label><label><span>Anything we should know? <small>(optional)</small></span><textarea name="message" rows="3"></textarea></label>' + HP + '</fieldset>' +
      '<div class="bstep done" data-step="4" hidden><h2 tabindex="-1">Request sent</h2><p>Thank you. We will be in touch soon to confirm.</p></div>' +
      '<p class="form-msg err" role="alert" hidden></p><div class="booking-nav"><button type="button" class="btn alt" data-back hidden>Back</button><button type="button" class="btn" data-next>Continue</button></div></form>';
  }
  function secContact() {
    var h = hours(), where = C.address || C.area;
    var info = '<div class="contact-info">' + (LV === 'starter' ? '<h2>Get in touch</h2>' : '') + '<dl class="facts">' +
      (C.phone ? '<div><dt>Phone</dt><dd><a href="tel:' + tel(C.phone) + '">' + esc(C.phone) + '</a></dd></div>' : '') +
      (C.email ? '<div><dt>Email</dt><dd><a href="mailto:' + esc(C.email) + '">' + esc(C.email) + '</a></dd></div>' : '') +
      (where ? '<div><dt>' + (C.address ? 'Address' : 'Area') + '</dt><dd>' + esc(where) + '</dd></div>' : '') + '</dl>' +
      (h.length ? '<table class="hours"><caption>Opening hours</caption>' + h.map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>' : '') + '</div>';
    return '<section class="sec contact" id="contact"><div class="wrap contact-in">' + info + (LV === 'pro' && arr(d.services).length ? formBooking() : formEnquiry()) + '</div></section>';
  }

  /* ---------- which sections make up each page ---------- */
  function page() {
    if (LV === 'starter') return hero() + secServices() + secAbout() + secContact();
    if (LV === 'standard') {
      if (PAGE === 'about') return pagehead(d.about_title || 'About us') + secAbout(true) + secValues() + secTeam() + secCta();
      if (PAGE === 'services') return pagehead('What we do', d.intro) + secServices(0, true) + secCta();
      if (PAGE === 'gallery') return pagehead('Gallery') + secGallery() + secCta();
      if (PAGE === 'contact') return pagehead(d.cta_label || 'Get in touch') + secContact();
      return hero() + secStats() + secServices(3) + secAbout() + secReviews(3) + secGallery(4) + secCta();
    }
    if (PAGE === 'about') return pagehead(d.about_title || 'About us') + secAbout(true) + secStats() + secValues() + secTeam() + secGallery(4) + secCta();
    if (PAGE === 'services') return pagehead('What we do', d.intro) + secServices(0, true) + secProcess() + secCta();
    if (PAGE === 'portfolio') return pagehead(d.projects_title || 'Our work') + secProjects(0, true) + secCta();
    if (PAGE === 'project') return projectPage();
    if (PAGE === 'reviews') return pagehead('What customers say') + secReviews(0, true) + secCta();
    if (PAGE === 'faq') return pagehead('Questions and answers') + secFaq() + secCta();
    if (PAGE === 'contact') return pagehead(d.cta_label || 'Get in touch') + secContact();
    return hero() + marquee() + secStats() + secServices() + secProjects(3) + secProcess() + secReviews(3) + secFaq(3) + secCta();
  }

  /* ---------- behaviour ---------- */
  function sendForm(kind, form, fields) {
    if (!LIVE) return Promise.resolve({ preview: true });
    var hp = form.querySelector('[name=website]');
    return fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: kind, hp: hp ? hp.value : '', fields: fields }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) throw new Error(b.error || 'Sorry, your message couldn’t be sent. Please try again.'); return b; }); });
  }
  function fields(form) {
    var o = {}; [].forEach.call(form.elements, function (el) { if (!el.name || el.name === 'website' || ((el.type === 'radio' || el.type === 'checkbox') && !el.checked)) return; o[el.name] = el.value; }); return o;
  }
  function firstInvalid(scope) {
    return [].slice.call(scope.querySelectorAll('input[required],textarea[required],select[required]')).filter(function (i) { return !i.checkValidity(); })[0];
  }
  function label(el) { var l = el.closest('label'); return l ? l.firstChild.textContent.trim().toLowerCase() : 'this field'; }
  function wire() {
    var burger = document.querySelector('.burger');
    if (burger) burger.addEventListener('click', function () { var on = B.classList.toggle('nav-open'); burger.setAttribute('aria-expanded', String(on)); });

    var theme = document.querySelector('.theme'), key = 'axw-theme:' + LV + '-' + ST;
    if (theme) theme.addEventListener('click', function () {
      var dark = document.documentElement.dataset.theme !== 'dark';
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      try { localStorage.setItem(key, dark ? 'dark' : 'light'); } catch (_) { }
    });

    var enq = document.getElementById('enquiry');
    if (enq) enq.addEventListener('submit', function (e) {
      e.preventDefault();
      var out = enq.querySelector('.form-msg'), btn = enq.querySelector('button[type=submit]'), bad = firstInvalid(enq);
      out.hidden = false; out.classList.remove('err');
      if (bad) { out.classList.add('err'); out.textContent = bad.type === 'email' && bad.value ? 'Please check the email address.' : 'Please fill in ' + label(bad) + '.'; bad.focus(); return; }
      btn.disabled = true; out.textContent = 'Sending...';
      sendForm('enquiry', enq, fields(enq)).then(function (r) {
        out.textContent = r.preview ? PREVIEW_NOTE : 'Thanks. Your message has been sent and we’ll be in touch soon.'; if (!r.preview) enq.reset();
      }).catch(function (err) { out.classList.add('err'); out.textContent = err.message; }).then(function () { btn.disabled = false; });
    });

    var book = document.getElementById('book');
    if (book) {
      var stepN = 1, steps = book.querySelectorAll('.bstep'), bars = book.querySelectorAll('.steps-bar span'), back = book.querySelector('[data-back]'), next = book.querySelector('[data-next]'), err = book.querySelector('.form-msg');
      var dateIn = book.querySelector('input[type=date]'); if (dateIn) dateIn.min = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
      var go = function (n) {
        stepN = n; [].forEach.call(steps, function (s) { s.hidden = +s.dataset.step !== n; }); [].forEach.call(bars, function (b, i) { b.classList.toggle('on', i < n); });
        book.querySelector('.step-label').textContent = n <= 3 ? 'Step ' + n + ' of 3' : 'Done';
        back.hidden = n === 1 || n === 4; next.hidden = n === 4; next.textContent = n === 3 ? 'Send request' : 'Continue'; err.hidden = true;
        var f = book.querySelector('.bstep[data-step="' + n + '"] input:not([type=radio]), .bstep[data-step="' + n + '"] h2'); if (f && n > 1) f.focus({ preventScroll: true });
      };
      var problem = function (n) {
        if (n === 1 && !book.querySelector('input[name=service]:checked')) return 'Please choose what you need help with.';
        var bad = firstInvalid(book.querySelector('.bstep[data-step="' + n + '"]'));
        if (bad) { bad.focus(); return bad.type === 'email' && bad.value ? 'Please check the email address.' : 'Please fill in ' + label(bad) + '.'; }
        return '';
      };
      next.addEventListener('click', function () {
        var p = problem(stepN); if (p) { err.hidden = false; err.textContent = p; return; }
        if (stepN < 3) { go(stepN + 1); return; }
        next.disabled = true; next.textContent = 'Sending...';
        sendForm('booking', book, fields(book)).then(function (r) {
          if (r.preview) book.querySelector('.done p').textContent = PREVIEW_NOTE;
          go(4); if (!r.preview) book.reset();
        }).catch(function (e2) { err.hidden = false; err.textContent = e2.message; next.textContent = 'Send request'; }).then(function () { next.disabled = false; });
      });
      back.addEventListener('click', function () { go(stepN - 1); });
      book.addEventListener('submit', function (e) { e.preventDefault(); next.click(); });
    }

    var nl = document.querySelector('.newsletter');
    if (nl) nl.addEventListener('submit', function (e) {
      e.preventDefault(); var i = nl.querySelector('input[type=email]'), done = nl.querySelector('.nl-done');
      done.hidden = false;
      if (!i.checkValidity()) { done.textContent = 'Please enter your email address.'; i.focus(); return; }
      done.textContent = 'Signing you up...';
      sendForm('newsletter', nl, { email: i.value }).then(function (r) { done.textContent = r.preview ? PREVIEW_NOTE : 'Thanks, you’re signed up.'; if (!r.preview) nl.reset(); }).catch(function (e2) { done.textContent = e2.message; });
    });

    /* photo viewer */
    var items = [].slice.call(document.querySelectorAll('.gal-item'));
    if (items.length) {
      var lb = document.createElement('dialog'); lb.className = 'lb';
      lb.innerHTML = '<button type="button" class="lb-x" aria-label="Close">×</button><button type="button" class="lb-p" aria-label="Previous photo">‹</button><div class="lb-pic"></div><p class="lb-cap"></p><button type="button" class="lb-n" aria-label="Next photo">›</button>';
      B.appendChild(lb); var cur = 0;
      var show = function (i) { cur = (i + items.length) % items.length; lb.querySelector('.lb-pic').innerHTML = items[cur].querySelector('.ph').innerHTML; var c = items[cur].querySelector('.cap'); lb.querySelector('.lb-cap').textContent = c ? c.textContent : ''; };
      items.forEach(function (b, i) { b.addEventListener('click', function () { show(i); if (lb.showModal) lb.showModal(); }); });
      lb.querySelector('.lb-x').onclick = function () { lb.close(); };
      lb.querySelector('.lb-p').onclick = function () { show(cur - 1); };
      lb.querySelector('.lb-n').onclick = function () { show(cur + 1); };
      lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
      lb.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') show(cur - 1); if (e.key === 'ArrowRight') show(cur + 1); });
    }

    /* portfolio filter */
    [].forEach.call(document.querySelectorAll('.filter button'), function (b) {
      b.addEventListener('click', function () {
        [].forEach.call(document.querySelectorAll('.filter button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        [].forEach.call(document.querySelectorAll('.proj-card'), function (c) { c.hidden = !!b.dataset.cat && c.dataset.cat !== b.dataset.cat; });
      });
    });

    /* before and after slider */
    var ba = document.querySelector('.ba');
    if (ba) { var rng = ba.querySelector('input'), set = function () { ba.style.setProperty('--cut', rng.value + '%'); }; rng.addEventListener('input', set); set(); }

    if (LV === 'pro') {
      /* strip of short phrases: repeat until it fills any screen, then loop */
      var track = document.querySelector('.marquee-track');
      if (track && !REDUCED) {
        var base = track.innerHTML, guard = 0;
        while (track.scrollWidth < innerWidth * 1.2 && guard++ < 12) track.innerHTML += base;
        track.innerHTML += track.innerHTML; track.classList.add('run');
      }
      /* numbers count up once, when first seen */
      var nums = [].slice.call(document.querySelectorAll('[data-count]')).filter(function (el) { return /^\d[\d,]*$/.test(el.dataset.count); });
      if (nums.length && !REDUCED && 'IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (en) {
            if (!en.isIntersecting) return; io.unobserve(en.target);
            var el = en.target, end = parseInt(el.dataset.count.replace(/,/g, ''), 10), t0 = performance.now(), comma = /,/.test(el.dataset.count);
            (function tick(now) { var p = Math.min(1, (now - t0) / 900), v = Math.round(end * (1 - Math.pow(1 - p, 3))); el.textContent = comma ? v.toLocaleString('en-GB') : String(v); if (p < 1) requestAnimationFrame(tick); else el.textContent = el.dataset.count; })(t0);
          });
        }, { threshold: 0.6 });
        nums.forEach(function (el) { io.observe(el); });
      }
    }
    requestAnimationFrame(function () { B.classList.add('ready'); });
  }

  function render(data) {
    d = data || {}; C = d.contact || {}; SAMPLE = !!d._sample;
    INIT = esc(String(d.business_name || 'A').trim().charAt(0).toUpperCase());
    applyColours(d.colours);
    try { var t = localStorage.getItem('axw-theme:' + LV + '-' + ST); if (LV === 'pro' && t) document.documentElement.dataset.theme = t; } catch (_) { }
    var here = NAV[LV].filter(function (p) { return p[0] === PAGE; })[0];
    document.title = PAGE === 'home' || !here ? d.business_name + (d.trust_line ? ' | ' + d.trust_line : '') : here[1] + ' | ' + d.business_name;
    var meta = document.querySelector('meta[name=description]') || document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'description' }));
    meta.content = d.intro || d.tagline || d.business_name || '';
    if (TOKEN || !LIVE) document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex' }));
    app.innerHTML = header() + '<main id="main">' + page() + '</main>' + footer();
    wire();
    if (location.hash) { var target = document.getElementById(location.hash.slice(1)); if (target) target.scrollIntoView(); }
  }

  var src = TOKEN ? FN + '/site-data?token=' + encodeURIComponent(TOKEN) : (LIVE ? '/site.json' : 'site.json');
  fetch(src, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('not found'); return r.json(); }).then(render).catch(function () {
    app.innerHTML = '<p style="padding:48px 24px;font:18px/1.5 system-ui,sans-serif;max-width:560px;margin:10vh auto">' + (TOKEN ? 'This preview link isn’t working. Please open it again from your account.' : 'Sorry, this website could not load. Please try again shortly.') + '</p>';
  });
})();
