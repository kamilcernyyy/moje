// node build.mjs → dist/ (minified JS, absolute URLs set to the production domain)
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { transformSync, buildSync, build } from 'esbuild'; import { execSync } from 'child_process'; import { pathToFileURL } from 'url';
import { buildWorks, ribbonData } from './scripts/prace.mjs';

// Vercel sets VERCEL_PROJECT_PRODUCTION_URL (custom domain once one is added); SITE_URL overrides it
const host = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'grafysta.cz';
const site = 'https://' + host.replace(/^https?:\/\//, '').replace(/\/$/, '');

fs.rmSync('dist', { recursive: true, force: true });
fs.cpSync('src', 'dist', { recursive: true });

// works: content/prace/<slug>/ → /prace/<slug>/ detail pages (+ data for the ribbon and the index below)
const works = buildWorks(site);
for (const f of ['assets/js/intro.js', 'o-mne/loader.js', 'assets/js/flight.js', 'assets/js/site.js', 'assets/js/detail.js', 'assets/js/detail-web.js']) {
  const code = fs.readFileSync(path.join('src', f), 'utf8');
  fs.writeFileSync(path.join('dist', f), transformSync(code, { minify: true, target: 'es2018', legalComments: 'inline' }).code);
}
// the gallery page: the works for the wheel (inline data) and every work as a plain link (crawlers, no JS)
{
  const p = path.join('dist', 'prace/index.html');
  const e = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8')
    .replace('<!--PRACE-->', `<script>window.__PRACE=${JSON.stringify(ribbonData(works)).replace(/</g, '\\u003c')}</script>`)
    .replace('<!--POCET-->', String(works.length).padStart(2, '0'))
    .replace('<!--SEZNAM-->', `<ul class="pr-list">${works.map(w => `<li><a href="/prace/${w.slug}/">${e(w.nazev)}</a> <span>${e(w.ukazka ? `${w.meta} · Ukázka` : w.meta)}</span></li>`).join('')}</ul>`));
}
// "O mně": the works for the "Vybrané práce" carousel (covers, names, links)
{
  const p = path.join('dist', 'o-mne/index.html');
  const pick = works.map(w => ({ src: w.obal, alt: `${w.nazev}, ${w.meta}`, title: w.nazev, subtitle: w.ukazka ? `${w.meta} · Ukázka` : w.meta, href: `/prace/${w.slug}/` }));
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('<!--VYBER-->', `<script type="application/json" id="om-prace">${JSON.stringify(pick).replace(/</g, '\\u003c')}</script>`));
}
// sitemap: real works only (sample projects stay out of search)
{
  const p = path.join('dist', 'sitemap.xml');
  const urls = works.filter(w => !w.ukazka).map(w => `  <url><loc>https://grafysta.cz/prace/${w.slug}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>`).join('\n');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('</urlset>', (urls ? urls + '\n' : '') + '</urlset>'));
}
// global menu (Gooey Navbar in glass), page transitions and the shared site script on every page.
// The menu is server-rendered into every page (links work at once), its Tailwind inlined; menu.js hydrates it later.
// lab pages: a switcher between all the studies, bottom right (plain <details>, no script)
const LABS = [['pozadi', '3D pozadí'], ['kamera', 'Kamera a strom'], ['video', 'Video z částic'], ['zraloci', 'Žraloci po stránce'], ['kmen', 'Žraloci kolem kmene'], ['chobotnice', 'Chobotnice'], ['meduza', 'Medúza'], ['manty', 'Manty'], ['kladivoun', 'Kladivoun'], ['das', 'Ďas']];
const labNav = f => {
  const here = f.split('/')[1];
  const links = LABS.map(([k, n]) => `<a href="/lab/${k}/"${k === here ? ' aria-current="page"' : ''}>${n}</a>`).join('');
  return `<style>.lab-nav{position:fixed;z-index:52;right:16px;bottom:16px;font:400 16px/1 "Odibee Sans CZ","Odibee Sans","Arial Narrow",sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#f2f2f3}.lab-nav summary{list-style:none;cursor:pointer;padding:10px 14px 8px;border-radius:999px;background:rgba(14,14,18,.76);border:1px solid rgba(255,255,255,.18);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}.lab-nav summary::-webkit-details-marker{display:none}.lab-nav[open] summary{background:#5227FF;border-color:#5227FF}.lab-nav div{position:absolute;right:0;bottom:calc(100% + 8px);display:grid;gap:4px;min-width:210px;padding:8px;border-radius:18px;background:rgba(14,14,18,.86);border:1px solid rgba(255,255,255,.18);-webkit-backdrop-filter:blur(16px) saturate(1.4);backdrop-filter:blur(16px) saturate(1.4)}.lab-nav a{display:block;padding:9px 12px 7px;border-radius:999px;color:#f2f2f3;text-decoration:none}.lab-nav a:hover{background:rgba(255,255,255,.08)}.lab-nav a[aria-current]{color:#B19EEF;background:rgba(82,39,255,.22)}.lab-nav summary:focus-visible,.lab-nav a:focus-visible{outline:2px solid #B19EEF;outline-offset:2px}</style><details class="lab-nav"><summary>Laboratoř ▴</summary><div>${links}</div></details>`;
};
const htmlPages = ['index.html', 'prace/index.html', 'o-mne/index.html', '404.html', 'lab/pozadi/index.html', 'lab/kamera/index.html', 'lab/video/index.html', 'lab/zraloci/index.html', 'lab/kmen/index.html', 'lab/chobotnice/index.html', 'lab/meduza/index.html', 'lab/manty/index.html', 'lab/kladivoun/index.html', 'lab/das/index.html', ...works.map(w => `prace/${w.slug}/index.html`)];
{
  buildSync({ entryPoints: ['app/menu/ssr.jsx'], bundle: true, jsx: 'automatic', platform: 'node', packages: 'external', format: 'esm',
    define: { 'process.env.NODE_ENV': '"production"' }, outfile: 'menu-ssr.tmp.mjs', logLevel: 'warning' });
  const { default: renderMenu } = await import(pathToFileURL(path.resolve('menu-ssr.tmp.mjs')).href + '?t=' + Date.now());
  fs.rmSync('menu-ssr.tmp.mjs', { force: true });
  const twMenu = execSync('npx tailwindcss -c tailwind.config.cjs -i app/menu/menu.css --content "./components/ui/gooey-navbar.tsx,./app/menu/*.jsx" --minify', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const menuCss = fs.readFileSync('src/assets/css/menu.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, ' ').trim();
  const html = {};
  for (const f of htmlPages) {
    const p = path.join('dist', f);
    const active = f === 'index.html' ? 0 : f === '404.html' || f.startsWith('lab/') ? -1 : f.startsWith('o-mne') ? 2 : 1;
    html[active] ??= renderMenu(active);
    const menu = `<link rel="preload" href="/assets/fonts/inter-600-menu.woff2" as="font" type="font/woff2" crossorigin><style>${menuCss}${twMenu}</style><div class="gm" id="gm" data-active="${active}">${html[active]}</div>`;
    let t = fs.readFileSync(p, 'utf8');
    t = t.includes('<!--MENU-->') ? t.replace('<!--MENU-->', menu) : t.replace(/<body([^>]*)>/, `<body$1>\n${menu}`);
    t = t.replace('</body>', '<script src="/assets/js/site.js" defer></script>\n</body>');
    if (f.startsWith('lab/')) t = t.replace('</body>', labNav(f) + '\n</body>');
    fs.writeFileSync(p, t);
  }
}
for (const f of ['index.html', 'prace/index.html', 'o-mne/index.html', 'robots.txt', 'sitemap.xml', 'llms.txt', ...works.map(w => `prace/${w.slug}/index.html`)]) {
  const p = path.join('dist', f);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replaceAll('https://grafysta.cz', site));
}
const react = (entry, outfile) => buildSync({
  entryPoints: [entry],
  bundle: true,
  minify: true,
  jsx: 'automatic',
  target: 'es2020',
  format: 'iife',
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile,
  legalComments: 'none',
  logLevel: 'warning'
});
// headpage: the headline made of particles (OGL)
buildSync({ entryPoints: ['app/home/particles.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: 'dist/assets/js/home-particles.js', legalComments: 'none', logLevel: 'warning' });
buildSync({ entryPoints: ['app/home/particles-core.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: 'dist/assets/js/home-particles-core.js', legalComments: 'none', logLevel: 'warning' });
// lab: the 3D background study (/lab/pozadi/, noindex, not linked from the site)
buildSync({ entryPoints: ['app/lab/kamera.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: 'dist/assets/js/lab-kamera.js', legalComments: 'none', logLevel: 'warning' });
buildSync({ entryPoints: ['app/lab/meduza.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: 'dist/assets/js/lab-meduza.js', legalComments: 'none', logLevel: 'warning' });
buildSync({ entryPoints: ['app/lab/manty.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: 'dist/assets/js/lab-manty.js', legalComments: 'none', logLevel: 'warning' });
buildSync({ entryPoints: ['app/lab/kladivoun.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: 'dist/assets/js/lab-kladivoun.js', legalComments: 'none', logLevel: 'warning' });
buildSync({ entryPoints: ['app/lab/das.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: 'dist/assets/js/lab-das.js', legalComments: 'none', logLevel: 'warning' });
buildSync({ entryPoints: ['app/lab/chobotnice.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: 'dist/assets/js/lab-chobotnice.js', legalComments: 'none', logLevel: 'warning' });
buildSync({ entryPoints: ['app/lab/kmen.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: 'dist/assets/js/lab-kmen.js', legalComments: 'none', logLevel: 'warning' });
buildSync({ entryPoints: ['app/lab/zraloci.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: 'dist/assets/js/lab-zraloci.js', legalComments: 'none', logLevel: 'warning' });
buildSync({ entryPoints: ['app/lab/video.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: 'dist/assets/js/lab-video.js', legalComments: 'none', logLevel: 'warning' });
buildSync({ entryPoints: ['app/lab/pozadi.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: 'dist/assets/js/lab-pozadi.js', legalComments: 'none', logLevel: 'warning' });
// the menu comes alive (hover liquid) once the page is idle: site.js loads it
react('app/menu/main.jsx', 'dist/assets/js/menu.js');
// headpage: Tile Reveal (React + GlassSurface buttons)
react('app/home/main.jsx', 'dist/assets/js/home.js');
// gallery of works (/prace/): flame panel with glass buttons over the Depth Ribbon
// the wheel of works (21st.dev Radial Scroll Gallery, TSX + shadcn): one GSAP on the page, so 'gsap' and
// 'gsap/ScrollTrigger' resolve to the copies the page already loads (/assets/vendor); '@/…' from tsconfig.json
await build({
  entryPoints: ['app/prace/main.jsx'],
  bundle: true,
  minify: true,
  jsx: 'automatic',
  target: 'es2020',
  format: 'iife',
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: 'dist/assets/js/prace.js',
  legalComments: 'none',
  logLevel: 'warning',
  plugins: [{
    name: 'page-gsap',
    setup(b) {
      b.onResolve({ filter: /^gsap(\/ScrollTrigger)?$/ }, a => ({ path: a.path, namespace: 'page-gsap' }));
      b.onLoad({ filter: /.*/, namespace: 'page-gsap' }, a => ({
        contents: a.path === 'gsap'
          ? 'const g = window.gsap; export default g; export { g as gsap };'
          : 'const s = window.ScrollTrigger; export default s; export { s as ScrollTrigger };',
        loader: 'js'
      }));
    }
  }]
});
// Tailwind (shadcn tokens in Grafysta colours) for the wheel only
execSync('npx tailwindcss -c tailwind.config.cjs -i app/prace/wheel.css -o dist/assets/js/tw.css --minify', { stdio: 'pipe' });
// hero-03 tunnel scene: runs in a worker (or on the page as a fallback)
react('app/prace/tunnel-core.js', 'dist/assets/js/tunnel-core.js');
// detail of a web project: the 3D phone scene (worker, or on the page as a fallback)
react('app/prace/device-core.js', 'dist/assets/js/device-core.js');
// detail of a print project: the desk (Tumble Wall), loupe and brochure
react('app/prace/detail-tisk.jsx', 'dist/assets/js/detail-tisk.js');
// work details, end of the page: FlexCarousel gallery + Electric Border CTA (loaded when the end comes near)
react('app/fx/detail-fx.jsx', 'dist/assets/js/detail-fx.js');

// above-the-fold markup is pre-rendered (first paint and crawlers get the real headline); layout CSS inlined where needed
for (const { entry, page, css } of [
  { entry: 'app/home/ssr.jsx', page: 'index.html', css: 'app/home/TileReveal.css' },
  { entry: 'app/prace/ssr.jsx', page: 'prace/index.html' }
]) {
  buildSync({
    entryPoints: [entry],
    bundle: true,
    jsx: 'automatic',
    platform: 'node',
    packages: 'external',
    format: 'esm',
    loader: { '.css': 'empty' },
    define: { 'process.env.NODE_ENV': '"production"' },
    outfile: 'ssr.tmp.mjs',
    logLevel: 'warning'
  });
  const { default: render } = await import(pathToFileURL(path.resolve('ssr.tmp.mjs')).href + '?t=' + Date.now() + entry);
  const p = path.join('dist', page);
  let html = fs.readFileSync(p, 'utf8').replace('<!--SSR-->', render());
  if (css) html = html.replace('/*TILE_REVEAL_CSS*/', fs.readFileSync(css, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, ' ').trim());
  fs.writeFileSync(p, html);
  fs.rmSync('ssr.tmp.mjs', { force: true });
}

// "O mně a proč zvolit mě": React + Lanyard (three) bundle
buildSync({
  entryPoints: ['app/o-mne/main.jsx'],
  bundle: true,
  minify: true,
  jsx: 'automatic',
  target: 'es2020',
  format: 'iife',
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: 'dist/o-mne/app.js',
  legalComments: 'none',
  logLevel: 'warning'
});

// cache busting: every JS/CSS URL gets ?v=<content hash>, so a new deploy is never hidden by a cached file
const hash = f => crypto.createHash('sha1').update(fs.readFileSync(path.join('dist', f))).digest('hex').slice(0, 10);
const stamp = (file, refs) => {
  let t = fs.readFileSync(path.join('dist', file), 'utf8');
  for (const r of refs) t = t.split(r).join(r + '?v=' + hash(r.replace(/^\//, '')));
  fs.writeFileSync(path.join('dist', file), t);
};
stamp('assets/js/ink.js', ['/assets/js/ink-core.js']);
stamp('assets/js/home-particles.js', ['/assets/js/home-particles-core.js']);
stamp('index.html', ['/assets/js/home.js', '/assets/js/home.css', '/assets/js/home-particles.js']);
stamp('assets/js/prace.js', ['/assets/js/tunnel-core.js']);
stamp('assets/js/detail-web.js', ['/assets/js/device-core.js']);
stamp('assets/js/detail.js', ['/assets/js/detail-fx.js', '/assets/js/detail-fx.css']);
stamp('prace/index.html', ['/assets/vendor/gsap.min.js', '/assets/vendor/ScrollTrigger.min.js', '/assets/js/intro.js', '/assets/js/flight.js', '/assets/js/prace.js', '/assets/js/prace.css', '/assets/js/tw.css']);
stamp('o-mne/index.html', ['/assets/vendor/gsap.min.js', '/o-mne/loader.js', '/o-mne/app.js', '/o-mne/app.css']);
stamp('assets/js/site.js', ['/assets/js/menu.js']);
stamp('lab/pozadi/index.html', ['/assets/js/lab-pozadi.js']);
stamp('lab/kamera/index.html', ['/assets/js/lab-kamera.js']);
stamp('lab/video/index.html', ['/assets/vendor/gsap.min.js', '/assets/js/lab-video.js']);
stamp('lab/zraloci/index.html', ['/assets/vendor/gsap.min.js', '/assets/js/lab-zraloci.js']);
stamp('lab/kmen/index.html', ['/assets/vendor/gsap.min.js', '/assets/vendor/ScrollTrigger.min.js', '/assets/js/lab-kmen.js']);
stamp('lab/chobotnice/index.html', ['/assets/vendor/gsap.min.js', '/assets/vendor/ScrollTrigger.min.js', '/assets/js/lab-chobotnice.js']);
stamp('lab/meduza/index.html', ['/assets/vendor/gsap.min.js', '/assets/vendor/ScrollTrigger.min.js', '/assets/js/lab-meduza.js']);
stamp('lab/manty/index.html', ['/assets/vendor/gsap.min.js', '/assets/vendor/ScrollTrigger.min.js', '/assets/js/lab-manty.js']);
stamp('lab/kladivoun/index.html', ['/assets/vendor/gsap.min.js', '/assets/vendor/ScrollTrigger.min.js', '/assets/js/lab-kladivoun.js']);
stamp('lab/das/index.html', ['/assets/vendor/gsap.min.js', '/assets/vendor/ScrollTrigger.min.js', '/assets/js/lab-das.js']);
for (const f of htmlPages) stamp(f, ['/assets/js/site.js']);
for (const w of works) stamp(`prace/${w.slug}/index.html`, ['/assets/css/detail.css', '/assets/vendor/gsap.min.js', '/assets/vendor/ScrollTrigger.min.js', '/assets/js/detail.js', '/assets/js/detail-web.js', '/assets/js/detail-tisk.js', '/assets/js/detail-tisk.css'].filter(r => fs.existsSync(path.join('dist', r.slice(1)))));

console.log('dist ok →', site);
