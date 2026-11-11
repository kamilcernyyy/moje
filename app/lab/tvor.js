/* Grafysta lab: what the sea creatures share (medúza, manty, kladivoun, ďas; built the same way as the octopus).
   A creature is a drawing read into two small images: <name>.webp (its tone) and <name>-pole.png (R: how far along
   the body from a seed point, 0 … 1; G: which way the body runs there; B: how thick the body is there). Its points sit
   on the front and back of that volume (round tubes, domes), so it has body from every side; each creature's own
   shader moves them. Here: the stage, loading and sampling the drawing, the dust, the colours, the scroll, the content
   sections turning with the camera (CSS 3D, ScrollTrigger) and the settings panel. */
import { Renderer, Camera, Transform, Program, Mesh, Geometry } from 'ogl';

export const gsap = window.gsap;
export const ST = window.ScrollTrigger;
if (ST) gsap.registerPlugin(ST);
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const narrow = innerWidth < 760;
export const VIOLET = [82 / 255, 39 / 255, 1], LILAC = [177 / 255, 158 / 255, 239 / 255];
export { Program, Mesh, Geometry, Transform };

// ---------- stage ----------
export function stage({ fov = 45 } = {}) {
  const renderer = new Renderer({ dpr: Math.min(devicePixelRatio || 1, 1.5), alpha: false, antialias: false, depth: false, webgl: 2 });
  const gl = renderer.gl;
  gl.clearColor(10 / 255, 10 / 255, 10 / 255, 1);
  document.getElementById('bg').appendChild(gl.canvas);
  const camera = new Camera(gl, { fov, near: 0.05, far: 160 });
  const scene = new Transform();
  const px = () => (innerHeight * renderer.dpr) / (2 * Math.tan((fov * Math.PI) / 360)); // px per world unit at distance 1
  const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.perspective({ aspect: innerWidth / innerHeight }); };
  addEventListener('resize', resize); resize();
  return { renderer, gl, camera, scene, px, fov };
}

// ---------- the drawing ----------
const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const pixels = (img, w, h) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0, w, h);
  return cx.getImageData(0, 0, w, h).data;
};
export async function drawing(base) {
  const [f, t] = await Promise.all([load(base + '-pole.png'), load(base + '.webp')]);
  const w = f.naturalWidth, h = f.naturalHeight;
  return { F: pixels(f, w, h), T: pixels(t, w, h), w, h };
}
// N points of the drawing: pos = x, y (world, around the drawing's middle, y up), z (front / back of the body), random;
// body = s, body direction (x, y), tone; img = the point's place in the drawing (px), for creature-specific parts
export function sample(d, { N, sc, hmax, thick = 0.85 }) {
  const { F, T, w, h } = d;
  const inside = [];
  for (let i = 0; i < w * h; i++) if (F[i * 4 + 2] > 0) inside.push(i);
  const pos = new Float32Array(N * 4), body = new Float32Array(N * 4), img = new Float32Array(N * 2);
  for (let k = 0; k < N; k++) {
    const i = inside[(Math.random() * inside.length) | 0];
    const x = (i % w) + Math.random(), y = Math.floor(i / w) + Math.random();
    const s = (F[i * 4] - 1) / 254, ang = (F[i * 4 + 1] / 255) * Math.PI, th = ((F[i * 4 + 2] - 1) / 254) * hmax;
    const side = Math.random() < 0.5 ? 1 : -1, depth = Math.random() < 0.85 ? 1 : Math.random();
    pos[k * 4] = (x - w / 2) * sc; pos[k * 4 + 1] = (h / 2 - y) * sc; pos[k * 4 + 2] = side * depth * th * sc * thick; pos[k * 4 + 3] = Math.random();
    body[k * 4] = s; body[k * 4 + 1] = Math.cos(ang); body[k * 4 + 2] = -Math.sin(ang); body[k * 4 + 3] = T[i * 4] / 255;
    img[k * 2] = x; img[k * 2 + 1] = y;
  }
  return { pos, body, img, spacing: Math.sqrt((inside.length * sc * sc * 2) / N) };
}

// shared GLSL: the drawing's tone → colour (site colours or the original black and white), the far side of the body
// hidden behind the near one, round soft points
export const GLSL_TONE = /* glsl */ `
  // skin light, ink dark; site colours: ink deep violet, skin lilac → white; original: ink dark grey, skin white
  vec3 toneColor(float L, float orig, vec3 A, vec3 B) {
    float skin = smoothstep(.2, .82, L);
    vec3 brand = mix(A * 1.05, mix(B, vec3(1.), .4), skin);
    vec3 o = mix(vec3(.3), vec3(pow(L, 1.2)) * 1.05, skin);
    return mix(brand, o, orig);
  }
  float toneAlpha(float L, float orig) { float skin = smoothstep(.2, .82, L); return mix(.5 + .4 * skin, .32 + .6 * skin, orig); }
  float facingAlpha(float side, vec3 p, vec3 cam, vec3 normal) {
    float f = side * dot(normalize(cam - p), normal);
    return mix(.08, 1., smoothstep(-.15, .25, f));
  }`;
export const FRAG = /* glsl */ `#version 300 es
  precision highp float; in vec3 vC; in float vA; in float vD; uniform float uFog; out vec4 o;
  void main() { vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
    o = vec4(vC * vA * smoothstep(.25, .02, r) * exp(-max(vD - uFog, 0.) * .05), 1.); }`;

// ---------- dust: slow faint points in the water ----------
export function dust(st, { N = narrow ? 2500 : 5000, box = [16, 30, 16], center = [0, 0, 0], sink = 0 } = {}) {
  const { gl, scene, renderer } = st;
  const pos = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) for (let a = 0; a < 3; a++) pos[k * 3 + a] = center[a] + (Math.random() - 0.5) * box[a];
  const program = new Program(gl, {
    vertex: `attribute vec3 position; uniform mat4 viewMatrix, projectionMatrix; uniform float uTime, uDpr, uSize, uOrig, uSink, uLift, uBoxY, uCY, uLight; uniform vec3 uA, uB, uLamp;
      varying vec3 vC; varying float vD;
      void main(){ vec3 p = position;
        p.y = uCY + mod(p.y - uCY - uTime * uSink + uLift + uBoxY * .5, uBoxY) - uBoxY * .5; // sinking snow, wraps round
        p.y += sin(uTime * .2 + p.x) * .3; p.x += cos(uTime * .15 + p.z) * .3;
        float lit = 1. + uLight * 3. * exp(-dot(p - uLamp, p - uLamp) / 6.);
        vC = mix(mix(uA, uB, fract(position.x * 3.7)), vec3(.7) * (.6 + .5 * fract(position.z * 5.3)), uOrig) * .35 * lit;
        vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; gl_PointSize = 2.6 * uDpr * uSize * (6. / max(vD, .5)); }`,
    fragment: `precision highp float; varying vec3 vC; varying float vD;
      void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
        gl_FragColor = vec4(vC * smoothstep(.25, 0., r) * exp(-max(vD - 6., 0.) * .06), 1.); }`,
    uniforms: { uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uSize: { value: 1 }, uOrig: { value: 0 }, uSink: { value: sink }, uLift: { value: 0 },
      uBoxY: { value: box[1] }, uCY: { value: center[1] }, uLight: { value: 0 }, uLamp: { value: [0, 0, 0] }, uA: { value: VIOLET }, uB: { value: LILAC } },
    transparent: true, depthTest: false, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE);
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: pos } }), program, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
  return program;
}

// ---------- scroll: page progress (damped) and how fast the page moves (0 … 1, damped) ----------
export function scrolling({ lag = 1.2 } = {}) {
  const sc = { p: 0, v: 0, dir: 0, y: scrollY, moving: false };
  const progress = () => Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
  const toP = gsap.quickTo(sc, 'p', { duration: lag, ease: 'power3.out' });
  const toV = gsap.quickTo(sc, 'v', { duration: 0.8, ease: 'power2.out' });
  let lastY = scrollY, lastT = performance.now(), quiet = 0;
  sc.p = progress();
  addEventListener('scroll', () => {
    const now = performance.now(), dy = scrollY - lastY;
    const v = (Math.abs(dy) / Math.max(1, now - lastT)) * 1000 / innerHeight;
    if (dy) sc.dir = Math.sign(dy);
    lastY = scrollY; lastT = now; sc.y = scrollY; sc.moving = true;
    toP(progress()); toV(Math.min(1, v / 1.5));
    clearTimeout(quiet); quiet = setTimeout(() => { toV(0); sc.moving = false; }, 140);
  }, { passive: true });
  return sc;
}

// ---------- pointer: damped, -1 … 1 across the screen ----------
export function pointer() {
  const pt = { x: 0, y: 0, cx: innerWidth / 2, cy: innerHeight / 2, active: false };
  const tx = gsap.quickTo(pt, 'x', { duration: 1.2, ease: 'power3.out' }), ty = gsap.quickTo(pt, 'y', { duration: 1.2, ease: 'power3.out' });
  addEventListener('pointermove', e => {
    if (e.target.closest && e.target.closest('.lab-panel, .lab-toggle, .gm, .lab-nav')) return;
    pt.cx = e.clientX; pt.cy = e.clientY; pt.active = true;
    tx((e.clientX / innerWidth) * 2 - 1); ty((e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pt.active = false; });
  return pt;
}

// ---------- content: every section turns in, straight in the middle, turns away ----------
export function sections(angle) {
  let tls = [];
  const build = () => {
    tls.forEach(t => { t.scrollTrigger && t.scrollTrigger.kill(); t.kill(); });
    tls = [];
    if (reduce || !ST) return;
    const a = angle();
    document.querySelectorAll('.ks-panel').forEach(panel => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: panel.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
      tl.fromTo(panel, { rotateY: a, rotateX: 5, z: -220, opacity: 0.35 }, { rotateY: 0, rotateX: 0, z: 0, opacity: 1, duration: 0.7, ease: 'power2.out' })
        .to(panel, { rotateY: 0, duration: 0.6 })
        .to(panel, { rotateY: -a, rotateX: -5, z: -220, opacity: 0.35, duration: 0.7, ease: 'power2.in' });
      tls.push(tl);
    });
    ST.refresh();
  };
  build();
  return build;
}

// ---------- settings panel: sliders, colours, copy, hide ----------
export function panel(S, { onInput = () => {}, ints = [] } = {}) {
  const COL = { orig: 0 };
  document.querySelectorAll('[data-set]').forEach(inp => {
    const key = inp.dataset.set, out = inp.parentElement.querySelector('output');
    inp.value = S[key];
    const show = () => { if (out) out.textContent = Number(inp.value).toFixed(ints.includes(key) ? 0 : 2); };
    show();
    inp.addEventListener('input', () => { S[key] = Number(inp.value); show(); onInput(key); });
  });
  const modeBtns = document.querySelectorAll('[data-barvy]');
  const setMode = m => { COL.orig = m === 'puvodni' ? 1 : 0; modeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.barvy === m))); };
  modeBtns.forEach(b => b.addEventListener('click', () => setMode(b.dataset.barvy)));
  setMode('web');
  const hide = document.getElementById('panel-toggle'), show = document.querySelector('.lab-toggle');
  if (hide) hide.addEventListener('click', () => document.body.classList.add('panel-closed'));
  if (show) show.addEventListener('click', () => document.body.classList.remove('panel-closed'));
  const copy = document.getElementById('copy');
  if (copy) copy.addEventListener('click', () => {
    const txt = JSON.stringify({ ...S, barvy: COL.orig ? 'puvodni' : 'web' });
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { copy.textContent = 'Zkopírováno ✓'; }, () => { prompt('Nastavení:', txt); });
    setTimeout(() => { copy.textContent = 'Zkopírovat nastavení'; }, 1800);
  });
  return COL;
}

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
