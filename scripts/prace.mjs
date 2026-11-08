import crypto from 'node:crypto';
// Works ("Mé práce") from content/prace/<slug>/ → detail pages, ribbon data, index, sitemap and llms entries.
// Every folder holds projekt.json + images (see content/README.md); the folder name is the page address.
import fs from 'fs';
import path from 'path';

export const TYPES = { web: 'Web', identita: 'Vizuální identita', motion: 'Motion', tisk: 'Tisk' };
// pixel size of an image file (webp / png / jpeg), so every <img> gets width and height
export function imageSize(file) {
  try {
    const b = fs.readFileSync(file);
    if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const t = b.toString('ascii', 12, 16);
      if (t === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
      if (t === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
      if (t === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    }
    if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (b[0] === 0xff && b[1] === 0xd8) {
      for (let i = 2; i < b.length;) {
        const m = b[i + 1], len = b.readUInt16BE(i + 2);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
        i += 2 + len;
      }
    }
  } catch (e) {}
  return [1600, 1000];
}
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function loadWorks(dir = 'content/prace') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(slug => fs.existsSync(path.join(dir, slug, 'projekt.json')))
    .map(slug => {
      const p = JSON.parse(fs.readFileSync(path.join(dir, slug, 'projekt.json'), 'utf8'));
      const files = fs.readdirSync(path.join(dir, slug)).filter(f => /\.(webp|jpe?g|png|avif)$/i.test(f)).sort((a, b) => a.localeCompare(b, 'cs', { numeric: true }));
      const pick = re => files.filter(f => re.test(f)).map(f => `/prace/${slug}/${f}`);
      return {
        ...p,
        slug,
        typy: p.typy && p.typy.length ? p.typy : [p.typ],
        // a work that spans several services (a whole brand) lists them all, short
        typLabel: p.typy && p.typy.length > 1 ? p.typy.map(t => SHORT[t] || TYPES[t] || t).join(' · ') : TYPES[p.typ] || p.typ,
        meta: [p.typy && p.typy.length > 1 ? p.typy.map(t => SHORT[t] || TYPES[t] || t).join(' · ') : TYPES[p.typ] || p.typ, p.rok].filter(Boolean).join(' · '),
        obal: `/prace/${slug}/` + (files.find(f => /^obal\./.test(f)) || files[0]),
        desktop: pick(/^desktop\./)[0] || null,
        mobil: pick(/^mobil-/),
        galerie: pick(/^galerie-/),
        nahled: pick(/^web-cela\./)[0] || null,
        // a video next to a picture of the same name (galerie-2.mp4 by galerie-2.webp) plays in its place; the picture is its poster
        video: Object.fromEntries(pick(/^galerie-/).map(g => [g, g.replace(/\.[a-z0-9]+$/i, '.mp4')]).filter(([, v]) => fs.existsSync(path.join(dir, slug, path.basename(v))))),
        og: files.includes('og.jpg') ? `/prace/${slug}/og.jpg` : null,
        kusy: pick(/^kus-/),
        strany: pick(/^strana-/),
        dir: path.join(dir, slug),
        hash: Object.fromEntries(files.map(f => [`/prace/${slug}/${f}`, crypto.createHash('sha1').update(fs.readFileSync(path.join(dir, slug, f))).digest('hex')])),
        size: Object.fromEntries(files.map(f => [`/prace/${slug}/${f}`, imageSize(path.join(dir, slug, f))]))
      };
    })
    .sort((a, b) => (a.poradi ?? 999) - (b.poradi ?? 999) || a.nazev.localeCompare(b.nazev, 'cs'));
}

// data the gallery page needs (ribbon cards, index); kept small and inline
export const ribbonData = works => works.map(w => ({ slug: w.slug, nazev: w.nazev, typ: w.typ, typy: w.typy, typLabel: w.typLabel, meta: w.meta, klient: w.klient, rok: w.rok, obal: w.obal, barva: (w.barvy || [])[0] || '#1a1530' }));

const SHORT = { identita: 'Identita' };
// service filter chips (only the types that have works)
export function filterHtml(works) {
  const types = Object.keys(TYPES).filter(t => works.some(w => w.typy.includes(t)));
  if (types.length < 2) return '';
  return `<div class="pr-filter" role="group" aria-label="Filtr podle služby"><button type="button" data-typ="" aria-pressed="true">Vše</button>` +
    types.map(t => `<button type="button" data-typ="${t}" aria-pressed="false">${SHORT[t] || TYPES[t]}</button>`).join('') + `</div>`;
}

// the index ("Rejstřík"): real links in the HTML, so it works without WebGL and for crawlers
export function indexHtml(works) {
  return `<ol class="ix-list">${works.map((w, i) => `<li data-typ="${w.typy.join(' ')}"><a class="ix-item" href="/prace/${w.slug}/" data-img="${esc(w.obal)}" data-i="${i}">` +
    `<span class="ix-n">${String(i + 1).padStart(2, '0')}</span><span class="ix-name">${esc(w.nazev)}</span>` +
    `<span class="ix-meta">${esc(w.meta)}</span><img class="ix-thumb" src="${esc(w.obal)}" alt="" loading="lazy" width="96" height="96"></a></li>`).join('')}</ol>`;
}

const MODULE = {
  web: w => `<section class="dt-module dt-web" aria-label="Web v zařízení">
      <div class="dev" data-screens='${esc(JSON.stringify(w.mobil))}' data-color="${esc((w.barvy || [])[0])}">
        <div class="dev-side">
          <h2 class="dt-mod-h">Na telefonu</h2>
          <p class="dt-mod-p">Vyber obrazovku a telefon se k ní otočí.</p>
          <ol class="dev-steps">${w.mobil.map((_, i) => `<li><button type="button" data-screen="${i}"${i ? '' : ' aria-current="true"'}>${['Úvod', 'Nabídka', 'Kontakt', 'Detail', 'Mobil'][i] || 'Obrazovka ' + (i + 1)}</button></li>`).join('')}</ol>
        </div>
        <div class="dev-stage"><img class="dev-fallback" src="${esc(w.mobil[0] || w.obal)}" alt="${esc(w.nazev)} na telefonu" loading="lazy" width="${(w.size[w.mobil[0] || w.obal] || [390])[0]}" height="${(w.size[w.mobil[0] || w.obal] || [0, 844])[1]}"></div>
      </div>
      ${w.web ? `<div class="live">
        <div class="live-head"><h2 class="dt-mod-h">${w.nahled ? 'Web' : 'Živý web'}</h2><p class="dt-mod-p">${w.nahled ? 'Celá úvodní stránka v okně prohlížeče, dá se v ní posouvat. Živý web otevřeš vpravo nahoře.' : 'Opravdový web přímo v rámu: dá se v něm scrollovat a klikat.'} Čísla ukazují, co na něm stojí za pozornost.</p></div>
        <div class="live-win"><div class="live-bar"><i></i><i></i><i></i><span>${esc(w.webNazev || w.web.replace(/^https?:\/\//, ''))}</span><a href="${esc(w.web)}" target="_blank" rel="noopener">Otevřít ↗</a></div>
          ${w.nahled
            ? `<div class="live-view live-scroll" tabindex="0" aria-label="Náhled celé stránky ${esc(w.webNazev || w.nazev)}, dá se v něm posouvat"><div class="live-page"><img src="${esc(w.nahled)}" alt="Celá úvodní stránka ${esc(w.webNazev || w.nazev)}" loading="lazy" width="${w.size[w.nahled][0]}" height="${w.size[w.nahled][1]}">
          ${(w.poznamky || []).map((n, i) => `<button type="button" class="live-pin" style="left:${+n.x}%;top:${+n.y}%" aria-label="${esc(n.text)}"><b>${i + 1}</b><span>${esc(n.text)}</span></button>`).join('')}</div></div></div>`
            : `<div class="live-view"><iframe src="about:blank" data-src="${esc(w.web)}" title="Živý web ${esc(w.nazev)}" loading="lazy"></iframe>
          ${(w.poznamky || []).map((n, i) => `<button type="button" class="live-pin" style="left:${+n.x}%;top:${+n.y}%" aria-label="${esc(n.text)}"><b>${i + 1}</b><span>${esc(n.text)}</span></button>`).join('')}</div></div>`}
        ${(w.poznamky || []).length ? `<ol class="live-notes">${w.poznamky.map((n, i) => `<li><b>${i + 1}</b>${esc(n.text)}</li>`).join('')}</ol>` : ''}</div>` : ''}
    </section>`,
  tisk: w => `<section class="dt-module dt-tisk" aria-label="Tiskový stůl">
      <div class="desk" data-pieces='${esc(JSON.stringify(w.kusy))}' data-pages='${esc(JSON.stringify(w.strany))}' data-name="${esc(w.nazev)}">
        <div class="desk-fallback">${w.kusy.map(k => `<img src="${esc(k)}" alt="" loading="lazy" width="${w.size[k][0]}" height="${w.size[k][1]}">`).join('')}</div>
      </div>
      <div class="desk-head"><h2 class="dt-mod-h">Tiskový stůl</h2><p class="dt-mod-p">Tiskoviny leží na stole. Chyť je a hoď, klepnutím zvedneš kus k sobě${w.strany.length ? ' a brožuru si prolistuješ' : ''}.</p></div>
    </section>`,
  identita: w => depth(w),
  motion: w => depth(w)
};
function depth(w) {
  const lines = (w.kapitoly || []).map(k => k.text.split('. ')[0].replace(/\.$/, '') + '.');
  return `<section class="dt-module dt-depth" aria-label="Hloubková galerie">
      <div class="dg-head"><h2 class="dt-mod-h">Průlet prací</h2><p class="dt-mod-p">Scrolluj a proleť projektem od zadání po výsledek.</p></div>
      <div class="dg"><div class="dg-stage">${w.galerie.map((g, i) => `<figure class="dg-item" data-i="${i}">${w.video[g]
        ? `<video src="${esc(w.video[g])}" poster="${esc(g)}" muted loop playsinline preload="none" width="${w.size[g][0]}" height="${w.size[g][1]}" aria-label="${esc(w.nazev)}, video ${i + 1}"></video>`
        : `<img src="${esc(g)}" alt="${esc(w.nazev)}, ukázka ${i + 1}" loading="lazy" width="${w.size[g][0]}" height="${w.size[g][1]}">`}</figure>` +
        (lines[i] ? `<p class="dg-line" data-i="${i}">${esc(lines[i])}</p>` : '')).join('')}</div></div>
    </section>`;
}

export function detailHtml(w, i, works, site) {
  const prev = works[(i - 1 + works.length) % works.length];
  const next = works[(i + 1) % works.length];
  const url = `${site}/prace/${w.slug}/`;
  const desc = w.perex;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CreativeWork', '@id': url + '#work', name: `${w.nazev} · ${w.typLabel}`, headline: w.nazev, description: desc, url, inLanguage: 'cs',
        image: site + w.obal, ...(w.rok ? { dateCreated: String(w.rok) } : {}), genre: w.typLabel, keywords: (w.sluzby || []).join(', '),
        creator: { '@id': site + '/#studio' }, ...(w.klient ? { sourceOrganization: { '@type': 'Organization', name: w.klient } } : {}) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Grafysta', item: site + '/' },
        { '@type': 'ListItem', position: 2, name: 'Mé práce', item: site + '/prace/' },
        { '@type': 'ListItem', position: 3, name: w.nazev, item: url }] }
    ]
  };
  // the closing gallery ("Všechny obrázky"): every picture of the work in one place, each once (FlexCarousel on top,
  // these rows stay as the crawlable / no-WebGL version)
  const seen = new Set();
  const gallery = [...(w.typy.includes('web') && !w.web && !w.nahled ? [w.desktop] : []), ...w.galerie, ...w.kusy].filter(Boolean)
    .filter(g => { const h = w.hash[g] || g; if (seen.has(h)) return false; seen.add(h); return true; });
  const label = g => {
    const v = (w.popisky || {})[path.basename(g).replace(/\.[a-z0-9]+$/i, '')];
    const [title, sub] = Array.isArray(v) ? v : [v];
    return { title: title || w.nazev, subtitle: sub || '' };
  };
  const shots = gallery.map((g, k) => ({ src: g, alt: `${label(g).title} · ${w.nazev}`, ...label(g) }));
  const rows = [];
  for (const g of gallery) {                      // rows of similar height: close a row once its aspect ratios add up to ~2.6
    const r = (w.size[g] || [16, 10]).reduce((a, b) => a / b);
    if (!rows.length || rows[rows.length - 1].sum >= 2.6) rows.push({ sum: 0, items: [] });
    rows[rows.length - 1].items.push(g); rows[rows.length - 1].sum += r;
  }
  if (rows.length > 1 && rows[rows.length - 1].sum < 2) { const last = rows.pop(); rows[rows.length - 1].items.push(...last.items); }
  const fig = (g, k) => { const [gw, gh] = w.size[g] || [1600, 1000]; return `<figure style="--r:${(gw / gh).toFixed(3)}"${gw / gh > 1.2 ? ' class="is-wide"' : gw / gh < 0.6 ? ' class="is-tall"' : ''}><img src="${esc(g)}" alt="${esc(shots[k].alt)}" loading="lazy" width="${gw}" height="${gh}"></figure>`; };
  return `<!doctype html>
<html lang="cs" data-slug="${esc(w.slug)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(w.nazev)} · ${esc(w.typLabel)} | Grafysta</title>
<meta name="description" content="${esc(desc)}">
${w.ukazka ? '<meta name="robots" content="noindex, follow">\n' : ''}<link rel="canonical" href="${url}">
<meta name="theme-color" content="#0a0a0a">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Grafysta">
<meta property="og:locale" content="cs_CZ">
<meta property="og:title" content="${esc(w.nazev)} · ${esc(w.typLabel)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${site}${w.og || w.obal}">${w.og ? '\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">' : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/odibee-sans-cz/OdibeeSansCZ-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${w.obal}" as="image" fetchpriority="high">
<link rel="stylesheet" href="/assets/css/detail.css">
<script>
  /* arriving through a ribbon card: the page starts inside the fog and clears */
  (function (d) { try { if (sessionStorage.getItem('dive') === d.dataset.slug && !matchMedia('(prefers-reduced-motion: reduce)').matches) d.classList.add('dive-in'); sessionStorage.removeItem('dive'); } catch (e) {} })(document.documentElement);
</script>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body data-typ="${esc(w.typ)}">
<a class="skip" href="#obsah">Přeskočit na obsah</a>
<!--MENU-->
<a class="hp-logo" href="/">Grafysta</a>
<nav class="dt-bar" aria-label="Projekty">
  <a class="dt-back" href="/prace/?k=${esc(w.slug)}#galerie" data-key="Escape"><span aria-hidden="true">←</span> Stuha</a>
  <span class="dt-title">${esc(w.nazev)} <i>· ${esc(w.typLabel)}</i></span>
  <span class="dt-count">${String(i + 1).padStart(2, '0')} / ${String(works.length).padStart(2, '0')}</span>
  <a class="dt-arrow" href="/prace/${prev.slug}/" rel="prev" aria-label="Předchozí projekt: ${esc(prev.nazev)}" data-key="ArrowLeft">‹</a>
  <a class="dt-arrow" href="/prace/${next.slug}/" rel="next" aria-label="Další projekt: ${esc(next.nazev)}" data-key="ArrowRight">›</a>
</nav>
<main id="obsah" class="dt">
  <header class="dt-hero">
    <div class="dt-head">
      <p class="dt-kicker">${esc(w.meta)}${w.ukazka ? ' <span class="dt-badge">Ukázka</span>' : ''}</p>
      <h1>${esc(w.nazev)}</h1>
      <p class="dt-perex">${esc(w.perex)}</p>
    </div>
    <dl class="dt-facts">
      <div><dt>Klient</dt><dd>${esc(w.klient)}</dd></div>
      ${w.rok ? `<div><dt>Rok</dt><dd>${esc(w.rok)}</dd></div>` : ''}
      <div><dt>Služby</dt><dd>${(w.sluzby || []).map(esc).join(', ')}</dd></div>
      <div><dt>Role</dt><dd>${esc(w.role)}</dd></div>
    </dl>
  </header>
  <figure class="dt-cover" style="--c:${esc((w.barvy || [])[0])}"><img src="${esc(w.obal)}" alt="${esc(w.nazev)}, hlavní obrázek" width="900" height="900" fetchpriority="high"></figure>
  ${w.typy.map(t => (MODULE[t] || (() => ''))(w)).join('\n  ')}
  <section class="dt-chapters" aria-label="Případová studie">
    ${(w.kapitoly || []).map(k => `<div class="dt-ch"><h2>${esc(k.nadpis)}</h2><p>${esc(k.text)}</p></div>`).join('\n    ')}
  </section>
  ${gallery.length ? `<section class="dt-gallery-wrap" aria-labelledby="g-h">
    <div class="g-head"><h2 class="dt-mod-h" id="g-h">Všechny obrázky</h2><p class="dt-mod-p">Táhni do stran nebo listuj šipkami. Klepnutím obrázek zvětšíš.</p></div>
    <div class="dt-gallery" data-flex="${esc(JSON.stringify(shots))}">${rows.map(r => `<div class="g-row">${r.items.map(g => fig(g, gallery.indexOf(g))).join('')}</div>`).join('')}</div>
  </section>` : ''}
  <footer class="dt-end">
    <a class="dt-next" href="/prace/${next.slug}/" style="--c:${esc((next.barvy || [])[0])}">
      <span class="dt-next-k">Další projekt</span><span class="dt-next-name">${esc(next.nazev)}</span><span class="dt-next-meta">${esc(next.meta)}</span>
      <img src="${esc(next.obal)}" alt="" loading="lazy" width="${(next.size[next.obal] || [900])[0]}" height="${(next.size[next.obal] || [0, 900])[1]}">
    </a>
    <div class="dt-cta">
      <p>Chceš něco podobného?</p>
      <a class="dt-cta-btn" href="/o-mne/" data-electric>Chci něco podobného</a>
      <p class="dt-cta-note">Kontaktní stránka se připravuje, zatím vede na O mně.</p>
    </div>
  </footer>
</main>
<script src="/assets/vendor/gsap.min.js" defer></script>
<script src="/assets/vendor/ScrollTrigger.min.js" defer></script>
<script src="/assets/js/detail.js" defer></script>
${w.typy.includes('web') && w.mobil.length ? '<script src="/assets/js/detail-web.js" defer></script>' : ''}${w.typy.includes('tisk') && w.kusy.length ? '<link rel="stylesheet" href="/assets/js/detail-tisk.css" media="print" onload="this.media=\'all\'"><script src="/assets/js/detail-tisk.js" defer></script>' : ''}
</body>
</html>
`;
}

// write pages + copy assets; returns the works list for the gallery page
export function buildWorks(site, out = 'dist') {
  const works = loadWorks();
  works.forEach((w, i) => {
    const dir = path.join(out, 'prace', w.slug);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(w.dir)) if (/\.(webp|jpe?g|png|avif|mp4)$/i.test(f)) fs.copyFileSync(path.join(w.dir, f), path.join(dir, f));
    // an optional static site of the work (web/), shown in the live frame
    if (fs.existsSync(path.join(w.dir, 'web'))) fs.cpSync(path.join(w.dir, 'web'), path.join(dir, 'web'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), detailHtml(w, i, works, site));
  });
  return works;
}
