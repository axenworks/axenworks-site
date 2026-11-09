/*
  Axenworks PRO templates: shared page builder.
  Pages: home, about, services, portfolio, project (?p=n), reviews, faq, contact.
  Everything is built from site.json in the template's folder.
*/
(function () {
  // Theme (light/dark) is applied before anything renders, to avoid a flash.
  var root = document.documentElement;
  try { var saved = localStorage.getItem('axw-theme:' + location.pathname.replace(/[^/]*$/, '')); if (saved) root.dataset.theme = saved; } catch (e) {}
  if (!root.dataset.theme) root.dataset.theme = root.dataset.defaultTheme || 'light';
})();

(async function () {
  var body = document.body, root = document.documentElement;
  var page = body.dataset.page || 'home';
  var style = body.dataset.style || 'classic';
  var main = document.getElementById('page');
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = matchMedia('(pointer: fine)').matches;

  var d;
  try { d = await (await fetch('site.json', { cache: 'no-cache' })).json(); }
  catch (e) { main.innerHTML = '<p style="padding:48px 24px">Sorry, this page could not load. Please refresh.</p>'; return; }

  /* ---------- helpers ---------- */
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  };
  var paras = function (t) {
    return String(t || '').split(/\n\s*\n/).filter(function (p) { return p.trim(); })
      .map(function (p) { return '<p>' + esc(p.trim()) + '</p>'; }).join('');
  };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var safeUrl = function (u) { return /^(https?:|mailto:|tel:)/i.test(u || '') ? u : '#'; };
  var tel = function (p) { return 'tel:' + String(p || '').replace(/[^\d+]/g, ''); };
  var stars = function (n) {
    n = Math.max(0, Math.min(5, Math.round(n || 5)));
    return '<span class="stars" role="img" aria-label="' + n + ' out of 5 stars">' + '★★★★★'.slice(0, n) + '<span class="off">' + '★★★★★'.slice(0, 5 - n) + '</span></span>';
  };
  var c = d.contact || {};
  var name = d.business_name || 'Your business';
  var projects = d.projects || [];
  var reviewsList = d.testimonials || [];

  /* ---------- brand colours ---------- */
  var HEX = /^#[0-9a-f]{6}$/i, rs = root.style;
  function onColour(hex) {
    var n = parseInt(hex.slice(1), 16), ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2] > 0.45 ? '#16181d' : '#ffffff';
  }
  ['main', 'accent'].forEach(function (k) {
    var v = d.colours && d.colours[k];
    if (v && HEX.test(v)) rs.setProperty('--' + k, v);
    var cur = getComputedStyle(root).getPropertyValue('--' + k).trim();
    if (HEX.test(cur)) rs.setProperty('--on-' + k, onColour(cur));
  });

  /* ---------- pictures ---------- */
  var SHAPES = {
    classic: function (s) {
      return '<rect width="400" height="500" fill="var(--pic-bg)"/>' +
        '<path d="M' + (20 + s * 23 % 100) + ' 500 V' + (300 - s * 7 % 40) + ' a125 125 0 0 1 250 0 V500Z" fill="var(--main)" opacity=".28"/>' +
        '<path d="M' + (130 + s * 17 % 90) + ' 500 V' + (330 + s * 11 % 40) + ' a95 95 0 0 1 190 0 V500Z" fill="var(--main)" opacity=".55"/>' +
        '<circle cx="' + (300 - s * 29 % 170) + '" cy="' + (110 + s * 13 % 80) + '" r="' + (38 + s * 7 % 26) + '" fill="var(--accent)" opacity=".7"/>' +
        '<path d="M0 ' + (420 - s * 5 % 40) + ' Q200 ' + (360 - s * 9 % 30) + ' 400 ' + (430 - s * 3 % 20) + '" stroke="var(--accent)" stroke-width="2" fill="none" opacity=".8"/>';
    },
    bold: function (s) {
      return '<rect width="400" height="500" fill="var(--pic-bg)"/>' +
        '<circle cx="' + (220 + s * 37 % 120) + '" cy="' + (180 + s * 23 % 120) + '" r="' + (120 + s * 11 % 50) + '" fill="var(--main)"/>' +
        '<rect x="' + (20 + s * 31 % 120) + '" y="' + (260 - s * 17 % 90) + '" width="' + (140 + s * 13 % 50) + '" height="' + (140 + s * 13 % 50) + '" fill="var(--accent)"/>' +
        '<g stroke="var(--ink)" stroke-width="9" opacity=".85">' + [0, 1, 2, 3].map(function (k) {
          return '<line x1="' + (20 + k * 28 + s * 19 % 200) + '" y1="30" x2="' + (70 + k * 28 + s * 19 % 200) + '" y2="120"/>';
        }).join('') + '</g>';
    },
    minimal: function (s) {
      return '<rect width="400" height="500" fill="var(--pic-bg)"/>' +
        '<circle cx="' + (170 + s * 29 % 80) + '" cy="' + (210 + s * 17 % 60) + '" r="' + (90 + s * 13 % 50) + '" fill="none" stroke="var(--ink)" stroke-width="1.2"/>' +
        '<line x1="40" y1="' + (390 + s * 7 % 50) + '" x2="360" y2="' + (390 + s * 7 % 50) + '" stroke="var(--ink)" stroke-width="1.2"/>' +
        '<circle cx="' + (280 + s * 23 % 70) + '" cy="' + (130 + s * 19 % 60) + '" r="' + (14 + s * 5 % 14) + '" fill="var(--main)"/>';
    }
  };
  function pic(src, alt, seed) {
    if (src) return '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '" loading="lazy">';
    return '<svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + (SHAPES[style] || SHAPES.classic)(seed) + '</svg>';
  }

  /* ---------- header ---------- */
  var PAGES = [['index.html', 'Home', 'home'], ['about.html', 'About', 'about'], ['services.html', 'Services', 'services'],
               ['portfolio.html', 'Portfolio', 'portfolio'], ['reviews.html', 'Reviews', 'reviews'], ['faq.html', 'FAQ', 'faq'],
               ['contact.html', 'Contact', 'contact']];
  var current = page === 'project' ? 'portfolio' : page;
  var brandHtml = d.logo
    ? '<img src="' + esc(d.logo) + '" alt="' + esc(name) + '">'
    : '<span class="mark" aria-hidden="true">' + esc(name.trim().charAt(0)) + '</span><span class="name">' + esc(name) + '</span>';
  var themeBtn = '<button type="button" class="theme-toggle" aria-label="Switch light or dark mode"><span class="sun" aria-hidden="true">☀</span><span class="moon" aria-hidden="true">☾</span></button>';

  document.getElementById('site-header').innerHTML =
    '<div class="wrap bar">' +
      '<a class="brand" href="index.html">' + brandHtml + '</a>' +
      '<nav class="menu" id="menu" aria-label="Main">' + PAGES.map(function (p, i) {
        return '<a href="' + p[0] + '" style="--i:' + i + '"' + (p[2] === current ? ' class="active" aria-current="page"' : '') + '>' + p[1] + '</a>';
      }).join('') + '<a class="btn book" href="contact.html#book">Book a visit</a></nav>' +
      '<div class="bar-tools">' + themeBtn +
        '<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu"><span></span><span></span><span class="sr">Menu</span></button></div>' +
    '</div><div class="progress" aria-hidden="true"></div>';

  /* ---------- footer ---------- */
  document.getElementById('site-footer').innerHTML =
    '<div class="wrap foot">' +
      '<div class="foot-brand"><a class="brand" href="index.html">' + brandHtml + '</a><p>' + esc(d.intro) + '</p>' +
        '<form class="newsletter" novalidate><label for="nl-email">Tips and news, once a month</label><div class="nl-row">' +
        '<input id="nl-email" type="email" placeholder="Your email" autocomplete="email" required><button type="submit" class="btn small">Sign up</button></div>' +
        '<p class="nl-done" role="status" hidden>Thanks, you’re signed up.</p></form></div>' +
      '<div><h4>Explore</h4><ul>' + PAGES.map(function (p) { return '<li><a href="' + p[0] + '">' + p[1] + '</a></li>'; }).join('') + '</ul></div>' +
      '<div><h4>Contact</h4><ul>' +
        (c.phone ? '<li><a href="' + tel(c.phone) + '">' + esc(c.phone) + '</a></li>' : '') +
        (c.email ? '<li><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></li>' : '') +
        (c.area ? '<li>' + esc(c.area) + '</li>' : '') + '</ul>' +
        ((d.socials || []).length ? '<h4 style="margin-top:28px">Follow</h4><ul>' + d.socials.map(function (s) {
          return '<li><a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a></li>';
        }).join('') + '</ul>' : '') + '</div>' +
    '</div>' +
    '<div class="wrap legal"><span>© ' + new Date().getFullYear() + ' ' + esc(name) + '</span><a href="#" class="to-top">Back to top ↑</a></div>';

  /* ---------- reusable sections ---------- */
  function head(eyebrow, title, link, center) {
    return '<div class="section-head' + (center ? ' center' : '') + ' reveal"><div><p class="eyebrow">' + esc(eyebrow) + '</p><h2>' + esc(title) + '</h2></div>' +
      (link ? '<a class="link" href="' + link[0] + '">' + esc(link[1]) + ' <span aria-hidden="true">→</span></a>' : '') + '</div>';
  }
  function pageHero(eyebrow, title, text) {
    return '<section class="page-hero"><div class="wrap"><p class="eyebrow reveal">' + esc(eyebrow) + '</p><h1 class="split-words">' + esc(title) + '</h1>' +
      (text ? '<p class="lead reveal">' + esc(text) + '</p>' : '') + '</div><div class="page-hero-shape" data-parallax="0.15" aria-hidden="true"></div></section>';
  }
  function projectCard(p, i, big) {
    return '<a class="project reveal' + (big ? ' big' : '') + '" href="project.html?p=' + i + '" data-cat="' + esc(p.category || '') + '">' +
      '<span class="pic">' + pic(p.after || (p.images || [])[0], p.title, i + 7) + '</span>' +
      '<span class="meta"><span class="cat">' + esc(p.category || '') + '</span><span class="title">' + esc(p.title) + '</span>' +
      '<span class="loc">' + esc(p.location || '') + '</span></span><span class="go" aria-hidden="true">↗</span></a>';
  }
  function reviewCarousel() {
    if (!reviewsList.length) return '';
    var t = reviewsList.slice(0, 4);
    return '<section class="block reviews-strip"><div class="wrap">' + head('Kind words', 'What our customers say', ['reviews.html', 'All reviews'], false) +
      '<div class="carousel reveal" aria-roledescription="carousel" aria-label="Customer reviews"><div class="slides" aria-live="polite">' +
      t.map(function (r, i) {
        return '<figure class="slide' + (i ? '' : ' current') + '" aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + t.length + '"' + (i ? ' hidden' : '') + '>' +
          stars(r.rating) + '<blockquote>' + esc(r.quote) + '</blockquote><figcaption><b>' + esc(r.name) + '</b>' + (r.detail ? '<span>' + esc(r.detail) + '</span>' : '') + '</figcaption></figure>';
      }).join('') + '</div>' +
      (t.length > 1 ? '<div class="carousel-nav"><button type="button" class="prev" aria-label="Previous review">←</button><div class="dots">' +
        t.map(function (_, i) { return '<button type="button" aria-label="Show review ' + (i + 1) + '"' + (i ? '' : ' aria-current="true"') + '></button>'; }).join('') +
        '</div><button type="button" class="next" aria-label="Next review">→</button></div>' : '') +
      '</div></div></section>';
  }
  function faqList(list) {
    return '<div class="faq-list">' + list.map(function (f) {
      return '<details class="faq reveal"><summary><span>' + esc(f.q) + '</span><i aria-hidden="true"></i></summary><div class="answer"><p>' + esc(f.a) + '</p></div></details>';
    }).join('') + '</div>';
  }
  function closing() {
    return '<section class="closing"><div class="wrap"><p class="eyebrow reveal">Next step</p><h2 class="split-words">Ready when you are.</h2>' +
      '<p class="reveal">Book a free visit and we’ll give you a clear, fixed quote within two days.</p>' +
      '<div class="actions reveal"><a class="btn magnetic" href="contact.html#book">Book a free visit</a>' +
      (c.phone ? '<a class="btn line" href="' + tel(c.phone) + '">Call ' + esc(c.phone) + '</a>' : '') + '</div></div>' +
      '<div class="closing-shape" data-parallax="-0.12" aria-hidden="true"></div></section>';
  }

  /* ---------- pages ---------- */
  var words = (d.tagline || name).trim().split(/\s+/);
  var VIEWS = {
    home: function () {
      var services = d.services || [];
      return '<section class="hero">' +
          '<div class="hero-bg" aria-hidden="true"><span class="orb o1" data-parallax="0.25"></span><span class="orb o2" data-parallax="-0.18"></span><span class="orb o3" data-parallax="0.1"></span></div>' +
          '<div class="wrap hero-grid">' +
            '<div class="hero-text"><p class="eyebrow reveal">' + esc(c.area || '') + '</p>' +
              '<h1 class="hero-title">' + words.map(function (w, i) {
                return '<span class="w"><span style="--d:' + (i * 90) + 'ms"' + (i === words.length - 1 ? ' class="hl"' : '') + '>' + esc(w) + '</span></span>';
              }).join(' ') + '</h1>' +
              '<p class="intro reveal">' + esc(d.intro) + '</p>' +
              '<div class="actions reveal"><a class="btn magnetic" href="contact.html#book">' + esc(d.cta_label || 'Get in touch') + '</a><a class="btn line" href="portfolio.html">See our work</a></div>' +
            '</div>' +
            '<div class="hero-media reveal"><div class="pic" data-parallax="-0.06">' + pic(d.hero_image, name, 1) + '</div>' +
              (reviewsList.length ? '<div class="hero-badge">' + stars(5) + '<b>' + esc((d.highlights || []).filter(function (h) { return /★/.test(h.value); }).map(function (h) { return h.value.replace('★', ''); })[0] || '5.0') + '</b><span>from ' + reviewsList.length + '+ reviews</span></div>' : '') +
            '</div>' +
          '</div>' +
          '<a class="scroll-cue" href="#more" aria-label="Scroll down"><span></span></a>' +
        '</section>' +
        ((d.trust || []).length ? '<div class="marquee" id="more" aria-label="' + esc(d.trust.join(', ')) + '"><div class="track" aria-hidden="true">' +
          [0].map(function () { return d.trust.map(function (t) { return '<span>' + esc(t) + '</span><i>✦</i>'; }).join(''); }).join('') + '</div></div>' : '') +
        ((d.highlights || []).length ? '<section class="stats-band"><div class="wrap stats">' + d.highlights.map(function (h) {
          return '<div class="stat reveal"><b data-count="' + esc(h.value) + '">' + esc(h.value) + '</b><span>' + esc(h.label) + '</span></div>';
        }).join('') + '</div></section>' : '') +
        '<section class="block"><div class="wrap">' + head('What we do', 'Services, done properly', ['services.html', 'All services']) +
          '<div class="bento">' + services.slice(0, 6).map(function (s, i, all) {
            // First tile is large; the last tile stretches so the grid has no gaps.
            var n = all.length, wide = n >= 3 && i === 0, rest = n - 3, span = '';
            if (n >= 3 && i === n - 1 && rest > 0 && rest % 3) span = ' span' + (rest % 3 === 1 ? 3 : 2);
            if (n < 3 && i === n - 1 && n % 3) span = ' span' + (n === 1 ? 3 : 2);
            return '<a class="tile-svc reveal' + (wide ? ' wide' : '') + span + '" href="services.html#s' + i + '"><span class="num">' + pad(i + 1) + '</span><h3>' + esc(s.name) + '</h3><p>' + esc(s.description) + '</p>' +
              (s.price ? '<span class="price">' + esc(s.price) + '</span>' : '') + '<span class="arrow" aria-hidden="true">→</span></a>';
          }).join('') + '</div></div></section>' +
        (projects.length ? '<section class="block work"><div class="wrap">' + head('Selected work', 'Recent projects', ['portfolio.html', 'Full portfolio']) +
          '<div class="projects featured">' + projects.slice(0, 3).map(function (p, i) { return projectCard(p, i, i === 0); }).join('') + '</div></div></section>' : '') +
        ((d.process || []).length ? '<section class="block process"><div class="wrap">' + head('How it works', 'Simple from start to finish', null, true) +
          '<ol class="steps">' + d.process.map(function (p, i) {
            return '<li class="reveal"><span class="num">' + pad(i + 1) + '</span><h3>' + esc(p.title) + '</h3><p>' + esc(p.text) + '</p></li>';
          }).join('') + '</ol></div></section>' : '') +
        reviewCarousel() +
        ((d.faq || []).length ? '<section class="block"><div class="wrap narrow">' + head('Questions', 'Things people often ask', ['faq.html', 'All questions']) + faqList(d.faq.slice(0, 3)) + '</div></section>' : '') +
        closing();
    },
    about: function () {
      return pageHero('About us', d.about_title || 'About ' + name, d.intro) +
        '<section class="block story"><div class="wrap split"><div class="text reveal">' + paras(d.about) + '</div>' +
          '<div class="pic reveal" data-parallax="-0.05">' + pic(d.about_image, 'About ' + name, 2) + '</div></div></section>' +
        ((d.timeline || []).length ? '<section class="block timeline-wrap"><div class="wrap">' + head('Our story', 'How we got here') +
          '<ol class="timeline">' + d.timeline.map(function (t) {
            return '<li class="reveal"><span class="year">' + esc(t.year) + '</span><p>' + esc(t.text) + '</p></li>';
          }).join('') + '</ol></div></section>' : '') +
        ((d.team || []).length ? '<section class="block team-wrap"><div class="wrap">' + head('The team', 'The people you’ll meet') +
          '<div class="team">' + d.team.map(function (m, i) {
            return '<article class="member reveal"><div class="pic">' + pic(m.photo, m.name, i + 11) + '</div><h3>' + esc(m.name) + '</h3><p class="role">' + esc(m.role) + '</p><p>' + esc(m.bio) + '</p></article>';
          }).join('') + '</div></div></section>' : '') +
        ((d.values || []).length ? '<section class="block"><div class="wrap">' + head('Our promise', 'What you can expect') +
          '<div class="values">' + d.values.map(function (v, i) {
            return '<div class="value reveal"><span class="num">' + pad(i + 1) + '</span><h3>' + esc(v.title) + '</h3><p>' + esc(v.text) + '</p></div>';
          }).join('') + '</div></div></section>' : '') +
        closing();
    },
    services: function () {
      return pageHero('Services', 'Everything we do', 'Clear prices, careful work, and a free visit before any job starts.') +
        '<nav class="svc-index" aria-label="Services on this page"><div class="wrap">' + (d.services || []).map(function (s, i) {
          return '<a href="#s' + i + '">' + esc(s.name) + '</a>';
        }).join('') + '</div></nav>' +
        '<section class="block svc-details"><div class="wrap">' + (d.services || []).map(function (s, i) {
          return '<article class="svc' + (i % 2 ? ' rev' : '') + '" id="s' + i + '"><div class="pic reveal">' + pic(s.image, s.name, i + 20) + '</div>' +
            '<div class="text reveal"><span class="num">' + pad(i + 1) + '</span><h2>' + esc(s.name) + '</h2><p>' + esc(s.description) + '</p>' +
            (s.price ? '<p class="price">' + esc(s.price) + '</p>' : '') + '<a class="btn line small" href="contact.html#book">Enquire about ' + esc(s.name.toLowerCase()) + '</a></div></article>';
        }).join('') + '</div></section>' +
        ((d.packages || []).length ? '<section class="block packages-wrap"><div class="wrap">' + head('Regular care', 'Packages', null, true) +
          '<div class="packages">' + d.packages.map(function (p) {
            return '<div class="package reveal' + (p.featured ? ' featured' : '') + '">' + (p.featured ? '<span class="badge">Most popular</span>' : '') +
              '<h3>' + esc(p.name) + '</h3><p class="amount">' + esc(p.price) + ' <span>' + esc(p.period || '') + '</span></p>' +
              '<ul>' + (p.features || []).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
              '<a class="btn' + (p.featured ? '' : ' line') + '" href="contact.html#book">Choose ' + esc(p.name) + '</a></div>';
          }).join('') + '</div></div></section>' : '') +
        closing();
    },
    portfolio: function () {
      var cats = projects.map(function (p) { return p.category; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
      return pageHero('Portfolio', 'Our work', 'A selection of recent projects. Open any project to see the before and after.') +
        '<section class="block"><div class="wrap">' +
          (cats.length > 1 ? '<div class="filters" role="group" aria-label="Filter projects"><button type="button" aria-pressed="true" data-f="">All</button>' +
            cats.map(function (k) { return '<button type="button" aria-pressed="false" data-f="' + esc(k) + '">' + esc(k) + '</button>'; }).join('') + '</div>' : '') +
          '<div class="projects grid">' + projects.map(function (p, i) { return projectCard(p, i, false); }).join('') + '</div>' +
        '</div></section>' + closing();
    },
    project: function () {
      var n = parseInt(new URLSearchParams(location.search).get('p'), 10);
      var p = projects[n] || projects[0]; n = projects.indexOf(p);
      if (!p) return pageHero('Portfolio', 'Project not found', '') + closing();
      var next = projects[(n + 1) % projects.length];
      return '<section class="page-hero project-hero"><div class="wrap"><a class="back" href="portfolio.html">← All projects</a>' +
          '<p class="eyebrow reveal">' + esc(p.category || 'Project') + ' · ' + esc(p.location || '') + '</p><h1 class="split-words">' + esc(p.title) + '</h1>' +
          '<p class="lead reveal">' + esc(p.summary) + '</p></div></section>' +
        '<section class="block"><div class="wrap">' +
          '<div class="compare reveal" style="--pos:50%"><div class="layer before">' + pic(p.before, p.title + ' before', n + 31) + '<span class="tag">Before</span></div>' +
            '<div class="layer after">' + pic(p.after, p.title + ' after', n + 7) + '<span class="tag">After</span></div>' +
            '<span class="handle" aria-hidden="true"><i>⟷</i></span>' +
            '<input type="range" min="0" max="100" value="50" aria-label="Compare before and after"></div>' +
          '<div class="project-body"><div class="reveal"><h2>About this project</h2>' + paras(p.details) + '</div>' +
            '<dl class="facts reveal"><dt>Location</dt><dd>' + esc(p.location || '') + '</dd><dt>Type</dt><dd>' + esc(p.category || '') + '</dd></dl></div>' +
          ((p.images || []).length ? '<div class="project-pics">' + p.images.map(function (src, k) {
            return '<div class="pic reveal">' + pic(src, p.title, n * 3 + k + 40) + '</div>';
          }).join('') + '</div>' : '') +
          (next && next !== p ? '<a class="next-project reveal" href="project.html?p=' + projects.indexOf(next) + '"><span>Next project</span><b>' + esc(next.title) + ' →</b></a>' : '') +
        '</div></section>' + closing();
    },
    reviews: function () {
      var avg = reviewsList.reduce(function (s, r) { return s + (r.rating || 5); }, 0) / (reviewsList.length || 1);
      return pageHero('Reviews', 'What customers say', 'Real words from people whose gardens we look after.') +
        '<section class="block"><div class="wrap">' +
          '<div class="rating-summary reveal"><b>' + avg.toFixed(1) + '</b>' + stars(avg) + '<span>Average from ' + reviewsList.length + ' reviews</span></div>' +
          '<div class="review-grid">' + reviewsList.map(function (r) {
            return '<figure class="review reveal">' + stars(r.rating) + '<blockquote>' + esc(r.quote) + '</blockquote><figcaption><b>' + esc(r.name) + '</b>' +
              (r.detail ? '<span>' + esc(r.detail) + '</span>' : '') + '</figcaption></figure>';
          }).join('') + '</div></div></section>' + closing();
    },
    faq: function () {
      return pageHero('FAQ', 'Questions, answered', 'Can’t find what you need? Give us a call or send a message.') +
        '<section class="block"><div class="wrap narrow">' + faqList(d.faq || []) +
          '<p class="faq-more reveal">Still have a question? <a href="contact.html">Get in touch</a>' + (c.phone ? ' or call <a href="' + tel(c.phone) + '">' + esc(c.phone) + '</a>' : '') + '.</p>' +
        '</div></section>' + closing();
    },
    contact: function () {
      var hours = Array.isArray(c.hours) ? c.hours : (c.hours ? [['Opening hours', c.hours]] : []);
      var svc = d.services || [];
      return pageHero('Contact', 'Book a free visit', 'Three quick steps and we’ll be in touch to confirm. Or call us any time we’re open.') +
        '<section class="block contact"><div class="wrap split">' +
          '<form class="booking reveal" id="book" novalidate>' +
            '<div class="steps-bar" aria-hidden="true"><span class="on"></span><span></span><span></span></div>' +
            '<p class="step-label" aria-live="polite">Step 1 of 3</p>' +
            '<fieldset class="bstep" data-step="1"><legend>What can we help with?</legend><div class="choices">' + svc.map(function (s, i) {
              return '<label class="choice"><input type="radio" name="service" value="' + esc(s.name) + '"' + (i ? '' : ' required') + '><span><b>' + esc(s.name) + '</b>' + (s.price ? '<small>' + esc(s.price) + '</small>' : '') + '</span></label>';
            }).join('') + '<label class="choice"><input type="radio" name="service" value="Something else"><span><b>Something else</b><small>Tell us in step 3</small></span></label></div></fieldset>' +
            '<fieldset class="bstep" data-step="2" hidden><legend>When suits you?</legend>' +
              '<label>Preferred date<input type="date" name="date" required></label>' +
              '<div class="q">Time of day<div class="choices small">' + ['Morning', 'Afternoon', 'Any time'].map(function (t, i) {
                return '<label class="choice"><input type="radio" name="time" value="' + t + '"' + (i === 2 ? ' checked' : '') + '><span><b>' + t + '</b></span></label>';
              }).join('') + '</div></div>' +
              '<label>Postcode<input name="postcode" autocomplete="postal-code" required></label></fieldset>' +
            '<fieldset class="bstep" data-step="3" hidden><legend>Your details</legend>' +
              '<label>Your name<input name="name" autocomplete="name" required></label>' +
              '<label>Email<input name="email" type="email" autocomplete="email" required></label>' +
              '<label>Phone<input name="phone" type="tel" autocomplete="tel"></label>' +
              '<label>Anything we should know?<textarea name="message"></textarea></label></fieldset>' +
            '<div class="bstep done" data-step="4" hidden><h3>Thank you!</h3><p>Your request has been sent. We’ll be in touch within one working day to confirm your visit.</p></div>' +
            '<p class="form-error" role="alert"></p>' +
            '<div class="booking-nav"><button type="button" class="btn line small" data-back hidden>Back</button><button type="button" class="btn magnetic" data-next>Continue</button></div>' +
          '</form>' +
          '<aside class="details reveal"><dl>' +
            (c.phone ? '<dt>Phone</dt><dd><a href="' + tel(c.phone) + '">' + esc(c.phone) + '</a></dd>' : '') +
            (c.email ? '<dt>Email</dt><dd><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></dd>' : '') +
            (c.address ? '<dt>Address</dt><dd>' + esc(c.address) + '</dd>' : '') +
            (c.area ? '<dt>Area covered</dt><dd>' + esc(c.area) + '</dd>' : '') + '</dl>' +
            (hours.length ? '<h3>Opening hours</h3><table class="hours">' + hours.map(function (h) {
              return '<tr><th scope="row">' + esc(h[0]) + '</th><td>' + esc(h[1]) + '</td></tr>';
            }).join('') + '</table>' : '') +
            '<div class="map-box" role="img" aria-label="Map of ' + esc(c.area || 'our area') + '"><span class="pin"></span><span>' + esc(c.address || c.area || '') + '</span></div>' +
          '</aside></div></section>';
    }
  };

  main.innerHTML = (VIEWS[page] || VIEWS.home)();
  var TITLES = { home: d.tagline, about: 'About', services: 'Services', portfolio: 'Portfolio', project: 'Project', reviews: 'Reviews', faq: 'FAQ', contact: 'Contact' };
  if (page === 'project') { var h1 = main.querySelector('h1'); if (h1) TITLES.project = h1.textContent; }
  document.title = page === 'home' ? name + (d.tagline ? ' | ' + d.tagline : '') : TITLES[page] + ' | ' + name;
  var md = document.querySelector('meta[name=description]'); if (md) md.content = d.intro || '';

  /* ---------- behaviour ---------- */
  // Split page titles into words for the rising-text animation.
  document.querySelectorAll('.split-words').forEach(function (h) {
    var ws = h.textContent.trim().split(/\s+/);
    h.innerHTML = ws.map(function (w, i) { return '<span class="w"><span style="--d:' + (i * 80) + 'ms">' + esc(w) + '</span></span>'; }).join(' ');
  });
  requestAnimationFrame(function () { body.classList.add('loaded'); });

  // Scrolling strip: repeat the items enough times to fill any screen width,
  // so the loop never shows a gap. With reduced motion it's a single centred row.
  var track = document.querySelector('.marquee .track');
  if (track && !REDUCED) {
    var one = track.innerHTML, setW = track.scrollWidth || 600;
    var sets = Math.max(2, Math.ceil((innerWidth * 1.2) / setW) + 1);
    track.innerHTML = new Array(sets * 2 + 1).join(one);
    track.style.animationDuration = Math.round((setW * sets) / 70) + 's';
    track.parentNode.classList.add('moving');
  }

  // Theme toggle
  document.querySelector('.theme-toggle').addEventListener('click', function () {
    var t = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = t;
    try { localStorage.setItem('axw-theme:' + location.pathname.replace(/[^/]*$/, ''), t); } catch (e) {}
  });

  // Mobile menu
  var toggle = document.querySelector('.menu-toggle'), menu = document.getElementById('menu');
  function setMenu(open) { toggle.setAttribute('aria-expanded', String(open)); body.classList.toggle('menu-open', open); }
  toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
  menu.addEventListener('click', function (e) { if (e.target.tagName === 'A') setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && body.classList.contains('menu-open')) { setMenu(false); toggle.focus(); } });

  // Header state + reading progress + parallax, in one scroll loop.
  var hdr = document.getElementById('site-header'), bar = hdr.querySelector('.progress');
  var para = REDUCED ? [] : [].slice.call(document.querySelectorAll('[data-parallax]'));
  var ticking = false;
  function onScroll() {
    var y = window.scrollY, max = document.documentElement.scrollHeight - innerHeight;
    hdr.classList.toggle('scrolled', y > 10);
    bar.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    para.forEach(function (el) {
      var r = el.getBoundingClientRect(); if (r.bottom < -200 || r.top > innerHeight + 200) return;
      el.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - innerHeight / 2) * -parseFloat(el.dataset.parallax)).toFixed(1) + 'px,0)';
    });
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // Reveal on scroll + count-up numbers
  function countUp(el) {
    var raw = el.dataset.count, m = raw.match(/^([^\d]*)([\d.]+)(.*)$/);
    if (!m || REDUCED) return;
    var target = parseFloat(m[2]), dec = (m[2].split('.')[1] || '').length, t0 = null;
    function step(ts) {
      t0 = t0 || ts; var k = Math.min(1, (ts - t0) / 1400), e = 1 - Math.pow(1 - k, 3);
      el.textContent = m[1] + (target * e).toFixed(dec) + m[3];
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window && !REDUCED) {
    body.classList.add('js-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in'); io.unobserve(en.target);
        en.target.querySelectorAll('[data-count]').forEach(countUp);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal,.split-words').forEach(function (el, i) {
      if (el.classList.contains('reveal')) el.style.transitionDelay = (i % 3) * 80 + 'ms';
      io.observe(el);
    });
  } else {
    document.querySelectorAll('.split-words').forEach(function (el) { el.classList.add('in'); });
  }

  // Magnetic buttons (desktop only)
  if (FINE && !REDUCED) document.querySelectorAll('.magnetic').forEach(function (b) {
    b.addEventListener('pointermove', function (e) {
      var r = b.getBoundingClientRect();
      b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1) + 'px)';
    });
    b.addEventListener('pointerleave', function () { b.style.transform = ''; });
  });

  // Smooth fade between pages
  if (!REDUCED) document.addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    var href = a.getAttribute('href') || '';
    if (!/\.html(\?|#|$)/.test(href) || href.indexOf('#') === 0) return;
    var dest = new URL(href, location.href);
    if (dest.pathname === location.pathname && dest.search === location.search) return;
    e.preventDefault(); body.classList.add('leaving');
    setTimeout(function () { location.href = dest.href; }, 260);
  });
  window.addEventListener('pageshow', function () { body.classList.remove('leaving'); });

  // Reviews carousel
  document.querySelectorAll('.carousel').forEach(function (car) {
    var slides = car.querySelectorAll('.slide'), dots = car.querySelectorAll('.dots button'), i = 0, timer;
    if (slides.length < 2) return;
    function show(n) {
      slides[i].hidden = true; slides[i].classList.remove('current'); dots[i].removeAttribute('aria-current');
      i = (n + slides.length) % slides.length;
      slides[i].hidden = false; slides[i].classList.add('current'); dots[i].setAttribute('aria-current', 'true');
    }
    function stop() { clearInterval(timer); }
    car.querySelector('.prev').onclick = function () { stop(); show(i - 1); };
    car.querySelector('.next').onclick = function () { stop(); show(i + 1); };
    dots.forEach(function (b, n) { b.onclick = function () { stop(); show(n); }; });
    if (!REDUCED) timer = setInterval(function () { show(i + 1); }, 7000);
    car.addEventListener('focusin', stop); car.addEventListener('mouseenter', stop);
  });

  // Portfolio filters
  document.querySelectorAll('.filters button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.filters button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      var f = b.dataset.f;
      document.querySelectorAll('.projects.grid .project').forEach(function (p) {
        var show = !f || p.dataset.cat === f;
        p.classList.toggle('filtered-out', !show);
        p.hidden = !show;
      });
    });
  });

  // Before / after slider
  document.querySelectorAll('.compare').forEach(function (cmp) {
    var input = cmp.querySelector('input');
    input.addEventListener('input', function () { cmp.style.setProperty('--pos', input.value + '%'); });
  });

  // FAQ: smooth open/close
  document.querySelectorAll('details.faq').forEach(function (det) {
    var sum = det.querySelector('summary'), ans = det.querySelector('.answer');
    sum.addEventListener('click', function (e) {
      if (REDUCED) return;
      e.preventDefault();
      if (det.open) {
        ans.style.height = ans.scrollHeight + 'px'; requestAnimationFrame(function () { ans.style.height = '0px'; });
        setTimeout(function () { det.open = false; ans.style.height = ''; }, 300);
      } else {
        det.open = true; ans.style.height = '0px';
        requestAnimationFrame(function () { ans.style.height = ans.scrollHeight + 'px'; });
        setTimeout(function () { ans.style.height = ''; }, 320);
      }
    });
  });

  // Booking form: three steps (preview: on live sites this will send to the business owner)
  var form = document.getElementById('book');
  if (form) {
    var stepN = 1, steps = form.querySelectorAll('.bstep'), bars = form.querySelectorAll('.steps-bar span');
    var back = form.querySelector('[data-back]'), next = form.querySelector('[data-next]'), err = form.querySelector('.form-error');
    var dateIn = form.querySelector('input[type=date]');
    if (dateIn) dateIn.min = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    function go(n) {
      stepN = n;
      steps.forEach(function (s) { s.hidden = +s.dataset.step !== n; });
      bars.forEach(function (b, i) { b.classList.toggle('on', i < n); });
      form.querySelector('.step-label').textContent = n <= 3 ? 'Step ' + n + ' of 3' : 'Request sent';
      back.hidden = n === 1 || n === 4; next.hidden = n === 4;
      next.textContent = n === 3 ? 'Send request' : 'Continue';
      err.textContent = '';
      var first = form.querySelector('.bstep[data-step="' + n + '"] input, .bstep[data-step="' + n + '"] h3');
      if (first && n > 1) first.focus({ preventScroll: true });
    }
    function valid(n) {
      var fs = form.querySelector('.bstep[data-step="' + n + '"]');
      if (n === 1 && !form.querySelector('input[name=service]:checked')) return 'Please choose what you need help with.';
      var bad = [].slice.call(fs.querySelectorAll('input[required],textarea[required]')).filter(function (i) { return i.type !== 'radio' && !i.checkValidity(); })[0];
      if (bad) { bad.focus(); return 'Please fill in ' + (bad.closest('label') ? bad.closest('label').firstChild.textContent.toLowerCase() : 'this field') + '.'; }
      return '';
    }
    next.addEventListener('click', function () { var p = valid(stepN); if (p) { err.textContent = p; return; } go(stepN + 1); });
    back.addEventListener('click', function () { go(stepN - 1); });
    form.addEventListener('submit', function (e) { e.preventDefault(); next.click(); });
    if (location.hash === '#book') setTimeout(function () { form.scrollIntoView({ block: 'start' }); }, 50);
  }

  // Newsletter (preview)
  var nl = document.querySelector('.newsletter');
  if (nl) nl.addEventListener('submit', function (e) {
    e.preventDefault(); var i = nl.querySelector('input');
    if (!i.checkValidity()) { i.focus(); return; }
    nl.reset(); nl.querySelector('.nl-done').hidden = false;
  });
})();
