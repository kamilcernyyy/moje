// Works ("Mé práce") from content/prace/<slug>/ → detail pages, ribbon data, index, sitemap and llms entries.
// Every folder holds projekt.json + images (see content/README.md); the folder name is the page address.
import fs from 'fs';
import path from 'path';

export const TYPES = { web: 'Web', identita: 'Vizuální identita', motion: 'Motion', tisk: 'Tisk' };
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
        typLabel: TYPES[p.typ] || p.typ,
        obal: `/prace/${slug}/` + (files.find(f => /^obal\./.test(f)) || files[0]),
        desktop: pick(/^desktop\./)[0] || null,
        mobil: pick(/^mobil-/),
        galerie: pick(/^galerie-/),
        kusy: pick(/^kus-/),
        strany: pick(/^strana-/),
        dir: path.join(dir, slug)
      };
    })
    .sort((a, b) => (a.poradi ?? 999) - (b.poradi ?? 999) || a.nazev.localeCompare(b.nazev, 'cs'));
}

// data the gallery page needs (ribbon cards, index); kept small and inline
export const ribbonData = works => works.map(w => ({ slug: w.slug, nazev: w.nazev, typ: w.typ, typLabel: w.typLabel, klient: w.klient, rok: w.rok, obal: w.obal, barva: (w.barvy || [])[0] || '#1a1530' }));

const SHORT = { identita: 'Identita' };
// service filter chips (only the types that have works)
export function filterHtml(works) {
  const types = Object.keys(TYPES).filter(t => works.some(w => w.typ === t));
  if (types.length < 2) return '';
  return `<div class="pr-filter" role="group" aria-label="Filtr podle služby"><button type="button" data-typ="" aria-pressed="true">Vše</button>` +
    types.map(t => `<button type="button" data-typ="${t}" aria-pressed="false">${SHORT[t] || TYPES[t]}</button>`).join('') + `</div>`;
}

// the index ("Rejstřík"): real links in the HTML, so it works without WebGL and for crawlers
export function indexHtml(works) {
  return `<ol class="ix-list">${works.map((w, i) => `<li data-typ="${w.typ}"><a class="ix-item" href="/prace/${w.slug}/" data-img="${esc(w.obal)}" data-i="${i}">` +
    `<span class="ix-n">${String(i + 1).padStart(2, '0')}</span><span class="ix-name">${esc(w.nazev)}</span>` +
    `<span class="ix-meta">${esc(w.typLabel)} · ${esc(w.rok)}</span><img class="ix-thumb" src="${esc(w.obal)}" alt="" loading="lazy" width="96" height="96"></a></li>`).join('')}</ol>`;
}

const MODULE = {
  web: w => `<section class="dt-module dt-web" aria-label="Web v zařízení">
      <div class="dev" data-screens='${esc(JSON.stringify(w.mobil))}' data-color="${esc((w.barvy || [])[0])}">
        <div class="dev-stage"><img class="dev-fallback" src="${esc(w.mobil[0] || w.obal)}" alt="${esc(w.nazev)} na telefonu" loading="lazy"></div>
        <ol class="dev-steps">${w.mobil.map((_, i) => `<li><button type="button" data-screen="${i}" aria-label="Obrazovka ${i + 1}">${['Úvod', 'Nabídka', 'Kontakt', 'Detail', 'Mobil'][i] || 'Obrazovka ' + (i + 1)}</button></li>`).join('')}</ol>
      </div>
      ${w.web ? `<div class="live">
        <div class="live-win"><div class="live-bar"><i></i><i></i><i></i><span>${esc(w.web.replace(/^https?:\/\//, ''))}</span><a href="${esc(w.web)}" target="_blank" rel="noopener">Otevřít ↗</a></div>
          <div class="live-view"><iframe src="about:blank" data-src="${esc(w.web)}" title="Živý web ${esc(w.nazev)}" loading="lazy"></iframe>
          ${(w.poznamky || []).map((n, i) => `<button type="button" class="live-pin" style="left:${+n.x}%;top:${+n.y}%" aria-label="${esc(n.text)}"><b>${i + 1}</b><span>${esc(n.text)}</span></button>`).join('')}</div></div>
        <p class="live-note">Živý web přímo v rámu. Dá se v něm scrollovat a klikat.</p></div>` : ''}
    </section>`,
  tisk: w => `<section class="dt-module dt-tisk" aria-label="Tiskový stůl">
      <div class="desk" data-pieces='${esc(JSON.stringify(w.kusy))}' data-pages='${esc(JSON.stringify(w.strany))}' data-name="${esc(w.nazev)}">
        <div class="desk-fallback">${w.kusy.map(k => `<img src="${esc(k)}" alt="" loading="lazy">`).join('')}</div>
      </div>
      <p class="desk-hint">Tiskoviny leží na stole. Chyť je a hoď, kliknutím zvedneš kus k sobě${w.strany.length ? ', brožuru si prolistuješ' : ''}.</p>
    </section>`,
  identita: w => depth(w),
  motion: w => depth(w)
};
function depth(w) {
  const lines = (w.kapitoly || []).map(k => k.text.split('. ')[0].replace(/\.$/, '') + '.');
  return `<section class="dt-module dt-depth" aria-label="Hloubková galerie">
      <div class="dg"><div class="dg-stage">${w.galerie.map((g, i) => `<figure class="dg-item" data-i="${i}"><img src="${esc(g)}" alt="${esc(w.nazev)}, ukázka ${i + 1}" loading="lazy" width="1600" height="1000"></figure>` +
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
        image: site + w.obal, dateCreated: String(w.rok), genre: w.typLabel, keywords: (w.sluzby || []).join(', '),
        creator: { '@id': site + '/#studio' }, ...(w.klient ? { sourceOrganization: { '@type': 'Organization', name: w.klient } } : {}) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Grafysta', item: site + '/' },
        { '@type': 'ListItem', position: 2, name: 'Mé práce', item: site + '/prace/' },
        { '@type': 'ListItem', position: 3, name: w.nazev, item: url }] }
    ]
  };
  const gallery = [w.desktop, ...w.mobil, ...w.galerie, ...w.kusy].filter(Boolean);
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
<meta property="og:image" content="${site}${w.obal}">
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
      <p class="dt-kicker">${esc(w.typLabel)} · ${esc(w.rok)}${w.ukazka ? ' <span class="dt-badge">Ukázka</span>' : ''}</p>
      <h1>${esc(w.nazev)}</h1>
      <p class="dt-perex">${esc(w.perex)}</p>
    </div>
    <dl class="dt-facts">
      <div><dt>Klient</dt><dd>${esc(w.klient)}</dd></div>
      <div><dt>Rok</dt><dd>${esc(w.rok)}</dd></div>
      <div><dt>Služby</dt><dd>${(w.sluzby || []).map(esc).join(', ')}</dd></div>
      <div><dt>Role</dt><dd>${esc(w.role)}</dd></div>
    </dl>
  </header>
  <figure class="dt-cover" style="--c:${esc((w.barvy || [])[0])}"><img src="${esc(w.obal)}" alt="${esc(w.nazev)}, hlavní obrázek" width="900" height="900" fetchpriority="high"></figure>
  ${(MODULE[w.typ] || (() => ''))(w)}
  <section class="dt-chapters" aria-label="Případová studie">
    ${(w.kapitoly || []).map(k => `<div class="dt-ch"><h2>${esc(k.nadpis)}</h2><p>${esc(k.text)}</p></div>`).join('\n    ')}
  </section>
  ${gallery.length ? `<section class="dt-gallery" aria-label="Galerie">${gallery.map((g, k) => `<img src="${esc(g)}" alt="${esc(w.nazev)}, obrázek ${k + 1}" loading="lazy" class="${/mobil-|kus-/.test(g) ? 'is-tall' : ''}">`).join('')}</section>` : ''}
  <footer class="dt-end">
    <a class="dt-next" href="/prace/${next.slug}/" style="--c:${esc((next.barvy || [])[0])}">
      <span class="dt-next-k">Další projekt</span><span class="dt-next-name">${esc(next.nazev)}</span><span class="dt-next-meta">${esc(next.typLabel)} · ${esc(next.rok)}</span>
      <img src="${esc(next.obal)}" alt="" loading="lazy" width="900" height="900">
    </a>
    <div class="dt-cta">
      <p>Chceš něco podobného?</p>
      <a class="dt-cta-btn" href="/o-mne/">Chci něco podobného</a>
      <p class="dt-cta-note">Kontaktní stránka se připravuje, zatím vede na O mně.</p>
    </div>
  </footer>
</main>
<script src="/assets/vendor/gsap.min.js" defer></script>
<script src="/assets/vendor/ScrollTrigger.min.js" defer></script>
<script src="/assets/js/detail.js" defer></script>
${w.typ === 'web' ? '<script src="/assets/js/detail-web.js" defer></script>' : ''}${w.typ === 'tisk' ? '<link rel="stylesheet" href="/assets/js/detail-tisk.css" media="print" onload="this.media=\'all\'"><script src="/assets/js/detail-tisk.js" defer></script>' : ''}
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
    for (const f of fs.readdirSync(w.dir)) if (/\.(webp|jpe?g|png|avif)$/i.test(f)) fs.copyFileSync(path.join(w.dir, f), path.join(dir, f));
    fs.writeFileSync(path.join(dir, 'index.html'), detailHtml(w, i, works, site));
  });
  return works;
}
