// node build.mjs → dist/ (minified JS, absolute URLs set to the production domain)
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { transformSync, buildSync } from 'esbuild';

// Vercel sets VERCEL_PROJECT_PRODUCTION_URL (custom domain once one is added); SITE_URL overrides it
const host = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'grafysta.cz';
const site = 'https://' + host.replace(/^https?:\/\//, '').replace(/\/$/, '');

fs.rmSync('dist', { recursive: true, force: true });
fs.cpSync('src', 'dist', { recursive: true });
for (const f of ['assets/js/ribbon.js', 'assets/js/ribbon-core.js', 'assets/js/shader-card.js', 'assets/js/main.js']) {
  const code = fs.readFileSync(path.join('src', f), 'utf8');
  fs.writeFileSync(path.join('dist', f), transformSync(code, { minify: true, target: 'es2018', legalComments: 'inline' }).code);
}
for (const f of ['index.html', 'robots.txt', 'sitemap.xml', 'llms.txt']) {
  const p = path.join('dist', f);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replaceAll('https://grafysta.cz', site));
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
stamp('index.html', ['assets/js/shader-card.js', 'assets/js/ribbon.js', 'assets/js/main.js']);
stamp('o-mne/index.html', ['/o-mne/app.js', '/o-mne/app.css']);

console.log('dist ok →', site);
