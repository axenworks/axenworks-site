/*
  Axenworks STANDARD templates: shared page builder.
  Each page is an empty shell (<body data-page="home|about|services|gallery|contact"
  data-style="classic|bold|minimal">). Everything is built from site.json,
  so a customer's site is just their own site.json next to these files.
*/
(async function () {
  var body = document.body;
  var page = body.dataset.page || 'home';
  var style = body.dataset.style || 'classic';
  var main = document.getElementById('page');

  var d;
  try {
    var res = await fetch('site.json', { cache: 'no-cache' });
    d = await res.json();
  } catch (e) {
    main.innerHTML = '<p style="padding:48px 24px">Sorry, this page could not load. Please refresh.</p>';
    return;
  }

  /* ---------- helpers ---------- */
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var paras = function (t) {
    return String(t || '').split(/\n\s*\n/).filter(function (p) { return p.trim(); })
      .map(function (p) { return '<p>' + esc(p.trim()) + '</p>'; }).join('');
  };
  var safeUrl = function (u) { return /^(https?:|mailto:|tel:)/i.test(u || '') ? u : '#'; };
  var tel = function (p) { return 'tel:' + String(p || '').replace(/[^\d+]/g, ''); };
  var c = d.contact || {};
  var name = d.business_name || 'Your business';

  /* ---------- brand colours + readable text on them ---------- */
  var HEX = /^#[0-9a-f]{6}$/i, rs = document.documentElement.style;
  function onColour(hex) {
    var n = parseInt(hex.slice(1), 16), ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2] > 0.45 ? '#16181d' : '#ffffff';
  }
  ['main', 'accent'].forEach(function (k) {
    var v = d.colours && d.colours[k];
    if (v && HEX.test(v)) rs.setProperty('--' + k, v);
    var cur = getComputedStyle(document.documentElement).getPropertyValue('--' + k).trim();
    if (HEX.test(cur)) rs.setProperty('--on-' + k, onColour(cur));
  });

  /* ---------- pictures: customer photo, or shapes in their colours ---------- */
  var SHAPES = {
    classic: function (s) {
      return '<rect width="400" height="500" fill="var(--pic-bg,var(--paper-2))"/>' +
        '<path d="M' + (30 + s * 23 % 90) + ' 500 V300 a120 120 0 0 1 240 0 V500Z" fill="var(--main)" opacity=".22"/>' +
        '<path d="M' + (140 + s * 17 % 80) + ' 500 V' + (330 + s * 11 % 40) + ' a95 95 0 0 1 190 0 V500Z" fill="var(--main)" opacity=".4"/>' +
        '<circle cx="' + (300 - s * 29 % 160) + '" cy="' + (110 + s * 13 % 70) + '" r="' + (40 + s * 7 % 25) + '" fill="var(--accent)" opacity=".45"/>' +
        '<path d="M0 ' + (420 - s * 5 % 40) + ' Q200 ' + (370 - s * 9 % 30) + ' 400 ' + (430 - s * 3 % 20) + '" stroke="var(--accent)" stroke-width="2" fill="none" opacity=".6"/>';
    },
    bold: function (s) {
      return '<rect width="400" height="500" fill="#1d2026"/>' +
        '<circle cx="' + (220 + s * 37 % 120) + '" cy="' + (180 + s * 23 % 120) + '" r="' + (120 + s * 11 % 50) + '" fill="var(--main)"/>' +
        '<rect x="' + (20 + s * 31 % 120) + '" y="' + (260 - s * 17 % 90) + '" width="' + (140 + s * 13 % 50) + '" height="' + (140 + s * 13 % 50) + '" fill="var(--accent)"/>' +
        '<g stroke="#f2f1ec" stroke-width="9" opacity=".85">' + [0, 1, 2, 3].map(function (k) {
          return '<line x1="' + (20 + k * 28 + s * 19 % 200) + '" y1="30" x2="' + (70 + k * 28 + s * 19 % 200) + '" y2="120"/>';
        }).join('') + '</g>';
    },
    minimal: function (s) {
      return '<rect width="400" height="500" fill="var(--pic-bg,#f2f2ef)"/>' +
        '<circle cx="' + (170 + s * 29 % 80) + '" cy="' + (210 + s * 17 % 60) + '" r="' + (90 + s * 13 % 50) + '" fill="none" stroke="#1a1a1a" stroke-width="1.2"/>' +
        '<line x1="40" y1="' + (390 + s * 7 % 50) + '" x2="360" y2="' + (390 + s * 7 % 50) + '" stroke="#1a1a1a" stroke-width="1.2"/>' +
        '<circle cx="' + (280 + s * 23 % 70) + '" cy="' + (130 + s * 19 % 60) + '" r="' + (14 + s * 5 % 14) + '" fill="var(--main)"/>';
    }
  };
  function pic(src, alt, seed) {
    if (src) return '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy">';
    return '<svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + (SHAPES[style] || SHAPES.classic)(seed) + '</svg>';
  }

  /* ---------- header + footer ---------- */
  var PAGES = [['index.html', 'Home', 'home'], ['about.html', 'About', 'about'], ['services.html', 'Services', 'services'],
               ['gallery.html', 'Gallery', 'gallery'], ['contact.html', 'Contact', 'contact']];
  var brandHtml = d.logo
    ? '<img src="' + esc(d.logo) + '" alt="' + esc(name) + '">'
    : '<span class="mark" aria-hidden="true">' + esc(name.trim().charAt(0)) + '</span><span class="name">' + esc(name) + '</span>';
  var navLinks = PAGES.map(function (p) {
    return '<a href="' + p[0] + '"' + (p[2] === page ? ' class="active" aria-current="page"' : '') + '>' + p[1] + '</a>';
  }).join('');

  document.getElementById('site-header').innerHTML =
    '<div class="wrap bar">' +
      '<a class="brand" href="index.html">' + brandHtml + '</a>' +
      '<nav class="menu" id="menu" aria-label="Main">' + navLinks +
        (c.phone ? '<a class="btn call" href="' + tel(c.phone) + '">' + esc(c.phone) + '</a>' : '') + '</nav>' +
      '<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu"><span></span><span></span><span class="sr">Menu</span></button>' +
    '</div>';

  document.getElementById('site-footer').innerHTML =
    '<div class="wrap foot">' +
      '<div class="foot-brand"><a class="brand" href="index.html">' + brandHtml + '</a><p>' + esc(d.intro) + '</p></div>' +
      '<div><h4>Pages</h4><ul>' + PAGES.map(function (p) { return '<li><a href="' + p[0] + '">' + p[1] + '</a></li>'; }).join('') + '</ul></div>' +
      '<div><h4>Contact</h4><ul>' +
        (c.phone ? '<li><a href="' + tel(c.phone) + '">' + esc(c.phone) + '</a></li>' : '') +
        (c.email ? '<li><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></li>' : '') +
        (c.area ? '<li>' + esc(c.area) + '</li>' : '') + '</ul></div>' +
      ((d.socials || []).length ? '<div><h4>Follow</h4><ul>' + d.socials.map(function (s) {
        return '<li><a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a></li>';
      }).join('') + '</ul></div>' : '') +
    '</div>' +
    '<div class="wrap legal"><span>© ' + new Date().getFullYear() + ' ' + esc(name) + '</span><span>' + esc(c.area || '') + '</span></div>';

  /* ---------- reusable sections ---------- */
  function sectionHead(eyebrow, title, link) {
    return '<div class="section-head reveal"><div><p class="eyebrow">' + esc(eyebrow) + '</p><h2>' + esc(title) + '</h2></div>' +
      (link ? '<a class="link" href="' + link[0] + '">' + esc(link[1]) + ' <span aria-hidden="true">→</span></a>' : '') + '</div>';
  }
  function serviceCards(list) {
    return '<div class="cards">' + list.map(function (s, i) {
      return '<article class="card reveal"><span class="num">' + String(i + 1).padStart(2, '0') + '</span><h3>' + esc(s.name) + '</h3><p>' +
        esc(s.description) + '</p>' + (s.price ? '<span class="price">' + esc(s.price) + '</span>' : '') + '</article>';
    }).join('') + '</div>';
  }
  var gallery = d.gallery || [];
  function tiles(list) {
    return '<div class="tiles">' + list.map(function (g, i) {
      return '<button type="button" class="tile reveal" data-index="' + i + '" aria-label="View larger: ' + esc(g.caption || 'photo ' + (i + 1)) + '">' +
        '<span class="pic">' + pic(g.src, g.caption, i + 4) + '</span>' + (g.caption ? '<span class="caption">' + esc(g.caption) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function reviews() {
    var t = d.testimonials || [];
    if (!t.length) return '';
    return '<section class="block reviews"><div class="wrap">' + sectionHead('Kind words', 'What our customers say') +
      '<div class="carousel reveal" aria-roledescription="carousel" aria-label="Customer reviews">' +
        '<div class="slides" aria-live="polite">' + t.map(function (r, i) {
          return '<figure class="slide' + (i === 0 ? ' current' : '') + '" aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + t.length + '"' + (i === 0 ? '' : ' hidden') + '>' +
            '<blockquote>' + esc(r.quote) + '</blockquote><figcaption><b>' + esc(r.name) + '</b>' + (r.detail ? '<span>' + esc(r.detail) + '</span>' : '') + '</figcaption></figure>';
        }).join('') + '</div>' +
        (t.length > 1 ? '<div class="carousel-nav"><button type="button" class="prev" aria-label="Previous review">←</button><div class="dots">' +
          t.map(function (_, i) { return '<button type="button" aria-label="Show review ' + (i + 1) + '"' + (i === 0 ? ' aria-current="true"' : '') + '></button>'; }).join('') +
          '</div><button type="button" class="next" aria-label="Next review">→</button></div>' : '') +
      '</div></div></section>';
  }
  function ctaBand() {
    return '<section class="cta-band"><div class="wrap reveal"><h2>Ready to get started?</h2><p>Tell us what you need and we’ll get back to you within one working day.</p>' +
      '<a class="btn" href="contact.html">' + esc(d.cta_label || 'Get in touch') + '</a></div></section>';
  }
  function pageHero(eyebrow, title, text) {
    return '<section class="page-hero"><div class="wrap reveal"><p class="eyebrow">' + esc(eyebrow) + '</p><h1>' + esc(title) + '</h1>' +
      (text ? '<p class="lead">' + esc(text) + '</p>' : '') + '</div></section>';
  }

  /* ---------- pages ---------- */
  var words = (d.tagline || name).trim().split(/\s+/), last = words.pop();
  var VIEWS = {
    home: function () {
      return '<section class="hero"><div class="wrap">' +
          '<div class="hero-text reveal"><p class="eyebrow">' + esc(c.area || '') + '</p>' +
            '<h1>' + esc(words.join(' ')) + (words.length ? ' ' : '') + '<em>' + esc(last) + '</em></h1>' +
            '<p class="intro">' + esc(d.intro) + '</p>' +
            '<div class="actions"><a class="btn" href="contact.html">' + esc(d.cta_label || 'Get in touch') + '</a><a class="btn line" href="services.html">Our services</a></div>' +
            ((d.trust || []).length ? '<ul class="trust">' + d.trust.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
          '</div>' +
          '<div class="hero-media reveal"><div class="pic">' + pic(d.hero_image, name, 1) + '</div></div>' +
        '</div></section>' +
        ((d.highlights || []).length ? '<section class="highlights"><div class="wrap stats">' + d.highlights.map(function (h) {
          return '<div class="stat reveal"><b>' + esc(h.value) + '</b><span>' + esc(h.label) + '</span></div>';
        }).join('') + '</div></section>' : '') +
        '<section class="block"><div class="wrap">' + sectionHead('What we do', 'Our services', ['services.html', 'All services']) +
          serviceCards((d.services || []).slice(0, 3)) + '</div></section>' +
        (gallery.length ? '<section class="block work"><div class="wrap">' + sectionHead('Recent work', 'From our gallery', ['gallery.html', 'See the gallery']) +
          tiles(gallery.slice(0, 4)) + '</div></section>' : '') +
        reviews() + ctaBand();
    },
    about: function () {
      var o = d.owner;
      return pageHero('About us', d.about_title || 'About ' + name, d.intro) +
        '<section class="block story"><div class="wrap split"><div class="text reveal">' + paras(d.about) + '</div>' +
          '<div class="pic reveal">' + pic(d.about_image, 'About ' + name, 2) + '</div></div></section>' +
        (o && o.name ? '<section class="block owner"><div class="wrap split rev"><div class="pic reveal">' + pic(o.photo, o.name, 3) + '</div>' +
          '<div class="text reveal"><p class="eyebrow">Meet the team</p><h2>' + esc(o.name) + '</h2>' + (o.role ? '<p class="role">' + esc(o.role) + '</p>' : '') + paras(o.bio) + '</div></div></section>' : '') +
        ((d.values || []).length ? '<section class="block values"><div class="wrap">' + sectionHead('How we work', 'What you can expect') +
          '<div class="value-list">' + d.values.map(function (v, i) {
            return '<div class="value reveal"><span class="num">' + String(i + 1).padStart(2, '0') + '</span><h3>' + esc(v.title) + '</h3><p>' + esc(v.text) + '</p></div>';
          }).join('') + '</div></div></section>' : '') +
        reviews() + ctaBand();
    },
    services: function () {
      return pageHero('Services', 'What we do', 'Everything we offer, with prices to help you plan. Every job starts with a free, no-obligation quote.') +
        '<section class="block"><div class="wrap"><div class="service-list">' + (d.services || []).map(function (s, i) {
          return '<article class="service reveal"><span class="num">' + String(i + 1).padStart(2, '0') + '</span>' +
            '<div class="info"><h2>' + esc(s.name) + '</h2><p>' + esc(s.description) + '</p></div>' +
            '<div class="side">' + (s.price ? '<span class="price">' + esc(s.price) + '</span>' : '') +
            '<a class="btn line small" href="contact.html">Enquire</a></div></article>';
        }).join('') + '</div></div></section>' + ctaBand();
    },
    gallery: function () {
      return pageHero('Gallery', 'Our recent work', 'A look at some of the projects we’ve finished. Tap any photo to see it larger.') +
        '<section class="block"><div class="wrap">' + (gallery.length ? tiles(gallery) : '<p>Photos coming soon.</p>') + '</div></section>' + ctaBand();
    },
    contact: function () {
      var hours = Array.isArray(c.hours) ? c.hours : (c.hours ? [['Opening hours', c.hours]] : []);
      return pageHero('Contact', 'Let’s talk about your project', 'Send us a message or give us a call. We usually reply within one working day.') +
        '<section class="block contact"><div class="wrap split">' +
          '<div class="details reveal"><dl>' +
            (c.phone ? '<dt>Phone</dt><dd><a href="' + tel(c.phone) + '">' + esc(c.phone) + '</a></dd>' : '') +
            (c.email ? '<dt>Email</dt><dd><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></dd>' : '') +
            (c.address ? '<dt>Address</dt><dd>' + esc(c.address) + '</dd>' : '') +
            (c.area ? '<dt>Area covered</dt><dd>' + esc(c.area) + '</dd>' : '') + '</dl>' +
            (hours.length ? '<h3>Opening hours</h3><table class="hours">' + hours.map(function (h) {
              return '<tr><th scope="row">' + esc(h[0]) + '</th><td>' + esc(h[1]) + '</td></tr>';
            }).join('') + '</table>' : '') +
          '</div>' +
          '<form class="enquiry reveal" id="enquiry"><h2>Send us a message</h2>' +
            '<label>Your name<input name="name" autocomplete="name" required></label>' +
            '<label>Email<input name="email" type="email" autocomplete="email" required></label>' +
            '<label>Phone (optional)<input name="phone" type="tel" autocomplete="tel"></label>' +
            '<label>What do you need?<select name="service"><option value="">Choose a service</option>' +
              (d.services || []).map(function (s) { return '<option>' + esc(s.name) + '</option>'; }).join('') + '<option>Something else</option></select></label>' +
            '<label>Your message<textarea name="message" required></textarea></label>' +
            '<button class="btn" type="submit">Send message</button>' +
            '<p class="done" id="sent" role="status" hidden>Thanks! Your message has been sent. We’ll be in touch soon.</p>' +
          '</form>' +
        '</div></section>' +
        '<section class="map"><div class="wrap"><div class="map-box reveal" role="img" aria-label="Map of ' + esc(c.area || 'our area') + '">' +
          '<span>' + esc(c.address || c.area || '') + '</span></div></div></section>';
    }
  };

  main.innerHTML = (VIEWS[page] || VIEWS.home)();
  var titles = { home: d.tagline, about: 'About', services: 'Services', gallery: 'Gallery', contact: 'Contact' };
  document.title = page === 'home' ? name + (d.tagline ? ' | ' + d.tagline : '') : titles[page] + ' | ' + name;
  var md = document.querySelector('meta[name=description]'); if (md) md.content = d.intro || '';

  /* ---------- behaviour ---------- */
  // Mobile menu
  var toggle = document.querySelector('.menu-toggle'), menu = document.getElementById('menu');
  toggle.addEventListener('click', function () {
    var open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    body.classList.toggle('menu-open', open);
  });
  menu.addEventListener('click', function (e) { if (e.target.tagName === 'A') { toggle.setAttribute('aria-expanded', 'false'); body.classList.remove('menu-open'); } });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && body.classList.contains('menu-open')) { toggle.click(); toggle.focus(); }
  });

  // Header shadow once scrolled
  var hdr = document.getElementById('site-header');
  var onScroll = function () { hdr.classList.toggle('scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Fade-in on scroll (skipped when the visitor prefers less motion)
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    body.classList.add('js-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el, i) { el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });
  }

  // Reviews slider
  document.querySelectorAll('.carousel').forEach(function (car) {
    var slides = car.querySelectorAll('.slide'), dots = car.querySelectorAll('.dots button'), i = 0, timer;
    if (slides.length < 2) return;
    function show(n) {
      slides[i].hidden = true; slides[i].classList.remove('current'); dots[i].removeAttribute('aria-current');
      i = (n + slides.length) % slides.length;
      slides[i].hidden = false; slides[i].classList.add('current'); dots[i].setAttribute('aria-current', 'true');
    }
    car.querySelector('.prev').onclick = function () { stop(); show(i - 1); };
    car.querySelector('.next').onclick = function () { stop(); show(i + 1); };
    dots.forEach(function (b, n) { b.onclick = function () { stop(); show(n); }; });
    function stop() { clearInterval(timer); }
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(function () { show(i + 1); }, 7000);
    car.addEventListener('focusin', stop); car.addEventListener('mouseenter', stop);
  });

  // Gallery lightbox
  if (document.querySelector('.tile')) {
    var box = document.createElement('dialog');
    box.className = 'lightbox';
    box.setAttribute('aria-label', 'Photo viewer');
    box.innerHTML = '<button type="button" class="lb-close" aria-label="Close">×</button>' +
      '<button type="button" class="lb-prev" aria-label="Previous photo">←</button>' +
      '<figure><div class="lb-pic"></div><figcaption></figcaption></figure>' +
      '<button type="button" class="lb-next" aria-label="Next photo">→</button>';
    document.body.appendChild(box);
    var at = 0;
    function open(n) {
      at = (n + gallery.length) % gallery.length;
      var g = gallery[at];
      box.querySelector('.lb-pic').innerHTML = pic(g.src, g.caption, at + 4);
      box.querySelector('figcaption').textContent = (g.caption || '') + '  ·  ' + (at + 1) + ' of ' + gallery.length;
      if (!box.open) box.showModal();
    }
    document.querySelectorAll('.tile').forEach(function (t) { t.onclick = function () { open(+t.dataset.index); }; });
    box.querySelector('.lb-close').onclick = function () { box.close(); };
    box.querySelector('.lb-prev').onclick = function () { open(at - 1); };
    box.querySelector('.lb-next').onclick = function () { open(at + 1); };
    box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') open(at - 1);
      if (e.key === 'ArrowRight') open(at + 1);
    });
  }

  // Enquiry form (preview: on live sites this will send to the business owner)
  var form = document.getElementById('enquiry');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault(); form.reset(); document.getElementById('sent').hidden = false;
  });
})();
