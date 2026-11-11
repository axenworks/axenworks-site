"""Adds Unsplash photos to the sample businesses in samples.json. Run once, then rebuild the templates.
Each entry: (unsplash photo id, photographer, caption). First is the opening photo, second the About photo."""
import json, os
P = {
 'classic': [('1713461983836-de0a45009424','Jakub Żerdzicki','Going through the figures'),('1706169582307-8ae586631e8a','Jakub Żerdzicki','A tidy desk'),
             ('1787532378729-fe4241197405','Gylain Omer','Signing off the accounts'),('1713947503588-8ff8196dc4a3','Vitaly Gariev','Year-end review')],
 'bold': [('1771340012319-0b4fca008b54','Dextar Studio','Under the bonnet'),('1631720040176-0d789a643a78','sq lim','The workshop'),
          ('1619642751034-765dfdf7c58e','Christian Buehner','Hands on'),('1676018366904-c083ed678e60','Kato Blackmore','On the bench'),
          ('1613214150132-9606e332d68e','Benjamin Brunner','Ready to collect'),('1599256872237-5dcc0fbe9668','Nina Mercado','Parts in hand')],
 'minimal': [('1772607407371-44031ae3b69f','lei qian','Bowls on the shelf'),('1764507768733-667e135d8cb9','Laura Tommasina','At the wheel'),
             ('1778698993355-2c5f29edbfb9','Jonathan Cosens Photography','Pots drying'),('1776972334890-018cb3b3e3c6','Jonathan Cosens Photography','Small pots'),
             ('1776584615508-e70141dc7823','jason hu','Cups before glazing'),('1610206349499-c932c3b3aacb','Manki Kim','The breakfast cup')],
 'playful': [('1534361960057-19889db9621e','Joe Caione','Monty, after'),('1719464454959-9cf304ef4774','Buddy AN','A careful trim'),
             ('1561037404-61cd46aa615b','Victor G','Fresh from the bath'),('1548199973-03cce0bbc87b','Alvan Nee','The garden gang'),
             ('1760596687383-887f0eeae71b','Cham Pets Family','All smiles'),('1776880952098-1cc6dbbda513','Vinícius Costa','A calm hello')],
 'modern': [('1611396000732-f8c9a933424f','insung yoon','On the bench'),('1639776738932-956082f0b704','Vitalijus','New screen going on'),
            ('1782671987176-a9b521bcf296','Sandeep','Opened up'),('1588515603140-81bd9f7d1db0','Joel Rohland','Under the microscope'),
            ('1566728595333-75a1d7cae961','PR MEDIA','How they arrive')],
 'rustic': [('1632776350300-11016768b521','mk. s','The shop'),('1437275625246-b7a923f3d0f5','Melissa Askew','Apple harvest'),
            ('1567306295427-94503f8300d7','Shelley Pauls','Picked this morning'),('1471193945509-9ad0617afabf','Peter Wendt','Carrots and leeks'),
            ('1591586116988-62fe65164f8d','Shelley Pauls','The veg table'),('1696134228075-7fa1c3fb8a9e','Bruno Guerrero','Baskets by the door'),
            ('1485637701894-09ad422f6de6','Anne Preble','Tomatoes')],
 'editorial': [('1595467959554-9ffcbf37f10f','nikki gibson','A bride’s bouquet'),('1529636798458-92182e662485','Samantha Gades','A ceremony arch'),
               ('1519225421980-715cb0215aed','Photos by Lanty','Table flowers'),('1515934751635-c81c6bc9a2d8','Beatriz Pérez Moya','Garden roses'),
               ('1511288702291-e55d6cfbe3b5','Nathan Dumlao','The day itself')],
}
# before / after pairs (indexes into the list above) for trades where the slider makes sense
BA = {'bold': (2, 4), 'playful': (3, 1), 'modern': (4, 0)}
def url(pid, w): return 'https://images.unsplash.com/photo-%s?auto=format&fit=crop&w=%d&q=70' % (pid, w)
here = os.path.dirname(os.path.abspath(__file__)); f = os.path.join(here, 'samples.json'); d = json.load(open(f))
for st, ph in P.items():
    s = d[st]
    s['hero_image'] = url(ph[0][0], 1400); s['about_image'] = url(ph[1][0], 1100)
    s['gallery'] = [{'src': url(p[0], 1000), 'caption': p[2]} for p in (ph + ph)[:6]] if len(ph) < 6 else [{'src': url(p[0], 1000), 'caption': p[2]} for p in ph[:6]]
    if len(ph) < 6: s['gallery'] = [{'src': url(p[0], 1000), 'caption': p[2]} for p in ph]
    rest = ph[2:] + ph[:2]
    for i, pr in enumerate(s['projects']):
        pr.pop('before', None); pr['after'] = url(rest[i % len(rest)][0], 1200)
    if st in BA:
        b, a = BA[st]; s['projects'][0]['before'] = url(ph[b][0], 1200); s['projects'][0]['after'] = url(ph[a][0], 1200)
    names = []
    for p in ph:
        if p[1] not in names: names.append(p[1])
    s['photo_credit'] = 'Sample photos by ' + ', '.join(names) + ' on Unsplash'
json.dump(d, open(f, 'w'), ensure_ascii=False, indent=1)
print('ok')
