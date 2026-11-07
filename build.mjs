// node build.mjs → dist/ (minified JS, absolute URLs set to the production domain)
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { transformSync, buildSync } from 'esbuild'; import { pathToFileURL } from 'url';

// Vercel sets VERCEL_PROJECT_PRODUCTION_URL (custom domain once one is added); SITE_URL overrides it
const host = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'grafysta.cz';
const site = 'https://' + host.replace(/^https?:\/\//, '').replace(/\/$/, '');

fs.rmSync('dist', { recursive: true, force: true });
fs.cpSync('src', 'dist', { recursive: true });
for (const f of ['assets/js/ribbon.js', 'assets/js/ribbon-core.js', 'assets/js/main.js', 'assets/js/shader-card.js', 'assets/js/intro.js', 'o-mne/loader.js', 'assets/js/flight.js']) {
  const code = fs.readFileSync(path.join('src', f), 'utf8');
  fs.writeFileSync(path.join('dist', f), transformSync(code, { minify: true, target: 'es2018', legalComments: 'inline' }).code);
}
for (const f of ['index.html', 'prace/index.html', 'robots.txt', 'sitemap.xml', 'llms.txt']) {
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
// headpage: Tile Reveal (React + GlassSurface buttons)
react('app/home/main.jsx', 'dist/assets/js/home.js');
// gallery of works (/prace/): flame panel with glass buttons over the Depth Ribbon
react('app/prace/main.jsx', 'dist/assets/js/prace.js');
// hero-03 tunnel scene: runs in a worker (or on the page as a fallback)
react('app/prace/tunnel-core.js', 'dist/assets/js/tunnel-core.js');

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
stamp('assets/js/main.js', ['assets/js/ribbon-core.js']);
stamp('index.html', ['/assets/js/home.js', '/assets/js/home.css']);
stamp('assets/js/prace.js', ['/assets/js/tunnel-core.js']);
stamp('prace/index.html', ['/assets/vendor/gsap.min.js', '/assets/vendor/ScrollTrigger.min.js', '/assets/js/intro.js', '/assets/js/flight.js', '/assets/js/ribbon.js', '/assets/js/main.js', '/assets/js/shader-card.js', '/assets/js/prace.js', '/assets/js/prace.css']);
stamp('o-mne/index.html', ['/assets/vendor/gsap.min.js', '/o-mne/loader.js', '/o-mne/app.js', '/o-mne/app.css']);

console.log('dist ok →', site);
