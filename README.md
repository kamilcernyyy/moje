# Grafysta — Depth Ribbon

Celoobrazovková replika komponenty **Depth Ribbon** (React Bits Pro, `@reactbits-starter/depth-ribbon-tw`) se stejnými výchozími props:
`count 72, path loop, tour cycle, interval 9 s, speed 0.6, cardSize 0.72, aspect 1, radius 0.12, offset 1, fov 60,
fog 1, thread 0.3, shadow 0.5, accentColor #B19EEF, background #0a0a0a`, popisek dole uprostřed, klik = přiblížení,
podržení = přehled, tažení a kolečko = posun, Esc = zpět, `prefers-reduced-motion` = zastaveno.

Vlastní WebGL2 implementace bez three.js a bez licenčního klíče; renderer běží ve Web Workeru (OffscreenCanvas),
s fallbackem na hlavní vlákno.

## Struktura

```
src/index.html                 stránka (jen komponenta) + neviditelné SEO meta
src/assets/js/ribbon-core.js   WebGL renderer
src/assets/js/ribbon.js        komponenta: DOM, popisek, vstupy, worker
src/assets/js/main.js          obrázky karet + props
src/assets/ribbon-poster*.webp první snímek (přehled) — okamžitý obsah při načtení, pak crossfade do živé scény
build.mjs                      npm run build → dist/ (Vercel to dělá sám)
```

## Obrázky karet

V `main.js` je 8 vlastních abstraktních obrázků kreslených za běhu. Skutečné obrázky: položce dej
`src: 'assets/works/nazev.webp'` (čtverec, ideálně 1024×1024) místo `draw`, plus `title` a `subtitle` pro popisek.

## Výkon

Lighthouse (lokálně): mobil i desktop 100 / 100 / 100 / 100 — FCP 0,6 s, LCP 1,1 s, TBT 50 ms, CLS 0 (mobil).

## Fonty

Bebas Neue (OFL) je v `src/fonts/bebas-neue/` a `src/css/bebas-neue.css`, zatím nikde nepoužitý. Použití: `@import url('css/bebas-neue.css');` a `font-family: BebasNeue-Regular;`.
