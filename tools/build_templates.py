"""Builds the template folders: one tiny HTML shell per page plus the sample site.json.
Run from the repo root:  python3 tools/build_templates.py
All design lives in templates/_shared (site.js, base.css, s-<style>.css)."""
import json, os, shutil

ROOT = os.path.join(os.path.dirname(__file__), '..', 'templates')
SAMPLES = json.load(open(os.path.join(os.path.dirname(__file__), 'samples.json')))
PAGES = {
    'starter': ['index'],
    'standard': ['index', 'about', 'services', 'gallery', 'contact'],
    'pro': ['index', 'about', 'services', 'portfolio', 'project', 'reviews', 'faq', 'contact'],
}
FONTS = {
    'classic': 'family=Libre+Caslon+Display&family=Public+Sans:wght@400;600;700',
    'bold': 'family=Archivo:wdth,wght@62..125,400..900',
    'minimal': 'family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1',
    'playful': 'family=Fredoka:wght@400;600;700&family=Nunito:wght@400;700;800',
    'modern': 'family=Sora:wght@400;600;700&family=Manrope:wght@400;600;700',
    'rustic': 'family=Fraunces:opsz,wght@9..144,400..800&family=Work+Sans:wght@400;600',
    'editorial': 'family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..800;1,6..96,400..800&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..600',
}
EXTRA = {
    'minimal': {'process_title': 'How a piece is made', 'projects_title': 'Selected work'},
    'rustic': {'process_title': 'The farming year', 'projects_title': 'What’s on'},
    'editorial': {'projects_title': 'Recent weddings'},
    'playful': {'projects_title': 'Before and after'},
}

def shell(level, style, page):
    fonts = '' if level == 'starter' else (
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link href="https://fonts.googleapis.com/css2?%s&display=swap" rel="stylesheet">\n' % FONTS[style])
    return f'''<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Loading</title>
{fonts}<link rel="stylesheet" href="../_shared/base.css">
<link rel="stylesheet" href="../_shared/s-{style}.css">
</head>
<body class="lv-{level} st-{style} pg-{'home' if page == 'index' else page}" data-level="{level}" data-style="{style}" data-page="{'home' if page == 'index' else page}">
<a class="skip" href="#main">Skip to content</a>
<div id="app"></div>
<noscript><p style="padding:24px">This website needs JavaScript switched on to display.</p></noscript>
<script src="../_shared/site.js"></script>
</body>
</html>
'''

for level, pages in PAGES.items():
    for style, sample in SAMPLES.items():
        folder = os.path.join(ROOT, f'{level}-{style}')
        if os.path.isdir(folder):
            shutil.rmtree(folder)
        os.makedirs(folder)
        for p in pages:
            open(os.path.join(folder, p + '.html'), 'w').write(shell(level, style, p))
        data = dict(sample, _sample=True, **EXTRA.get(style, {}))
        json.dump(data, open(os.path.join(folder, 'site.json'), 'w'), ensure_ascii=False, indent=1)
print('built', sum(len(p) for p in PAGES.values()) * len(SAMPLES), 'pages')
