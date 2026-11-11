/* Grafysta lab: a fantasy sea one swims down through with the scroll (the engine of "Cesta do hlubiny").
   Six stretches, each with its own water, light, landscape and life:
     Plovoucí ostrovy  – islands floating at the surface, their roots hanging into the sunlit water
     Zahrada lastur    – giant open shells with pearls, sea grass, anemones with clownfish, crabs, starfish, urchins
     Otevřená modř     – open blue, big schools, turtles, rays, sharks hunting
     Svítící útesy     – glowing crystals and branching corals, reef fish, garden eels in their burrows
     Propast           – near dark, sinking snow, anglerfish lures, dumbo octopuses, nautiluses
     Srdce hlubin      – a great being of light at the bottom of it all
   The animals are the user's references (26 species, colours kept) and our drawings, made of points in 3D, plus
   creatures built in code (crabs, starfish, urchins, clownfish). They live: schools wheel and scatter, hunters go
   for the schools, the curious come to the pointer, the rest shy away from it, garden eels hide in their burrows
   when one comes near. Two looks: realistic (the references' colours, sunlight and water) and abstract (the site's
   violet). Everything lives in "path space" (along the path s, across x, above y) and is drawn per cell round the
   camera. */
import { Renderer, Camera, Transform, Program, Mesh, Geometry, Vec3 } from 'ogl';
import { drawing, reduce, narrow, gsap, VIOLET, LILAC } from './tvor.js';

const S = { size: 1, animals: 1, schools: 1, light: 1, sway: 1 };
const VIEW = { svet: 'real' };
const L = 360;
const Q = narrow ? 0.5 : 1;

// ---------- stretches ----------
const ZONES = [
  { name: 'Plovoucí ostrovy', s: 0, water: [0.13, 0.36, 0.42], web: [0.2, 0.15, 0.4], fog: 0.028, amb: 1.08, rays: 1.5, glow: 0, bubbles: 1 },
  { name: 'Zahrada lastur', s: 62, water: [0.1, 0.28, 0.32], web: [0.15, 0.11, 0.32], fog: 0.034, amb: 0.98, rays: 1.05, glow: 0, bubbles: 0.4 },
  { name: 'Otevřená modř', s: 128, water: [0.035, 0.15, 0.3], web: [0.09, 0.07, 0.25], fog: 0.026, amb: 0.88, rays: 0.7, glow: 0, bubbles: 0.15 },
  { name: 'Svítící útesy', s: 192, water: [0.03, 0.055, 0.13], web: [0.06, 0.04, 0.15], fog: 0.042, amb: 0.55, rays: 0.2, glow: 0.6, bubbles: 0 },
  { name: 'Propast', s: 252, water: [0.005, 0.011, 0.028], web: [0.018, 0.01, 0.05], fog: 0.06, amb: 0.16, rays: 0, glow: 0.9, bubbles: 0 },
  { name: 'Srdce hlubin', s: 312, water: [0.01, 0.012, 0.035], web: [0.03, 0.012, 0.075], fog: 0.05, amb: 0.2, rays: 0, glow: 1, bubbles: 0 }
];
const zoneAt = s => { let i = 0; while (i + 1 < ZONES.length && s >= ZONES[i + 1].s) i++; return i; };
const zoneMix = s => {
  const i = zoneAt(s), z = ZONES[i], p = ZONES[Math.max(0, i - 1)];
  const t = i ? Math.min(1, Math.max(0, (s - z.s) / 14)) : 1, k = t * t * (3 - 2 * t), o = { i };
  for (const key of ['fog', 'amb', 'rays', 'glow', 'bubbles']) o[key] = p[key] + (z[key] - p[key]) * k;
  o.water = p.water.map((v, j) => v + (z.water[j] - v) * k); o.web = p.web.map((v, j) => v + (z.web[j] - v) * k);
  return o;
};
// the sea floor under the path (how far below it), per stretch, blended
const FLOORS = [-15, -4.6, -16, -4.6, -9, -5.5];
const floorY = s => {
  const i = zoneAt(s), z = ZONES[i];
  if (!i) return FLOORS[0];
  const t = Math.min(1, Math.max(0, (s - z.s + 8) / 30)), k = t * t * (3 - 2 * t);
  return FLOORS[i - 1] + (FLOORS[i] - FLOORS[i - 1]) * k;
};
// the same in the shaders (the floor slopes between the stretches instead of stepping)
const GLSL_FLOOR = `float floorY(float s) {
  float f = ${FLOORS[0].toFixed(1)};
${ZONES.slice(1).map((z, i) => `  f = mix(f, ${FLOORS[i + 1].toFixed(1)}, smoothstep(0., 1., clamp((s - ${z.s.toFixed(1)} + 8.) / 30., 0., 1.)));`).join('\n')}
  return f;
}`;

// ---------- path ----------
const path = s => [3.2 * Math.sin(s * 0.031) + 1.5 * Math.sin(s * 0.013 + 1), -0.2 * s + 1.5 * Math.sin(s * 0.02), -s];
const pathD = s => [3.2 * 0.031 * Math.cos(s * 0.031) + 1.5 * 0.013 * Math.cos(s * 0.013 + 1), -0.2 + 1.5 * 0.02 * Math.cos(s * 0.02), -1];
const GLSL_PATH = /* glsl */ `vec3 pathPos(float s) { return vec3(3.2 * sin(s * .031) + 1.5 * sin(s * .013 + 1.), -.2 * s + 1.5 * sin(s * .02), -s); }`;
const SURFACE_Y = 9.5, HEART_S = 374;

// ---------- stage ----------
const FOV = 52;
const renderer = new Renderer({ dpr: Math.min(devicePixelRatio || 1, 1.5), alpha: false, antialias: false, depth: true, webgl: 2 });
const gl = renderer.gl;
document.getElementById('bg').appendChild(gl.canvas);
const camera = new Camera(gl, { fov: FOV, near: 0.05, far: 150 });
const scene = new Transform();
const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.perspective({ aspect: innerWidth / innerHeight }); };
addEventListener('resize', resize); resize();
const PX = () => (innerHeight * renderer.dpr) / (2 * Math.tan((FOV * Math.PI) / 360));

const W = {
  uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uPx: { value: 1 }, uSize: { value: 1 }, uSway: { value: 1 },
  uWater: { value: [0, 0, 0] }, uFog: { value: 0.03 }, uAmb: { value: 1 }, uRays: { value: 1 }, uGlow: { value: 0 }, uWeb: { value: 0 },
  uLures: { value: new Array(16).fill(0) }, uHeart: { value: [0, -999, 0, 0] }, uCam: { value: [0, 0, 0] }, uA: { value: VIOLET }, uB: { value: LILAC }
};
const GLSL_LIGHT = /* glsl */ `
  uniform vec4 uLures[4]; uniform vec4 uHeart;
  float lureLight(vec3 p) {
    float l = 0.; for (int i = 0; i < 4; i++) { vec3 d = p - uLures[i].xyz; l += uLures[i].w * exp(-dot(d, d) / 5.); }
    vec3 h = p - uHeart.xyz; return l + uHeart.w * exp(-dot(h, h) / 140.);
  }
  vec3 webOf(vec3 c) {
    float l = dot(c, vec3(.3, .59, .11));
    return mix(mix(uA * .22, uA * .95, smoothstep(.05, .35, l)), mix(uB, vec3(1.), .5), smoothstep(.35, .85, l));
  }
  vec3 shade(vec3 base, vec3 p, float d) {
    vec3 c = mix(base, webOf(base), uWeb);
    float ripple = .5 + .5 * sin(p.x * 2.3 + uTime * 1.1) * sin(p.z * 1.9 - uTime * .8);
    float lu = lureLight(p);
    c = c * (uAmb * (1. + .3 * uRays * ripple) + lu * 1.6) + mix(vec3(1., .95, .8), uB, uWeb) * lu * .1;
    return mix(uWater, c, exp(-d * uFog));
  }`;
const glowy = p => { p.setBlendFunc(gl.ONE, gl.ONE); return p; };

// ---------- deterministic randomness for the templates ----------
let seed = 7;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const R = (a, b) => a + rnd() * (b - a);
const pick = a => a[(rnd() * a.length) | 0];
const RR = (a, b) => a + Math.random() * (b - a);

// ---------- landscape templates (points in path space, drawn per cell) ----------
// position: ds along the cell, x across, y above the path, random · aColor · aK: a template's own two values ·
// iCell: the cell's start, mirror, seed, floor height
const MAXC = 9;
const envProgram = (sway, { glow = false, size = 1.25 } = {}) => new Program(gl, {
  vertex: /* glsl */ `#version 300 es
    in vec4 position; in vec3 aColor; in vec2 aK; in vec4 iCell;
    uniform mat4 viewMatrix, projectionMatrix; uniform vec3 uWater, uA, uB;
    uniform float uTime, uDpr, uPx, uSize, uSway, uFog, uAmb, uRays, uGlow, uWeb, uFoot;
    out vec3 vC;
    ${GLSL_PATH}
    ${GLSL_FLOOR}
    ${GLSL_LIGHT}
    void main() {
      float ds = position.x, x = position.y, y = position.z, r = position.w, k = aK.x, ph = aK.y + iCell.z * 6.28;
      ${sway}
      x *= iCell.y; y += iCell.w > .5 ? floorY(iCell.x + ds) : 0.;
      vec3 p = pathPos(iCell.x + ds) + vec3(x, y, 0.);
      vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z;
      gl_Position = projectionMatrix * mv;
      ${glow ? `vec3 c = mix(aColor, webOf(aColor) * 1.3, uWeb);
      vC = c * (.55 + .45 * sin(uTime * (1. + r * 2.) + r * 40.)) * max(uGlow, .35) * exp(-d * uFog * .55);`
             : `vC = shade(aColor, p, d);`}
      gl_PointSize = clamp(${size.toFixed(2)} * uSize * uFoot * uPx / max(d, .1), 1., ${glow ? '6.' : '12.'} * uDpr);
    }`,
  fragment: /* glsl */ `#version 300 es
    precision highp float; in vec3 vC; out vec4 o;
    void main() { vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; o = vec4(vC${glow ? ' * smoothstep(.25, .0, r)' : ''}, 1.); }`,
  uniforms: { ...W, uFoot: { value: 0.05 } },
  ...(glow ? { transparent: true, depthTest: true, depthWrite: false } : { depthTest: true, depthWrite: true })
});
const templates = [];
const addTemplate = (name, pts, { cell, foot, sway = '', glow = false, size, cells, floor = true }) => {
  const n = pts.length / 9, pos = new Float32Array(n * 4), color = new Float32Array(n * 3), k = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { pos.set(pts.slice(i * 9, i * 9 + 4), i * 4); color.set(pts.slice(i * 9 + 4, i * 9 + 7), i * 3); k.set(pts.slice(i * 9 + 7, i * 9 + 9), i * 2); }
  const program = envProgram(sway, { glow, size });
  if (glow) glowy(program);
  program.uniforms.uFoot.value = foot;
  const iCell = { instanced: 1, size: 4, data: new Float32Array(MAXC * 4) };
  const mesh = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: pos }, aColor: { size: 3, data: color }, aK: { size: 2, data: k }, iCell }), program, mode: gl.POINTS, frustumCulled: false });
  mesh.setParent(scene);
  templates.push({ name, mesh, iCell, cell, cells, floor });
};
// a point: ds, x, y, colour, k1, k2
const P = (out, ds, x, y, c, k1 = 0, k2 = 0) => out.push(ds, x, y, Math.random(), c[0], c[1], c[2], k1, k2);
const shadeC = (c, t) => [c[0] * t, c[1] * t, c[2] * t];
const N = n => Math.round(n * Q);

// sand with ripples, pebbles and shell bits
{
  const o = [];
  for (let i = 0; i < N(34000); i++) {
    const x = R(-34, 34), ds = R(0, 20);
    if (rnd() > 1 - Math.max(0, Math.min(1, (Math.abs(x) - 14) / 20)) ** 1.5) continue; // thins out towards the sides: no edge
    const y = 0.3 * Math.sin(x * 0.7 + ds * 0.5) + 0.12 * Math.sin(x * 3.1 - ds * 2.3);
    const r = rnd(), t = R(0.78, 1.08);
    P(o, ds, x, y, r < 0.05 ? shadeC([0.35, 0.33, 0.3], t) : r < 0.08 ? shadeC([0.85, 0.75, 0.7], t) : shadeC([0.76, 0.68, 0.5], t));
  }
  addTemplate('sand', o, { cell: 20, foot: 0.13, cells: () => true });
}
// sea grass: tufts of blades bending in the current
{
  const o = [];
  for (let tf = 0; tf < N(240); tf++) {
    const x0 = (rnd() < 0.5 ? -1 : 1) * R(1.6, 15), ds0 = R(0, 20), ph = R(0, 6.28), g = pick([[0.25, 0.55, 0.2], [0.35, 0.6, 0.18], [0.2, 0.45, 0.3]]);
    for (let b = 0; b < 7; b++) {
      const h = R(0.5, 1.6), lean = R(-0.3, 0.3);
      for (let j = 0; j < 12; j++) { const t = j / 11; P(o, ds0 + lean * t * h * 0.4, x0 + lean * t * h, t * h, shadeC(g, 0.7 + 0.5 * t), t * h, ph + b); }
    }
  }
  addTemplate('trava', o, { cell: 20, foot: 0.05, size: 1.6, sway: `x += uSway * k * k * .35 * sin(uTime * 1.1 + ph + k);`, cells: s => (s > 58 && s < 135) || (s > 300) });
}
// floating islands with hanging roots (the roots sway)
{
  const o = [];
  for (const [ix, iy, ids, ir] of [[-7.5, 6.6, 8, 4.2], [8.5, 7.6, 23, 3.3], [-3.5, 8.4, 30, 2.4]]) {
    for (let i = 0; i < N(9000) * (ir / 4); i++) {
      const u = R(-1, 1), a = R(0, Math.PI * 2), rr = Math.sqrt(1 - u * u);
      let nx = rr * Math.cos(a), ny = u, nz = rr * Math.sin(a);
      if (ny > 0.25) ny = 0.25 + (ny - 0.25) * 0.25; // a flat top
      const bump = 1 + 0.15 * Math.sin(nx * 6 + nz * 4) + 0.12 * Math.sin(ny * 9) + R(-0.05, 0.05);
      const top = u > 0.25, t = R(0.75, 1.05);
      P(o, ids + nz * ir * bump, ix + nx * ir * bump, iy + ny * ir * bump * (u < 0 ? 1.1 : 1), top ? shadeC(pick([[0.3, 0.6, 0.2], [0.42, 0.66, 0.25]]), t) : shadeC([0.42, 0.36, 0.28], t));
    }
    for (let r = 0; r < N(70); r++) {
      const a = R(0, Math.PI * 2), rr = R(0, ir * 0.85), len = R(2, 8), ph = R(0, 6.28), leafy = rnd() < 0.5;
      const bx = ix + Math.cos(a) * rr, bds = ids + Math.sin(a) * rr, by = iy - ir * 0.75 * Math.sqrt(1 - (rr / ir) ** 2);
      for (let j = 0; j < 40; j++) {
        const t = j / 39;
        P(o, bds, bx, by - t * len, leafy && rnd() < 0.3 ? [0.3, 0.55, 0.22] : shadeC([0.32, 0.28, 0.2], 0.8 + 0.3 * t), t * len, ph);
      }
    }
  }
  addTemplate('ostrovy', o, { cell: 36, foot: 0.06, sway: `x += uSway * k * k * .012 * sin(uTime * .6 + ph); ds += uSway * k * k * .01 * cos(uTime * .5 + ph);
      float ss = iCell.x + ds; y += .2 * ss - 1.5 * sin(ss * .02); // (heights are absolute: the islands float at the surface)`, cells: s => s < 78, floor: false });
}
// giant open shells with pearls
{
  const o = [];
  for (const [sx, sds, size, open] of [[-6.5, 7, 4.2, 0.65], [7, 21, 3.4, 0.45]]) {
    const pink = [0.92, 0.72, 0.68], cream = [0.95, 0.88, 0.78];
    for (const top of [0, 1]) {
      for (let i = 0; i < N(9000) * (size / 4); i++) {
        const a = R(0.08, Math.PI - 0.08), rr = Math.sqrt(rnd()) * size;
        const ridge = 0.5 + 0.5 * Math.cos(a * 22), dome = 0.35 * size * (1 - (rr / size) ** 2) * 0.45 + ridge * 0.05 * size * (rr / size);
        let lx = Math.cos(a) * rr, ld = -Math.sin(a) * rr * 0.85, ly = dome * (top ? 1 : -1) * 0.6;
        if (top) { const c = Math.cos(open), sn = Math.sin(open), yy = ld * -sn + ly * c, dd = ld * c + ly * sn; ld = dd; ly = yy; }
        const inside = (top ? ly < 0.05 : true) && rnd() < 0.35, t = 0.8 + 0.25 * ridge;
        const col = inside ? [0.85 + 0.1 * Math.sin(a * 5), 0.75 + 0.15 * Math.cos(a * 3), 0.9] : shadeC(rnd() < 0.5 ? pink : cream, t);
        P(o, sds + ld + size * 0.5, sx + lx, ly + size * 0.25 + 0.2, col);
      }
    }
    for (let i = 0; i < N(1600); i++) { // the pearl
      const u = R(-1, 1), a = R(0, Math.PI * 2), rr = Math.sqrt(1 - u * u), pr = size * 0.13;
      P(o, sds + size * 0.35 + rr * Math.sin(a) * pr, sx + rr * Math.cos(a) * pr, size * 0.25 + 0.35 + pr + u * pr, [1, 0.97, 0.98]);
    }
  }
  addTemplate('lastury', o, { cell: 30, foot: 0.06, cells: s => s > 64 && s < 128 });
}
// anemones (and their positions, for the clownfish)
const ANEM = [];
{
  const o = [];
  for (let n = 0; n < 7; n++) {
    const ax = (n % 2 ? -1 : 1) * R(2, 9), ads = R(1, 19), col = pick([[0.95, 0.35, 0.65], [1, 0.55, 0.25], [0.6, 0.9, 0.35], [0.7, 0.45, 1], [0.95, 0.85, 0.4]]), sz = R(0.5, 0.9);
    ANEM.push([ads, ax, sz]);
    for (let i = 0; i < N(900); i++) { const a = R(0, 6.28), rr = Math.sqrt(rnd()) * sz * 0.6; P(o, ads + Math.sin(a) * rr, ax + Math.cos(a) * rr, R(0, 0.35), shadeC(col, 0.55)); }
    for (let tt = 0; tt < N(110); tt++) {
      const a = R(0, 6.28), rr = Math.sqrt(rnd()) * sz * 0.55, len = R(0.5, 1.2) * sz * 1.4, ph = R(0, 6.28), out = R(0.3, 0.9);
      for (let j = 0; j < 14; j++) {
        const t = j / 13;
        P(o, ads + Math.sin(a) * (rr + out * t * len * 0.6), ax + Math.cos(a) * (rr + out * t * len * 0.6), 0.35 + t * len * 0.85, shadeC(col, 0.75 + 0.45 * t), t * len, ph);
      }
    }
  }
  addTemplate('sasanky', o, { cell: 20, foot: 0.045, size: 1.5, sway: `x += uSway * k * .3 * sin(uTime * 1.3 + ph + k * 3.); ds += uSway * k * .25 * cos(uTime * 1.1 + ph);`, cells: s => (s > 62 && s < 128) || (s > 192 && s < 252) });
}
// clownfish: orange with white bands, darting round their anemones
{
  const o = [];
  ANEM.forEach(([ads, ax, sz], ai) => {
    for (let f = 0; f < 2; f++) {
      const ph = R(0, 6.28), rad = R(0.45, 0.9) * (sz + 0.4), ht = R(0.6, 1.3), L0 = 0.32;
      for (let i = 0; i < N(500); i++) {
        const u = R(-1, 1), a = R(0, 6.28), t = (u + 1) / 2, prof = Math.sqrt(1 - u * u) * (0.42 - 0.12 * u);
        const bx = u * L0 * 0.5, by = Math.cos(a) * prof * L0 * 0.55, bz = Math.sin(a) * prof * L0 * 0.25;
        const band = Math.abs(t - 0.22) < 0.05 || Math.abs(t - 0.52) < 0.05 || Math.abs(t - 0.86) < 0.04;
        const edge = Math.abs(t - 0.22) < 0.07 || Math.abs(t - 0.52) < 0.07;
        // packed: ds and x hold the body (along, across), y the height; the orbit is in the shader
        o.push(bx, bz, by, Math.random(), ...(band ? [1, 1, 1] : edge ? [0.1, 0.08, 0.06] : [1, 0.45, 0.08]), ai * 16 + f * 8 + ht, Math.round(rad * 100) * 10 + ph);
      }
    }
  });
  addTemplate('klauni', o, { cell: 20, foot: 0.02, size: 2.2, cells: s => (s > 62 && s < 128) || (s > 192 && s < 252), sway: `
      float ai = floor(k / 16.), ht = mod(k, 8.), rad = floor(aK.y / 10.) / 100., ph0 = mod(aK.y, 10.);
      vec3 an = vec3(0.);
      ${ANEM.map(([d, x], i) => `if (ai == ${i}.) an = vec3(${d.toFixed(2)}, ${x.toFixed(2)}, 0.);`).join(' ')}
      float a = uTime * (1.2 + .3 * sin(ph0)) + ph0;
      vec2 dir = vec2(-sin(a), cos(a));
      float bx = ds, bz = x;
      ds = an.x + cos(a) * rad + dir.x * bx - dir.y * bz;
      x = an.y + sin(a) * rad + dir.y * bx + dir.x * bz;
      y += ht + .15 * sin(uTime * 2. + ph0);`
  });
}
// bottom life: crabs scuttling sideways, starfish, sea urchins
{
  const o = [];
  for (let n = 0; n < 14; n++) {
    const role = n % 3, cx = (n % 2 ? -1 : 1) * R(1.8, 12), cds = R(0, 20), ph = R(0, 6.28);
    if (role === 0) { // crab
      const c = pick([[0.85, 0.3, 0.15], [0.9, 0.5, 0.2]]), sz = R(0.25, 0.45);
      for (let i = 0; i < N(500); i++) { const a = R(0, 6.28), rr = Math.sqrt(rnd()); P(o, cds + Math.sin(a) * rr * sz * 0.7, cx + Math.cos(a) * rr * sz, sz * 0.25 * (1 - rr * rr) + 0.08, shadeC(c, R(0.8, 1.1)), 0.2, ph); }
      for (let l = 0; l < 8; l++) { const sd = l < 4 ? -1 : 1, off = (l % 4) / 3 - 0.5; for (let j = 0; j < 30; j++) { const t = j / 29; P(o, cds + off * sz * 0.9 + sd * t * 0.05, cx + sd * (sz + t * sz * 0.7), 0.1 + Math.sin(t * Math.PI) * sz * 0.35, shadeC(c, 0.8), 0.6 + t * 0.3, ph); } }
      for (const sd of [-1, 1]) for (let i = 0; i < N(120); i++) { const a = R(0, 6.28), rr = Math.sqrt(rnd()) * sz * 0.3; P(o, cds - sz * 0.9 + Math.sin(a) * rr, cx + sd * sz * 0.55 + Math.cos(a) * rr, 0.25, shadeC(c, 1.1), 0.2, ph); }
    } else if (role === 1) { // starfish
      const c = pick([[0.95, 0.45, 0.2], [0.85, 0.25, 0.4], [0.95, 0.75, 0.3]]), sz = R(0.3, 0.55);
      for (let i = 0; i < N(700); i++) { const arm = (i % 5) * 1.2566, t = Math.sqrt(rnd()), w = (1 - t) * 0.28 * sz * R(-1, 1), a = arm + ph; P(o, cds + Math.sin(a) * t * sz + Math.cos(a) * w, cx + Math.cos(a) * t * sz - Math.sin(a) * w, 0.05 + 0.06 * (1 - t), shadeC(c, R(0.75, 1.1)), 1.2, ph); }
    } else { // urchin
      const c = pick([[0.35, 0.15, 0.45], [0.12, 0.1, 0.14]]), sz = R(0.2, 0.35);
      for (let sp = 0; sp < N(90); sp++) { const u = R(-0.3, 1), a = R(0, 6.28), rr = Math.sqrt(1 - u * u); for (let j = 0; j < 9; j++) { const t = j / 8, l = sz * (0.6 + t * 1.3); P(o, cds + rr * Math.sin(a) * l, cx + rr * Math.cos(a) * l, sz * 0.6 + u * l, shadeC(c, 0.8 + 0.5 * t), 2.2 + t * 0.5, ph + sp); } }
    }
  }
  addTemplate('dno', o, { cell: 20, foot: 0.02, size: 2.4, cells: s => (s > 62 && s < 128) || (s > 192 && s < 252) || s > 312, sway: `
      float role = floor(k), lk = fract(k);
      if (role == 0.) { float w = sin(uTime * .45 + ph) * 1.4; x += w; y += lk > .55 ? .03 * abs(sin(uTime * 9. + lk * 30. + ph)) : 0.; }
      if (role == 1.) { y += .02 * sin(uTime * .5 + ph); }
      if (role == 2.) { ds += lk * .03 * sin(uTime * 2. + ph); x += lk * .03 * cos(uTime * 1.7 + ph); }`
  });
}
// the glowing reef: branching corals (lit tips) and crystal clusters (light)
{
  const o = [];
  const branch = (ds, x, y, dir, len, depth, col) => {
    for (let j = 0; j < 26; j++) { const t = j / 25; P(o, ds + dir[2] * t * len + R(-0.03, 0.03), x + dir[0] * t * len + R(-0.03, 0.03), y + dir[1] * t * len, shadeC(col, depth ? 0.75 : 1.4)); }
    if (!depth) return;
    const ex = [ds + dir[2] * len, x + dir[0] * len, y + dir[1] * len];
    for (let b = 0; b < 3; b++) { const nd = [dir[0] + R(-0.7, 0.7), dir[1] * 0.8 + 0.3, dir[2] + R(-0.7, 0.7)], l = Math.hypot(...nd); branch(ex[0], ex[1], ex[2], nd.map(v => v / l), len * 0.72, depth - 1, col); }
  };
  for (let c = 0; c < 7; c++) branch(R(0, 20), (c % 2 ? -1 : 1) * R(2, 11), 0, [0, 1, 0], R(0.6, 1.2), 3, pick([[1, 0.45, 0.35], [0.95, 0.35, 0.75], [0.6, 0.4, 1], [1, 0.7, 0.3]]));
  addTemplate('korály', o, { cell: 20, foot: 0.04, size: 1.6, cells: s => s > 190 && s < 256 });
  const g = [];
  for (let cl = 0; cl < 6; cl++) {
    const cx = (cl % 2 ? -1 : 1) * R(2.5, 11), cds = R(0, 20), col = pick([[0.3, 0.95, 1], [0.7, 0.5, 1], [0.4, 1, 0.8], [1, 0.5, 0.9]]);
    for (let pr = 0; pr < 6; pr++) {
      const h = R(1, 4.2), rad = R(0.15, 0.4), tx = R(-0.5, 0.5), tz = R(-0.5, 0.5), bx = cx + R(-0.8, 0.8), bd = cds + R(-0.8, 0.8);
      for (let i = 0; i < N(500); i++) {
        const t = rnd(), a = Math.floor(rnd() * 6) * 1.0472 + (rnd() < 0.6 ? 0 : R(0, 1.0472)), r = rad * (1 - 0.3 * t) * (t > 0.9 ? (1 - t) * 10 : 1);
        P(g, bd + Math.sin(a) * r + tz * t * h, bx + Math.cos(a) * r + tx * t * h, t * h, shadeC(col, 0.5 + 0.7 * t));
      }
    }
  }
  addTemplate('krystaly', g, { cell: 20, foot: 0.05, glow: true, size: 1.8, cells: s => s > 195 && s < 320 });
}
// glowing plankton in the dark
{
  const o = [];
  for (let i = 0; i < N(4200); i++) P(o, R(0, 20), R(-12, 12), R(-6, 12), pick([[0.3, 0.95, 0.9], [0.45, 0.8, 1], [0.75, 0.6, 1], [1, 0.6, 0.9]]));
  addTemplate('plankton', o, { cell: 20, foot: 0.05, glow: true, size: 2.4, floor: false, sway: `x += .25 * sin(uTime * .3 + r * 30.); y += .25 * sin(uTime * .25 + r * 50.);`, cells: s => s > 220 });
}

// ---------- the surface, light shafts, snow, bubbles, the heart of the deep ----------
{
  const n = N(26000), d = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) d.set([RR(-45, 45), SURFACE_Y, RR(-20, 115), Math.random()], i * 4);
  const p = glowy(new Program(gl, {
    vertex: `attribute vec4 position; uniform mat4 viewMatrix, projectionMatrix; uniform float uTime, uDpr, uSize, uWeb; uniform vec3 uB; varying vec3 vC;
      float wave(vec2 p, float t){ return sin(p.x * .9 + t) * sin(p.y * .7 - t * .8) + sin((p.x + p.y) * 1.3 + t * 1.3) * .5; }
      void main(){ vec3 p = vec3(position.x, position.y, -position.z); float w = wave(p.xz, uTime * .9); p.y += w * .25;
        float c = pow(max(0., 1. - abs(w) * 1.4), 4.); vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z; gl_Position = projectionMatrix * mv;
        vC = mix(vec3(.8, 1., .95), mix(uB, vec3(1.), .5), uWeb) * (.1 + .55 * c) * exp(-d * .028); gl_PointSize = 3. * uDpr * uSize * (6. / max(d, .5)); }`,
    fragment: `precision highp float; varying vec3 vC; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; gl_FragColor = vec4(vC * smoothstep(.25, 0., r), 1.); }`,
    uniforms: W, transparent: true, depthTest: true, depthWrite: false
  }));
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: d } }), program: p, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
}
{
  const sh = [];
  for (let i = 0; i < 14; i++) { const x = RR(-13, 13), z = RR(0, 40), w = RR(0.8, 2.8); for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) sh.push(x, z, w, u, v, Math.random()); }
  const n = sh.length / 6, pos = new Float32Array(n * 3), uv = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos.set(sh.slice(i * 6, i * 6 + 3), i * 3); uv.set(sh.slice(i * 6 + 3, i * 6 + 6), i * 3); }
  const p = glowy(new Program(gl, {
    vertex: `attribute vec3 position; attribute vec3 aUv; uniform mat4 viewMatrix, projectionMatrix; uniform vec3 uCam; uniform float uTime; varying vec2 vUv; varying float vD, vR;
      void main(){ vUv = aUv.xy; vR = aUv.z; float z = uCam.z - 38. + mod(position.y - uCam.z + 38., 42.);
        vec3 c = vec3(uCam.x + position.x + sin(uTime * .1 + aUv.z * 6.) * .6, uCam.y + 3., z);
        vec3 toCam = normalize(vec3(uCam.x - c.x, 0., uCam.z - c.z)); vec3 side = vec3(toCam.z, 0., -toCam.x);
        vec3 p = c + side * (aUv.x - .5) * position.z + vec3(0., (aUv.y - .5) * 20., 0.) + side * (aUv.y - .5) * 2.5;
        vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragment: `precision highp float; uniform float uRays, uTime, uWeb; uniform vec3 uB; varying vec2 vUv; varying float vD, vR;
      void main(){ float x = 1. - abs(vUv.x * 2. - 1.); float a = x * x * smoothstep(0., .9, vUv.y) * (.6 + .4 * sin(uTime * .5 + vR * 9.));
        gl_FragColor = vec4(mix(vec3(1., .98, .85), mix(uB, vec3(1.), .4), uWeb) * a * .06 * uRays * exp(-vD * .04), 1.); }`,
    uniforms: W, transparent: true, depthTest: true, depthWrite: false, cullFace: null
  }));
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: pos }, aUv: { size: 3, data: uv } }), program: p, frustumCulled: false }).setParent(scene);
}
const motes = (n, up) => {
  const d = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) d.set([RR(-12, 12), RR(-6, 8), RR(0, 36), Math.random()], i * 4);
  const p = glowy(new Program(gl, {
    vertex: `attribute vec4 position; uniform mat4 viewMatrix, projectionMatrix; uniform vec3 uCam, uB; uniform float uTime, uDpr, uSize, uWeb, uAmb, uGlow, uK;
      varying vec3 vC; varying float vA;
      void main(){ vec3 p = position.xyz; p.z = uCam.z - 34. + mod(p.z - uCam.z + 34., 36.); p.x += uCam.x;
        p.y = uCam.y - 6. + mod(p.y ${up ? '+' : '-'} uTime * ${up ? '.9' : '.08'} * (.5 + position.w) + 6., 14.); p.x += sin(uTime * ${up ? '2.' : '.3'} + position.w * 20.) * ${up ? '.05' : '.2'};
        vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z; gl_Position = projectionMatrix * mv;
        vC = ${up ? 'vec3(.8, .95, 1.) * .5' : 'mix(vec3(.85, .9, .8), uB, uWeb) * .45 * (.5 + position.w) * (uAmb + .5 * uGlow)'} * uK; vA = exp(-d * .1);
        gl_PointSize = ${up ? '3.' : '2.2'} * uDpr * uSize * (4. / max(d, .4)); }`,
    fragment: `precision highp float; varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; gl_FragColor = vec4(vC * vA * smoothstep(.25, 0., r) * ${up ? '1.6' : '1.'}, 1.); }`,
    uniforms: { ...W, uK: { value: 1 } }, transparent: true, depthTest: true, depthWrite: false
  }));
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: d } }), program: p, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
  return p;
};
motes(N(5000), false);
const bubbles = motes(N(1500), true);
// the heart of the deep: a great being of light, its core breathing, arms of light winding round it
const HU = { uTime: W.uTime, uDpr: W.uDpr, uPx: W.uPx, uWeb: W.uWeb, uA: W.uA, uB: W.uB, uPos: { value: [0, -999, 0] }, uOn: { value: 0 } };
{
  const pts = [];
  for (let i = 0; i < N(9000); i++) { const u = RR(-1, 1), a = RR(0, 6.28), rr = Math.pow(Math.random(), 0.6) * 3; pts.push(Math.sqrt(1 - u * u) * Math.cos(a) * rr, u * rr, Math.sqrt(1 - u * u) * Math.sin(a) * rr, 0); }
  for (let arm = 0; arm < 14; arm++) for (let i = 0; i < N(1300); i++) { const t = Math.random(); pts.push(arm, t, RR(-1, 1), 1); }
  for (let i = 0; i < N(4000); i++) { const a = RR(0, 6.28), rr = RR(5, 13); pts.push(Math.cos(a) * rr, RR(-2, 2), Math.sin(a) * rr, 2); }
  const p = glowy(new Program(gl, {
    vertex: `attribute vec4 position; uniform mat4 viewMatrix, projectionMatrix; uniform vec3 uPos, uA, uB; uniform float uTime, uDpr, uPx, uWeb, uOn; varying vec3 vC;
      void main(){ vec3 p; vec3 c; float sz;
        if (position.w < .5) { float br = 1. + .12 * sin(uTime * 1.3); p = position.xyz * br; float rr = length(position.xyz) / 3.; c = mix(vec3(1., .97, .85), vec3(.4, .9, 1.), rr); sz = 3.; }
        else if (position.w < 1.5) { float t = position.y, arm = position.x, a = arm * .4488 + t * 5. + uTime * .25 * (mod(arm, 2.) * 2. - 1.);
          float rr = 2.5 + t * 11.; p = vec3(cos(a) * rr, -t * 7. + sin(t * 8. + uTime + arm) * 1.2 + position.z * .3, sin(a) * rr);
          c = mix(vec3(.5, .95, 1.), vec3(.85, .5, 1.), t); sz = 2.4 * (1. - t * .6); }
        else { float a = atan(position.z, position.x) + uTime * .05, rr = length(position.xz); p = vec3(cos(a) * rr, position.y + sin(uTime * .4 + rr) * .5, sin(a) * rr); c = vec3(.6, .85, 1.); sz = 1.6; }
        c = mix(c, mix(uB, vec3(1.), .4), uWeb);
        vec4 mv = viewMatrix * vec4(uPos + p, 1.); float d = -mv.z; gl_Position = projectionMatrix * mv;
        vC = c * uOn * .5 * exp(-d * .02); gl_PointSize = sz * uDpr * uPx * .02 / max(d, .3); }`,
    fragment: `precision highp float; varying vec3 vC; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; gl_FragColor = vec4(vC * smoothstep(.25, 0., r), 1.); }`,
    uniforms: HU, transparent: true, depthTest: true, depthWrite: false
  }));
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: new Float32Array(pts) } }), program: p, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
}

// ---------- the animals ----------
// lay: how the picture sees it ("side", "top" from above, "front" from the front, "upright" standing up);
// head: where the head points in the picture (y up); size: its length in the water (world units)
const REF = '/lab/more/tvori/';
const KINDS = {
  // the user's references
  zelva: { base: REF + 'zelva', hmax: 0, lay: 'top', head: [-1, 0.9], move: 'flap', size: [1.6, 2.2], n: 9000, life: 'cruise', hab: 'high', v: 0.55, turn: 0.3, curious: true },
  konik: { base: REF + 'konik', lay: 'upright', head: [-1, 0], move: 'sway', size: [0.4, 0.55], n: 2500, life: 'hover', hab: 'grass', v: 0.08, turn: 0.4 },
  chobotnice2: { base: REF + 'chobotnice2', lay: 'front', head: [0, 1], move: 'arms', size: [0.8, 1.1], n: 7000, life: 'octo', hab: 'floor', v: 0.15, turn: 0.6 },
  rejnok: { base: REF + 'rejnok', lay: 'top', head: [1, 0.69], move: 'flap', size: [2, 2.8], n: 9000, life: 'cruise', hab: 'mid', v: 0.5, turn: 0.28 },
  sepie: { base: REF + 'sepie', lay: 'side', head: [1, 0], move: 'trail', size: [0.7, 1], n: 5000, life: 'cruise', hab: 'low', v: 0.18, turn: 0.5 },
  murena: { base: REF + 'murena', lay: 'upright', head: [0, 1], move: 'sway', size: [0.8, 1], n: 3000, life: 'eel', hab: 'floor' },
  chobotnice3: { base: REF + 'chobotnice3', lay: 'front', head: [0, 1], move: 'arms', size: [1.1, 1.5], n: 8000, life: 'octo', hab: 'floor', v: 0.15, turn: 0.6 },
  loditka: { base: REF + 'loditka', lay: 'side', head: [1, 0.6], move: 'trail', size: [0.6, 0.8], n: 4500, life: 'cruise', hab: 'mid', v: 0.15, turn: 0.4 },
  dumbo: { base: REF + 'dumbo', lay: 'front', head: [0, 1], move: 'arms', size: [0.7, 0.9], n: 5000, life: 'drift', hab: 'mid', v: 0.12, turn: 0.3 },
  cuverzub: { base: REF + 'cuverzub', lay: 'side', head: [1, 0], move: 'tail', size: [0.6, 0.8], n: 4500, life: 'cruise', hab: 'mid', v: 0.25, turn: 0.6, curious: true },
  meduza2: { base: REF + 'meduza2', lay: 'front', head: [0, 1], move: 'pulse', size: [0.6, 1.2], n: 5500, life: 'jelly', hab: 'any', glow: 1 },
  trnucha: { base: REF + 'trnucha', lay: 'top', head: [0.6, -1], move: 'flap', size: [1, 1.4], n: 5500, life: 'cruise', hab: 'floor', v: 0.25, turn: 0.4 },
  axolotl: { base: REF + 'axolotl', lay: 'top', head: [0.4, 1], move: 'tailTop', size: [0.5, 0.7], n: 3500, life: 'cruise', hab: 'floor', v: 0.1, turn: 0.6 },
  axolotl2: { base: REF + 'axolotl2', lay: 'top', head: [-0.7, -0.7], move: 'tailTop', size: [0.5, 0.7], n: 3500, life: 'cruise', hab: 'floor', v: 0.1, turn: 0.6 },
  neonka: { base: REF + 'neonka', lay: 'side', head: [-1, 0], move: 'tail', size: [0.2, 0.27], n: 650, life: 'school' },
  cichlida: { base: REF + 'cichlida', lay: 'side', head: [-1, 0], move: 'tail', size: [0.45, 0.6], n: 3000, life: 'cruise', hab: 'low', v: 0.3, turn: 0.8 },
  pomec: { base: REF + 'pomec', lay: 'side', head: [1, 0], move: 'tail', size: [0.6, 0.8], n: 3500, life: 'cruise', hab: 'low', v: 0.3, turn: 0.6 },
  bodlok: { base: REF + 'bodlok', lay: 'side', head: [1, 0], move: 'tail', size: [0.45, 0.6], n: 1500, life: 'school' },
  cichavec: { base: REF + 'cichavec', lay: 'side', head: [-1, 0], move: 'tail', size: [0.45, 0.6], n: 3000, life: 'cruise', hab: 'low', v: 0.25, turn: 0.7 },
  tetra: { base: REF + 'tetra', lay: 'side', head: [-1, 0], move: 'tail', size: [0.2, 0.28], n: 650, life: 'school' },
  kanic: { base: REF + 'kanic', lay: 'side', head: [-1, 0], move: 'tail', size: [1, 1.4], n: 5500, life: 'cruise', hab: 'low', v: 0.4, turn: 0.5, hunter: true },
  pomec2: { base: REF + 'pomec2', lay: 'side', head: [1, 0], move: 'tail', size: [0.6, 0.8], n: 3500, life: 'cruise', hab: 'low', v: 0.3, turn: 0.6 },
  mesicnik: { base: REF + 'mesicnik', lay: 'side', head: [1, 0], move: 'tail', size: [0.35, 0.45], n: 1100, life: 'school' },
  bodlok2: { base: REF + 'bodlok2', lay: 'side', head: [-1, 0], move: 'tail', size: [0.5, 0.65], n: 3000, life: 'cruise', hab: 'low', v: 0.32, turn: 0.7 },
  pomec3: { base: REF + 'pomec3', lay: 'side', head: [1, 0], move: 'tail', size: [0.45, 0.6], n: 1500, life: 'school' },
  pagr: { base: REF + 'pagr', lay: 'side', head: [-1, 0], move: 'tail', size: [0.9, 1.2], n: 5000, life: 'cruise', hab: 'mid', v: 0.42, turn: 0.5, hunter: true },
  // our drawings
  zralok: { base: '/lab/tunel/zralok', lay: 'side', head: [1, 0], move: 'tail', size: [2, 2.8], n: 9000, life: 'cruise', hab: 'mid', v: 0.6, turn: 0.4, hunter: true },
  kladivoun: { base: '/lab/kladivoun/kladivoun', lay: 'top', head: [0, 1], move: 'tailTop', size: [2.6, 3.4], n: 10000, life: 'cruise', hab: 'high', v: 0.55, turn: 0.35, hunter: true },
  mantaA: { base: '/lab/manty/manta-a', lay: 'top', head: [-74.4, -112.8], c: [247.2, 210], move: 'flap', size: [3.2, 4.8], n: 10000, life: 'cruise', hab: 'high', v: 0.45, turn: 0.22 },
  das: { base: '/lab/das/das', lay: 'side', head: [1, 0], move: 'fins', size: [0.9, 1.3], n: 7000, life: 'cruise', hab: 'low', v: 0.08, turn: 0.3, lure: true }
};
const MOVES = {
  tail: `float sw = pow(s, 1.5) * sin(ph - s * 7.); z += .09 * sw; q.y += .01 * sw;`,
  trail: `float sw = pow(s, 2.) * sin(ph * .6 - s * 9.); z += .06 * sw; q.y += .03 * sw * cos(ph * .5);`,
  tailTop: `q += perp * .07 * pow(s, 1.5) * sin(ph - s * 7.); z += .02 * pow(s, 2.) * cos(ph - s * 7.);`,
  flap: `float wg = abs(q.y) / max(uLmax, .1); z += .3 * uLmax * pow(wg, 1.6) * sin(ph - wg * 1.7); q.y *= 1. - .05 * pow(wg, 2.);`,
  pulse: `float bell = 1. - smoothstep(.17, .25, s); float pz = pow(sin(ph * .5) * .5 + .5, 3.); q.x *= 1. - .14 * bell * pz; z *= 1. - .14 * bell * pz; q.y += .02 * bell * pz;
    float sn = clamp((s - .2) / .8, 0., 1.); q.x += .025 * sn * sin(ph * .6 - s * 14.); z += .04 * sn * cos(ph * .55 - s * 12. + q.x * 9.);`,
  arms: `float sn = clamp((s - .24) / .76, 0., 1.); float w = pow(sn, 1.3); q += perp * .035 * w * sin(ph * .6 - s * 17.) * (1. - .6 * iS.w); z += .06 * w * cos(ph * .55 - s * 15. + q.x * 6.) * (1. - .6 * iS.w);
    q.x *= 1. - .55 * iS.w * sn; z *= 1. - .5 * iS.w * sn;`,
  sway: `q.x += .05 * pow(s, 1.2) * sin(ph * .5 - s * 5.); z += .05 * s * cos(ph * .4 - s * 4.);`,
  fins: `float hn = clamp(abs(z) / .15, 0., 1.); z += .015 * pow(1. - hn, 2.) * smoothstep(.42, .7, s) * sin(ph * 4. + s * 14.); q.y += .008 * sin(ph);`
};
const SCHOOLERS = ['neonka', 'tetra', 'bodlok', 'mesicnik', 'pomec3'];
const AU = { uReal: { value: 1 } };
const kinds = {};
for (const [name, K] of Object.entries(KINDS)) {
  const MAX = SCHOOLERS.includes(name) ? 260 : name === 'murena' ? 40 : 16;
  const U = { ...W, ...AU, uSp: { value: 0.01 }, uLmax: { value: 0.4 }, uRot: { value: [1, 0, 0, 1] }, uC: { value: [0, 0] }, uGlowK: { value: K.glow || 0 }, uClip: { value: name === 'murena' ? 1 : 0 } };
  const program = new Program(gl, {
    vertex: /* glsl */ `#version 300 es
      in vec4 position; in vec4 aBody; in vec3 aCol; in vec3 iP; in vec3 iE1; in vec3 iE2; in vec3 iE3; in vec4 iS; // iS: size, phase, opacity, squeeze (or the burrow's height)
      uniform mat4 viewMatrix, projectionMatrix; uniform vec3 cameraPosition, uWater, uA, uB;
      uniform float uTime, uDpr, uPx, uSize, uSp, uLmax, uFog, uAmb, uGlow, uGlowK, uWeb, uRays, uClip; uniform mat2 uRot; uniform vec2 uC;
      out vec3 vC; out float vA;
      ${GLSL_LIGHT}
      float facingAlpha(float side, vec3 p, vec3 cam, vec3 n) { float f = side * dot(normalize(cam - p), n); return mix(.08, 1., smoothstep(-.15, .25, f)); }
      void main() {
        if (iS.z <= .003) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
        float r = position.w, s = aBody.x;
        vec2 q = uRot * (position.xy - uC);
        vec2 t = uRot * aBody.yz; vec2 perp = vec2(-t.y, t.x);
        float z = position.z, ph = iS.y;
        ${MOVES[K.move]}
        vec3 p = iP + (iE1 * q.x + iE2 * q.y + iE3 * z) * iS.x;
        p += .006 * iS.x * vec3(sin(uTime * 1.3 + r * 40.), sin(uTime * 1.1 + r * 60.), sin(uTime * .9 + r * 80.));
        float hidden = uClip > .5 && p.y < iS.w ? 1. : 0.; // a garden eel below its burrow's mouth
        vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z;
        gl_Position = projectionMatrix * mv;
        vec3 base = mix(webOf(aCol), aCol, 1. - uWeb);
        // lit from above (the side towards the surface brighter), by the lures and the heart
        float top = .78 + .32 * clamp(dot(normalize(iE3 * sign(position.z) + vec3(0., .5, 0.)), vec3(0., 1., 0.)), -1., 1.);
        float lu = lureLight(p);
        vec3 lit = base * (max(uAmb, .1) * top + lu * 1.8);
        vec3 glow = mix(mix(vec3(.4, .9, 1.), base * 1.3, .5), mix(uB, vec3(1.), .3), uWeb) * 1.3;
        lit = mix(lit, glow, uGlow * uGlowK);
        float wv = exp(-d * uFog);
        vC = mix(uWater, lit, max(wv, uGlow * uGlowK * .6)) * (.85 + .3 * r);
        vA = (1. - hidden) * iS.z * (.4 + .6 * wv) * smoothstep(70., 50., d) * (.82 + .18 * facingAlpha(sign(position.z), p, cameraPosition, iE3));
        gl_PointSize = clamp(1.9 * uSize * uSp * iS.x * uPx / max(d, .1), 1., 18. * uDpr);
      }`,
    fragment: /* glsl */ `#version 300 es
      precision highp float; in vec3 vC; in float vA; out vec4 o;
      void main() { vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; float a = vA * smoothstep(.25, .12, r); o = vec4(vC * a, a); }`,
    uniforms: U, transparent: true, depthTest: true, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const kind = { name, K, U, MAX, mesh: null, attrs: null, shown: 0 };
  kinds[name] = kind;
  drawing(K.base).then(d => {
    const { F, T, w, h } = d, m = Math.max(w, h);
    const inside = [];
    for (let i = 0; i < w * h; i++) if (F[i * 4 + 2] > 0) inside.push(i);
    let hmax = 0; for (const i of inside) hmax = Math.max(hmax, F[i * 4 + 2]);
    // body thickness: the field's B channel is relative; a creature's thickest half is about a fifth of its length
    const thickPx = Math.min(w, h) * 0.22;
    const n = Math.round(K.n * Q), pos = new Float32Array(n * 4), body = new Float32Array(n * 4), col = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      const i = inside[(Math.random() * inside.length) | 0], x = (i % w) + Math.random(), y = Math.floor(i / w) + Math.random();
      const s = (F[i * 4] - 1) / 254, ang = (F[i * 4 + 1] / 255) * Math.PI, th = ((F[i * 4 + 2] - 1) / 254) * thickPx;
      const side = Math.random() < 0.5 ? 1 : -1, dep = Math.random() < 0.85 ? 1 : Math.random();
      pos.set([(x - w / 2) / m, (h / 2 - y) / m, (side * dep * th * 0.75) / m, Math.random()], k * 4);
      body.set([s, Math.cos(ang), -Math.sin(ang), 0], k * 4);
      col.set([(T[i * 4] / 255) ** 1.05, (T[i * 4 + 1] / 255) ** 1.05, (T[i * 4 + 2] / 255) ** 1.05], k * 3);
    }
    const rotA = K.lay === 'front' || K.lay === 'upright' ? 0 : -Math.atan2(K.head[1], K.head[0]);
    U.uRot.value = [Math.cos(rotA), Math.sin(rotA), -Math.sin(rotA), Math.cos(rotA)];
    if (K.c) U.uC.value = [(K.c[0] - w / 2) / m, (h / 2 - K.c[1]) / m];
    let lmax = 0.1;
    for (let k = 0; k < pos.length; k += 4) { const x = pos[k] - U.uC.value[0], y = pos[k + 1] - U.uC.value[1]; lmax = Math.max(lmax, Math.abs(Math.sin(rotA) * x + Math.cos(rotA) * y)); }
    U.uLmax.value = lmax; U.uSp.value = Math.sqrt((inside.length / (m * m)) / n);
    const inst = c => ({ instanced: 1, size: c, data: new Float32Array(MAX * c) });
    kind.attrs = { iP: inst(3), iE1: inst(3), iE2: inst(3), iE3: inst(3), iS: inst(4) };
    kind.mesh = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: pos }, aBody: { size: 4, data: body }, aCol: { size: 3, data: col }, ...kind.attrs }), program, mode: gl.POINTS, frustumCulled: false });
    kind.mesh.setParent(scene);
  });
}
// lures
const lurePts = [];
for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, len = k % 2 ? 0.48 : 1; for (let i = 0; i < 40; i++) { const t = Math.random(); lurePts.push(Math.cos(a) * t * len, Math.sin(a) * t * len, 0, Math.random()); } }
for (let i = 0; i < 500; i++) { const a = Math.random() * 6.283, rr = Math.abs(Math.random() + Math.random() + Math.random() - 1.5) * 1.3; lurePts.push(Math.cos(a) * rr, Math.sin(a) * rr, 0, 2 + Math.random()); }
const lureMeshes = [0, 1, 2, 3].map(() => {
  const U = { uTime: W.uTime, uDpr: W.uDpr, uPx: W.uPx, uWeb: W.uWeb, uB: W.uB, uPos: { value: [0, -999, 0] }, uR: { value: 0.2 }, uOn: { value: 0 } };
  const p = glowy(new Program(gl, {
    vertex: `attribute vec4 position; uniform mat4 viewMatrix, projectionMatrix; uniform vec3 uPos, uB; uniform float uTime, uDpr, uPx, uR, uWeb, uOn; varying vec3 vC; varying float vA;
      void main(){ bool halo = position.w >= 2.; float a = uTime * .2; vec2 q = mat2(cos(a), sin(a), -sin(a), cos(a)) * position.xy;
        vec4 mv = viewMatrix * vec4(uPos + vec3(q * uR * (1. + .08 * sin(uTime * 2.3)), 0.), 1.); gl_Position = projectionMatrix * mv; float d = -mv.z;
        vC = mix(vec3(1., .96, .82), mix(uB, vec3(1.), .55), uWeb); vA = (halo ? .14 : 1.) * exp(-d * .03) * uOn; gl_PointSize = (halo ? 3.4 : 1.9) * uDpr * uPx * .04 * uR / max(d, .2); }`,
    fragment: `precision highp float; varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; gl_FragColor = vec4(vC * vA * smoothstep(.25, 0., r), 1.); }`,
    uniforms: U, transparent: true, depthTest: true, depthWrite: false
  }));
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: new Float32Array(lurePts) } }), program: p, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
  return U;
});

// ---------- vectors ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const UP = [0, 1, 0];
const frameOf = (lay, fwd, bank, cam, pos) => {
  if (lay === 'front') { const e2 = norm(fwd); let e3 = sub(cam, pos); e3 = norm(sub(e3, mul(e2, dot(e3, e2)))); return [cross(e2, e3), e2, e3]; }
  if (lay === 'upright') { let f = [fwd[0], 0, fwd[2]]; if (len(f) < 1e-3) f = [1, 0, 0]; const e1 = norm(f); return [e1, UP, cross(e1, UP)]; }
  const e1 = norm(fwd);
  let side = cross(UP, e1); if (len(side) < 1e-3) side = [1, 0, 0]; side = norm(side);
  const upo = cross(e1, side), c = Math.cos(bank), s = Math.sin(bank);
  if (lay === 'side') { const e2 = add(mul(upo, c), mul(side, -s)); return [e1, e2, cross(e1, e2)]; }
  const e2 = add(mul(side, c), mul(upo, s));
  return [e1, e2, cross(e1, e2)];
};
const toWorld = (s, x, y) => add(path(s), [x, y, 0]);
const dirWorld = (s, f) => { const d = pathD(s); return norm([f[0] + d[0] * f[2], f[1] + d[1] * f[2], d[2] * f[2]]); };
const worldToPath = w => { const s = -w[2], p = path(s); return [s, w[0] - p[0], w[1] - p[1]]; };

// ---------- life ----------
// who lives in which stretch (solitary animals, weights) and which schools swim there
const LIVE = [
  { zelva: 2, mantaA: 1, meduza2: 3, cuverzub: 1, pomec: 2, rejnok: 1 },
  { konik: 3, chobotnice2: 1, chobotnice3: 1, cichavec: 2, cichlida: 3, trnucha: 1, axolotl: 2, axolotl2: 1, cuverzub: 1, pomec2: 1 },
  { zelva: 1, rejnok: 2, mantaA: 2, zralok: 2, kladivoun: 1, pagr: 2 },
  { pomec: 2, pomec2: 2, bodlok2: 2, kanic: 2, sepie: 2, loditka: 2, cichlida: 2, cuverzub: 1 },
  { das: 3, dumbo: 2, loditka: 2, meduza2: 4, sepie: 1, kladivoun: 1 },
  { meduza2: 6, dumbo: 2, das: 2, loditka: 1, chobotnice3: 1 }
];
const SCHOOLS = [[['neonka', 70], ['neonka', 50]], [['tetra', 60], ['bodlok', 18]], [['neonka', 120], ['tetra', 90], ['mesicnik', 34]], [['pomec3', 16], ['neonka', 60], ['bodlok', 16]], [], []];
const EELS = [{ s: 82, x: -4.5 }, { s: 104, x: 5 }, { s: 206, x: 4.5 }, { s: 232, x: -5 }];
const habSpot = (kind, s, size) => {
  const fl = floorY(s), side = () => (Math.random() < 0.5 ? -1 : 1);
  let x, y;
  switch (KINDS[kind].hab) {
    case 'high': x = RR(-9, 9); y = RR(2, 6); break;
    case 'low': x = side() * RR(1.8, 9); y = clamp(fl + RR(0.8, 3), fl + 0.6, 3); break;
    case 'floor': x = side() * RR(1.8, 9); y = fl + size * 0.2; break;
    case 'grass': x = side() * RR(1.8, 7); y = fl + RR(0.5, 1.6); break;
    case 'any': x = side() * RR(1.6, 8); y = RR(Math.max(fl + 1, -5), 6); break;
    default: x = side() * RR(1.8, 9); y = RR(Math.max(fl + 1, -3.5), 3.5);
  }
  if (Math.hypot(x, y) < 1.8) x = Math.sign(x || 1) * 2;
  return [s, x, y];
};
const pool = Array.from({ length: 56 }, (_, i) => ({ i, alive: false }));
const spawnAgent = (a, s) => {
  const table = LIVE[zoneAt(s)], names = Object.keys(table);
  let r = Math.random() * names.reduce((t, n) => t + table[n], 0), kind = names[0];
  for (const n of names) { r -= table[n]; if (r <= 0) { kind = n; break; } }
  const K = KINDS[kind];
  a.kind = kind; a.size = RR(...K.size);
  [a.s, a.x, a.y] = habSpot(kind, s, a.size);
  a.wp = habSpot(kind, a.s + RR(-10, 14), a.size);
  a.f = norm([a.wp[1] - a.x, a.wp[2] - a.y, a.wp[0] - a.s]);
  if (K.life === 'jelly' || K.life === 'drift') a.f = norm([RR(-0.3, 0.3), 1, RR(-0.3, 0.3)]);
  if (K.life === 'octo') a.f = UP;
  a.bank = 0; a.yaw = 0; a.phase = RR(0, 6.28); a.t = RR(4, 9); a.state = K.life === 'octo' ? 'crawl' : 'swim'; a.squeeze = 0; a.boost = 0; a.push = [0, 0, 0]; a.alive = true; a.fade = 0; a.hunt = null;
};
const steer = (a, d, omega, dt) => { d = norm(d); const c = clamp(dot(a.f, d), -1, 1), ang = Math.acos(c); if (ang > 1e-4) a.f = norm(mix3(a.f, d, Math.min(1, (omega * dt) / ang))); };
const move = (a, v, dt) => { a.x += (a.f[0] * v + a.push[0]) * dt; a.y += (a.f[1] * v + a.push[1]) * dt; a.s += (a.f[2] * v + a.push[2]) * dt; a.push = mul(a.push, Math.exp(-dt * 2.5)); };

// the pointer: a ray into the water; the curious come to it, the rest shy away
const ptr = { on: false, x: 0, y: 0, o: [0, 0, 0], d: [0, 0, -1] };
const v3 = new Vec3();
const rayDist = p => { const w = sub(p, ptr.o), t = dot(w, ptr.d); if (t < 0.3) return [99, null]; const c = add(ptr.o, mul(ptr.d, t)); return [len(sub(p, c)), sub(p, c), t]; };
const shy = (worldPos, a, k = 1) => {
  if (!ptr.on) return;
  const [dist, away] = rayDist(worldPos);
  if (dist < 1.8 && away) { const f = (1.8 - dist) / 1.8; const aw = norm(away); a.push = add(a.push, [aw[0] * f * 6 * k, aw[1] * f * 6 * k, -aw[2] * f * 6 * k].map(v => v * 0.05)); }
};

const live = (a, dt, cs, schools) => {
  const K = KINDS[a.kind];
  a.t -= dt; a.fade = Math.min(1, a.fade + dt * 0.7);
  const wpos = toWorld(a.s, a.x, a.y);
  if (!K.hunter && !K.curious) shy(wpos, a);
  if (K.life === 'jelly' || K.life === 'drift') {
    a.phase += dt * (K.life === 'jelly' ? 2.3 : 1.6);
    const pz = Math.pow(Math.sin(a.phase * 0.5) * 0.5 + 0.5, 3);
    if (a.t <= 0) { a.t = RR(3, 7); a.tilt = norm([RR(-0.4, 0.4), 1, RR(-0.4, 0.4)]); }
    if (a.tilt) steer(a, a.tilt, 0.15, dt);
    move(a, (K.life === 'jelly' ? 0.05 + pz * 0.45 : 0.06 + pz * 0.3) * a.size, dt);
    if (a.y > 7) a.y = Math.max(floorY(a.s) + 1, -5);
    return;
  }
  if (K.life === 'octo') {
    a.phase += dt * 3;
    const fy = floorY(a.s) + a.size * 0.25;
    if (a.state === 'crawl') {
      const dx = a.wp[1] - a.x, ds = a.wp[0] - a.s, l = Math.hypot(dx, ds) || 1;
      a.x += (dx / l) * K.v * dt; a.s += (ds / l) * K.v * dt; a.y += (fy - a.y) * Math.min(1, dt * 2);
      a.f = norm(mix3(a.f, UP, Math.min(1, dt * 2))); a.squeeze += (0 - a.squeeze) * Math.min(1, dt * 2);
      if (l < 0.6 || a.t <= 0) { a.state = 'jet'; a.t = RR(4, 7); a.wp = [a.s + RR(-6, 8), (Math.random() < 0.5 ? -1 : 1) * RR(2, 7), RR(fy + 1.5, fy + 5)]; }
    } else {
      const cyc = (a.phase / 3.5) % 1, thrust = cyc < 0.25 ? Math.sin((cyc / 0.25) * Math.PI) : 0;
      a.squeeze += ((cyc < 0.45 ? 1 : 0.35) - a.squeeze) * Math.min(1, dt * 4);
      steer(a, [a.wp[1] - a.x, a.wp[2] - a.y, a.wp[0] - a.s], 0.8, dt);
      a.boost = a.boost * Math.exp(-dt * 1.5) + thrust * dt * 5;
      move(a, (0.15 + a.boost) * a.size, dt);
      if (a.t <= 0) { a.state = 'crawl'; a.t = RR(6, 12); a.wp = habSpot(a.kind, a.s + RR(-5, 5), a.size); }
    }
    return;
  }
  // swimmers: waypoints in their habitat; hunters go for a school, the curious for the pointer
  let v = K.v * (K.life === 'hover' ? 1 : 1);
  if (K.hunter) {
    if (!a.hunt && a.t <= 0 && Math.random() < 0.5) {
      let best = null, bd = 18;
      for (const sc of schools) if (sc.alive) { const d = Math.hypot(sc.c[0] - a.s, sc.c[1] - a.x, sc.c[2] - a.y); if (d < bd) { bd = d; best = sc; } }
      a.hunt = best; a.t = RR(5, 8);
    }
    if (a.hunt && (!a.hunt.alive || a.t <= 0)) { a.hunt = null; a.t = RR(6, 12); }
    if (a.hunt) { a.wp = a.hunt.c.slice(); v *= 1.7; }
  }
  if (K.curious && ptr.on) {
    const [, , t] = rayDist(wpos);
    const target = worldToPath(add(ptr.o, mul(ptr.d, clamp(t || 4, 3, 7))));
    if (Math.abs(target[0] - a.s) < 12) { a.wp = target; v *= 1.2; a.t = 2; }
  }
  if (a.t <= 0 || Math.hypot(a.wp[0] - a.s, a.wp[1] - a.x, a.wp[2] - a.y) < 1.2) { a.t = RR(5, 10); a.wp = habSpot(a.kind, clamp(a.s + RR(-14, 14), cs - 4, cs + 40), a.size); }
  const before = Math.atan2(a.f[0], a.f[2]);
  let want = [a.wp[1] - a.x, a.wp[2] - a.y, a.wp[0] - a.s];
  if (Math.abs(a.s - cs) < 5 && Math.hypot(a.x, a.y) < 2 && !(K.curious && ptr.on)) want = add(norm(want), [Math.sign(a.x || 1) * 1.5, Math.sign(a.y || 1) * 0.5, 0]);
  steer(a, want, K.turn, dt);
  a.f[1] = clamp(a.f[1], -0.5, 0.5); a.f = norm(a.f);
  let dyaw = Math.atan2(a.f[0], a.f[2]) - before; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
  a.yaw += (dyaw / Math.max(dt, 1e-3) - a.yaw) * Math.min(1, dt * 2);
  a.bank += (clamp(a.yaw * 1.4, -0.8, 0.8) - a.bank) * Math.min(1, dt * 1.5);
  if (K.life === 'hover') { a.y += Math.sin(a.phase * 0.3) * 0.08 * dt; v *= 0.8 + 0.4 * Math.sin(a.phase * 0.2); }
  move(a, v, dt);
  a.phase += dt * 6.283 * (K.move === 'tail' ? 1.3 : K.move === 'flap' ? 0.4 : 0.6) * (v / Math.max(K.v, 0.01));
};

// schools: a centre that wanders through the stretch; every fish keeps its place in the school (which turns
// slowly), scatters away from hunters and the pointer, and comes back
const mkSchool = () => ({ alive: false, fish: [] });
const schools = [mkSchool(), mkSchool(), mkSchool(), mkSchool(), mkSchool()];
const spawnSchool = (sc, s, kind, n) => {
  const K = KINDS[kind], size = (K.size[0] + K.size[1]) / 2;
  sc.kind = kind; sc.alive = true; sc.size = size; sc.fade = 0;
  const fl = floorY(s);
  sc.c = [s, (Math.random() < 0.5 ? -1 : 1) * RR(2.5, 7), clamp(RR(fl + 1.5, 4), fl + 1, 5)];
  sc.f = norm([RR(-1, 1), RR(-0.2, 0.2), RR(-1, 1)]); sc.t = 0; sc.wp = sc.c.slice(); sc.spin = RR(-0.3, 0.3);
  const rad = Math.cbrt(n) * size * 0.75;
  sc.fish = Array.from({ length: n }, () => {
    const u = RR(-1, 1), a = RR(0, 6.28), r = Math.cbrt(Math.random()) * rad;
    return { o: [Math.sqrt(1 - u * u) * Math.cos(a) * r * 1.4, u * r * 0.55, Math.sqrt(1 - u * u) * Math.sin(a) * r], d: [0, 0, 0], ph: RR(0, 6.28), sz: size * RR(0.85, 1.15) };
  });
};
const liveSchool = (sc, dt, cs, hunters) => {
  sc.t -= dt; sc.fade = Math.min(1, sc.fade + dt * 0.5);
  if (sc.t <= 0 || Math.hypot(sc.wp[0] - sc.c[0], sc.wp[1] - sc.c[1], sc.wp[2] - sc.c[2]) < 1.5) {
    sc.t = RR(4, 9); const fl = floorY(sc.c[0]);
    sc.wp = [clamp(sc.c[0] + RR(-10, 14), cs - 2, cs + 45), (Math.random() < 0.5 ? -1 : 1) * RR(2.5, 8), clamp(RR(fl + 1.5, 4.5), fl + 1, 5)];
  }
  let want = norm([sc.wp[1] - sc.c[1], sc.wp[2] - sc.c[2], sc.wp[0] - sc.c[0]]);
  if (Math.abs(sc.c[0] - cs) < 6 && Math.hypot(sc.c[1], sc.c[2]) < 2.5) want = add(want, [Math.sign(sc.c[1] || 1) * 1.5, 0, 0]);
  sc.f = norm(mix3(sc.f, norm(want), Math.min(1, dt * 0.9)));
  const v = 0.55 + sc.size * 0.6;
  sc.c = [sc.c[0] + sc.f[2] * v * dt, sc.c[1] + sc.f[0] * v * dt, sc.c[2] + sc.f[1] * v * dt];
  const spin = time * sc.spin, cS = Math.cos(spin), sS = Math.sin(spin);
  const threats = hunters.filter(h => Math.hypot(h[0] - sc.c[0], h[1] - sc.c[1], h[2] - sc.c[2]) < 7);
  for (const f of sc.fish) {
    const ox = f.o[0] * cS - f.o[2] * sS, oz = f.o[0] * sS + f.o[2] * cS;
    f.p = [sc.c[0] + oz + f.d[2], sc.c[1] + ox + f.d[0], sc.c[2] + f.o[1] + f.d[1] + Math.sin(time * 1.3 + f.ph) * 0.05];
    let scare = [0, 0, 0];
    for (const h of threats) { const dv = [f.p[1] - h[1], f.p[2] - h[2], f.p[0] - h[0]], dl = len(dv); if (dl < 3.2) scare = add(scare, mul(norm(dv), (3.2 - dl) * 2.2)); }
    if (ptr.on) { const wp = toWorld(f.p[0], f.p[1], f.p[2]), [dist, away] = rayDist(wp); if (dist < 1.6 && away) { const aw = norm(away); scare = add(scare, [aw[0] * (1.6 - dist) * 4, aw[1] * (1.6 - dist) * 4, -aw[2] * (1.6 - dist) * 4]); } }
    f.d = add(mul(f.d, Math.exp(-dt * 0.9)), mul(scare, dt));
    f.flee = len(scare);
    f.ph += dt * 6.283 * (1.6 + f.flee * 0.6);
  }
};

// ---------- scroll, looking, gauge, panel ----------
const cam = { s: 0 };
const toS = gsap.quickTo(cam, 's', { duration: 1.6, ease: 'power3.out' });
const pageP = () => Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
const hero = document.querySelector('.lt-hero');
const onScroll = () => {
  toS(pageP() * L);
  const c = Math.min(1, scrollY / (innerHeight * 0.6));
  if (hero) { hero.style.opacity = String(1 - c); hero.style.transform = `scale(${1 + c * 0.7})`; hero.style.filter = `blur(${(c * 8).toFixed(1)}px)`; }
};
addEventListener('scroll', onScroll, { passive: true }); onScroll();
cam.s = pageP() * L;
const look = { x: 0, y: 0 };
const tx = gsap.quickTo(look, 'x', { duration: 1.4, ease: 'power3.out' }), ty = gsap.quickTo(look, 'y', { duration: 1.4, ease: 'power3.out' });
const ui = e => e.target.closest && e.target.closest('.lab-panel, .lab-toggle, .gm, .lab-nav, a, button');
addEventListener('pointermove', e => {
  if (ui(e)) { ptr.on = false; return; }
  ptr.on = true; ptr.x = (e.clientX / innerWidth) * 2 - 1; ptr.y = 1 - (e.clientY / innerHeight) * 2;
  if (e.pointerType === 'mouse') { tx((e.clientX / innerWidth) * 2 - 1); ty((e.clientY / innerHeight) * 2 - 1); }
}, { passive: true });
addEventListener('touchend', () => { ptr.on = false; }, { passive: true });
document.documentElement.addEventListener('pointerleave', () => { ptr.on = false; });
const gaugeZone = document.getElementById('lh-zone'), gaugeDepth = document.getElementById('lh-depth'), gaugeBar = document.getElementById('lh-bar');
let lastZone = -1;
document.querySelectorAll('[data-set]').forEach(inp => {
  const key = inp.dataset.set, out = inp.parentElement.querySelector('output');
  inp.value = S[key];
  const show = () => { if (out) out.textContent = Number(inp.value).toFixed(2); };
  show();
  inp.addEventListener('input', () => { S[key] = Number(inp.value); show(); });
});
{
  const btns = document.querySelectorAll('[data-svet]');
  const set = v => { VIEW.svet = v; btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.svet === v))); };
  btns.forEach(b => b.addEventListener('click', () => set(b.dataset.svet)));
  set(VIEW.svet);
}
document.querySelectorAll('[data-skok]').forEach(b => b.addEventListener('click', () => {
  const z = ZONES[Number(b.dataset.skok)], max = document.documentElement.scrollHeight - innerHeight;
  scrollTo({ top: ((z.s + (z.s ? 6 : 0)) / L) * max, behavior: 'smooth' });
}));
document.getElementById('panel-toggle').addEventListener('click', () => document.body.classList.add('panel-closed'));
document.querySelector('.lab-toggle').addEventListener('click', () => document.body.classList.remove('panel-closed'));
const copy = document.getElementById('copy');
copy.addEventListener('click', () => {
  const txt = JSON.stringify({ ...S, ...VIEW });
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { copy.textContent = 'Zkopírováno ✓'; }, () => { prompt('Nastavení:', txt); });
  setTimeout(() => { copy.textContent = 'Zkopírovat nastavení'; }, 1800);
});

// ---------- every frame ----------
let time = 0, last = performance.now();
const col = { web: 0 };
const eels = EELS.flatMap((c, ci) => Array.from({ length: 9 }, (_, i) => ({ c: ci, s: c.s + RR(-2.5, 2.5), x: c.x + RR(-1.6, 1.6), up: 1, ph: RR(0, 6.28), size: RR(...KINDS.murena.size) })));
const tick = now => {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const go = reduce ? 0 : dt;
  time += go;
  const cs = cam.s;
  const cp = add(path(cs), [Math.sin(time * 0.4) * 0.08, Math.sin(time * 0.6) * 0.1, 0]);
  const fwd = norm(sub(path(cs + 6), cp)), right = norm(cross(fwd, UP)), upv = cross(right, fwd);
  const lookDir = norm(add(add(fwd, mul(right, Math.tan(look.x * 0.45))), mul(upv, Math.tan(-look.y * 0.3))));
  camera.position.set(...cp); camera.lookAt(add(cp, mul(lookDir, 4))); camera.updateMatrixWorld();
  // the pointer's ray
  if (ptr.on) { v3.set(ptr.x, ptr.y, 0.5); camera.unproject(v3); ptr.o = cp; ptr.d = norm(sub([v3.x, v3.y, v3.z], cp)); }

  const z = zoneMix(cs);
  col.web += ((VIEW.svet === 'abstrakt' ? 1 : 0) - col.web) * Math.min(1, dt * 3);
  const water = mix3(z.water, z.web, col.web);
  W.uWater.value = water; gl.clearColor(water[0], water[1], water[2], 1);
  W.uFog.value = z.fog; W.uAmb.value = z.amb * (0.6 + 0.4 * S.light); W.uRays.value = z.rays * S.light; W.uGlow.value = z.glow; W.uWeb.value = col.web;
  W.uTime.value = time; W.uSize.value = S.size; W.uSway.value = S.sway; W.uPx.value = PX(); W.uDpr.value = renderer.dpr; W.uCam.value = cp;
  bubbles.uniforms.uK.value = z.bubbles;
  if (z.i !== lastZone) { lastZone = z.i; if (gaugeZone) { gaugeZone.textContent = ZONES[z.i].name; gsap.fromTo(gaugeZone, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }); } }
  if (gaugeDepth) gaugeDepth.textContent = `${Math.max(0, Math.round(-cp[1] * 4 + 2))} m`;
  if (gaugeBar) gaugeBar.style.transform = `scaleY(${(cs / L).toFixed(4)})`;
  // the heart of the deep, at the end of the way
  const hp = add(path(HEART_S), [0, -1.5, 0]), hOn = clamp((cs - 300) / 40, 0, 1);
  HU.uPos.value = hp; HU.uOn.value = hOn; W.uHeart.value = [...hp, hOn * 1.2];

  // landscape cells round the camera
  for (const t of templates) {
    const d = t.iCell.data; let n = 0;
    for (let k = Math.floor((cs - 30) / t.cell); k <= Math.floor((cs + 85) / t.cell) && n < MAXC; k++) {
      const s0 = k * t.cell;
      if (s0 < -t.cell || !t.cells(s0 + t.cell / 2)) continue;
      d.set([s0, k % 2 ? -1 : 1, ((Math.sin(k * 12.9898 + t.cell) * 43758.5453) % 1 + 1) % 1, t.floor ? 1 : 0], n * 4);
      n++;
    }
    t.mesh.visible = n > 0; t.mesh.geometry.setInstancedCount(Math.max(1, n)); t.iCell.needsUpdate = true;
  }

  // life
  for (const k in kinds) kinds[k].shown = 0;
  const put = (name, pos, e, size, phase, op, w) => {
    const K = kinds[name]; if (!K.attrs || K.shown >= K.MAX) return;
    const k = K.shown++;
    K.attrs.iP.data.set(pos, k * 3); K.attrs.iE1.data.set(e[0], k * 3); K.attrs.iE2.data.set(e[1], k * 3); K.attrs.iE3.data.set(e[2], k * 3);
    K.attrs.iS.data.set([size, phase, op, w], k * 4);
  };
  const hunters = [], lures = [];
  const want = Math.round(pool.length * 0.6 * S.animals);
  for (const a of pool) {
    if (a.i >= want) { a.alive = false; continue; }
    if (!a.alive) spawnAgent(a, cs + RR(6, 45));
    else if (a.s < cs - 8) spawnAgent(a, cs + RR(30, 48));
    else if (a.s > cs + 62) spawnAgent(a, cs - RR(3, 7));
    live(a, go, cs, schools);
    const K = KINDS[a.kind];
    if (K.hunter) hunters.push([a.s, a.x, a.y]);
    const pos = toWorld(a.s, a.x, a.y), e = frameOf(K.lay, dirWorld(a.s, a.f), a.bank, cp, pos);
    const op = a.fade * clamp((a.s - cs + 8) / 4, 0, 1);
    put(a.kind, pos, e, a.size, a.phase, op, a.squeeze || 0);
    if (K.lure && lures.length < 4) lures.push([add(pos, add(mul(e[0], 0.316 * a.size), mul(e[1], 0.251 * a.size))), op, a.size]);
  }
  // schools
  const sTable = SCHOOLS[zoneAt(cs + 15)];
  schools.forEach((sc, i) => {
    const spec = sTable[i];
    if (sc.alive && (sc.c[0] < cs - 12 || sc.c[0] > cs + 70)) sc.alive = false;
    if (!sc.alive && spec && i < Math.round(sTable.length * Math.min(1, S.schools + 0.01))) spawnSchool(sc, cs + RR(18, 45), spec[0], Math.round(spec[1] * Q * S.schools));
    if (!sc.alive) return;
    liveSchool(sc, go, cs, hunters);
    const lay = KINDS[sc.kind].lay;
    for (const f of sc.fish) {
      const pos = toWorld(f.p[0], f.p[1], f.p[2]);
      const dir = dirWorld(f.p[0], norm(add([sc.f[0], sc.f[1], sc.f[2]], mul([f.d[0], f.d[1], f.d[2]], 0.15 * (f.flee || 0)))));
      put(sc.kind, pos, frameOf(lay, dir, 0, cp, pos), f.sz, f.ph, sc.fade * clamp((f.p[0] - cs + 8) / 4, 0, 1), 0);
    }
  });
  // garden eels: up out of their burrows, down when the camera or the pointer comes near
  if ((cs > 60 && cs < 130) || (cs > 185 && cs < 255)) for (const e of eels) {
    if (e.s < cs - 10 || e.s > cs + 60) continue;
    const fl = floorY(e.s), base = toWorld(e.s, e.x, fl);
    let scare = Math.abs(e.s - cs) < 5 ? 1 : 0;
    if (ptr.on) { const [dist] = rayDist(add(base, [0, 0.4, 0])); if (dist < 2.2) scare = 1; }
    e.up += ((scare ? 0 : 1) - e.up) * Math.min(1, go * (scare ? 4 : 0.6));
    e.ph += go * 2;
    const pos = add(base, [0, (e.up - 0.55) * e.size, 0]);
    put('murena', pos, frameOf('upright', [Math.cos(e.ph * 0.1 + e.c), 0, Math.sin(e.ph * 0.1 + e.c)], 0, cp, pos), e.size, e.ph, 1, base[1] + 0.02);
  }
  for (const K of Object.values(kinds)) {
    if (!K.attrs) continue;
    K.mesh.visible = K.shown > 0; K.mesh.geometry.setInstancedCount(Math.max(1, K.shown));
    for (const at of Object.values(K.attrs)) at.needsUpdate = true;
  }
  const lv = W.uLures.value;
  for (let i = 0; i < 4; i++) {
    const l = lures[i], U = lureMeshes[i];
    if (l) { lv.splice(i * 4, 4, ...l[0], l[1] * (0.9 + 0.1 * Math.sin(time * 2.1 + i)) * (0.4 + z.glow)); U.uPos.value = l[0]; U.uR.value = 0.17 * l[2]; U.uOn.value = l[1]; }
    else { lv.splice(i * 4, 4, 0, -999, 0, 0); U.uOn.value = 0; }
  }
  AU.uReal.value = 1 - col.web;
  renderer.render({ scene, camera });
};
requestAnimationFrame(tick);
