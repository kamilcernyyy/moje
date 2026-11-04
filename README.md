# Grafysta — portfolio (headpage)

Úvodní stránka s **Depth Ribbon** efektem: stuha náhledů prací vinoucí se 3D prostorem.
Vlastní WebGL2 implementace podle API React Bits Pro Depth Ribbon — bez three.js, bez Reactu, bez licenčního klíče.

## Struktura

```
src/                     zdroj (upravuj tady)
  index.html             markup, kritické CSS, meta/OG, JSON-LD
  assets/js/ribbon-core.js   WebGL renderer (běží ve Web Workeru přes OffscreenCanvas)
  assets/js/ribbon.js        ovladač na stránce: canvas, vstupy, artwork, fallback na main thread
  assets/js/main.js          data prací, generované plakáty, UI, index prací
  assets/fonts/          self-hosted Instrument Serif, Geist, Geist Mono (latin + latin-ext)
  assets/vendor/gsap.min.js
  robots.txt, sitemap.xml, llms.txt, site.webmanifest, favicon.svg
dist/                    hotový build k nasazení (minifikované JS)
build.mjs                npm run build → dist/  (Vercel to dělá sám)
vercel.json              build, výstup dist/, cache a bezpečnostní hlavičky
```

## Nasazení

Push do `main` → Vercel spustí `npm run build` a nasadí `dist/`.
Absolutní URL (canonical, OG, sitemap, robots, llms.txt) se při buildu přepíšou na produkční doménu projektu
(`VERCEL_PROJECT_PRODUCTION_URL`). Až přidáš vlastní doménu (např. grafysta.cz), přepne se to samo při dalším deployi.
Ručně jde doménu vynutit proměnnou `SITE_URL`.

## Výměna náhledů za skutečné práce

V `src/assets/js/main.js` v poli `WORKS` přidej položce `src` (poměr 4:5, ideálně 1024×1280 WebP/JPG):

```js
{ title: 'Kamstav', sub: 'Web & logo · kamenné stavby', tag: 'Web', bg: '#1E3BB3', src: 'assets/works/kamstav.webp', ... }
```

Položka se `src` použije obrázek místo vygenerovaného plakátu; `bg` zůstává jako barva, než se obrázek načte.
Pak commit + push.

## Nastavení stuhy

V `main.js` → `new DepthRibbon(stage, { ... })`. Stejné props jako React Bits Pro:
`count, path ('loop'|'knot'|'wave'), tour ('cycle'|'ride'|'overview'), interval, speed, cardSize, aspect,
radius, offset, fov, fog, thread, shadow, accentColor, backgroundColor, focusOnClick, holdToReveal,
draggable, wheel, pauseOnHover, seed, paused, dpr`.
API: `focusItem(i)`, `release()`, `travel(n)`, `reveal()`, `destroy()`.

Ovládání: tažení = posun s inercí, kolečko = posun, podržení = přehled celé stuhy (tažením otáčíš),
klik = přiblížení práce s popiskem, Esc = zpět, šipky = o kartu dál/zpět. `prefers-reduced-motion` stuhu zastaví.

## Výkon

Lighthouse (lokálně, gzip): mobil 100 / 100 / 100 / 100, desktop 100 / 100 / 100 / 100. LCP 0,7 s, TBT 60 ms, CLS 0.
- WebGL běží ve Web Workeru → hlavní vlákno zůstává volné (TBT, INP).
- Úvodní animace nadpisu je CSS, takže LCP nečeká na JavaScript.
- Stuha startuje až po `load` + idle; plakáty se kreslí po jednom v idle slotech.
- Adaptivní rozlišení: když snímky zdražují, render scale klesá (min. 0,5×); softwarové GL dostane nižší rozpočet.
