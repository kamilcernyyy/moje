/* Grafysta lab: a journey into the deep – a world one walks through with the scroll.
   The engine: the scroll moves the camera along a path that winds on and goes down (damped with GSAP); the world is
   laid out in "path space" – every thing has its place along the path (s), across it (x) and above or below it (y),
   and the path bends all of it, so the world can go on for as long as the page does. It is built in cells along
   the path: only the cells round the camera are drawn, each from a template (instanced points), so it stays light.
   Six stretches, each with its own water, light, landscape and animals, blending into one another:
     Hladina (the sunlit surface overhead, rays, bubbles, jellyfish and mantas)
     Zatopený prales (the user's forest picture in depth, a channel of open water through it)
     Kelpový les (tall kelp swaying, sharks between the stalks)
     Šero (rocks and arches over the way, hammerheads, octopuses)
     Hlubina (nearly black, glowing plankton and jellyfish, anglerfish lures as the only light)
     Dno (the floor of the deep)
   A depth gauge shows where one is; the panel jumps to any stretch and switches the colours. */
import { Renderer, Camera, Transform, Program, Mesh, Geometry } from 'ogl';
import { drawing, sample, reduce, narrow, gsap, VIOLET, LILAC, GLSL_TONE } from './tvor.js';

const S = { size: 1, animals: 1, light: 1, sway: 1 };
const VIEW = { barvy: 'puvodni' };
const L = 330; // the path's length over the whole page

// ---------- the stretches ----------
const ZONES = [
  { name: 'Hladina', s: 0, water: [0.16, 0.36, 0.4], web: [0.2, 0.16, 0.4], fog: 0.032, amb: 1.05, rays: 1.4, glow: 0, bubbles: 1 },
  { name: 'Zatopený prales', s: 48, water: [0.12, 0.2, 0.15], web: [0.11, 0.09, 0.24], fog: 0.045, amb: 0.88, rays: 0.9, glow: 0, bubbles: 0.35 },
  { name: 'Kelpový les', s: 110, water: [0.05, 0.14, 0.15], web: [0.08, 0.06, 0.2], fog: 0.05, amb: 0.72, rays: 0.6, glow: 0, bubbles: 0.15 },
  { name: 'Šero', s: 168, water: [0.035, 0.07, 0.12], web: [0.06, 0.045, 0.15], fog: 0.055, amb: 0.6, rays: 0.18, glow: 0.2, bubbles: 0 },
  { name: 'Hlubina', s: 226, water: [0.005, 0.01, 0.022], web: [0.018, 0.01, 0.05], fog: 0.075, amb: 0.14, rays: 0, glow: 1, bubbles: 0 },
  { name: 'Dno', s: 290, water: [0.008, 0.014, 0.028], web: [0.02, 0.012, 0.055], fog: 0.07, amb: 0.2, rays: 0, glow: 0.85, bubbles: 0 }
];
const zoneAt = s => { let i = 0; while (i + 1 < ZONES.length && s >= ZONES[i + 1].s) i++; return i; };
// the stretch's values at s, blended over the first 14 units of each stretch
const zoneMix = s => {
  const i = zoneAt(s), z = ZONES[i], p = ZONES[Math.max(0, i - 1)];
  const t = i ? Math.min(1, Math.max(0, (s - z.s) / 14)) : 1, k = t * t * (3 - 2 * t);
  const o = {};
  for (const key of ['fog', 'amb', 'rays', 'glow', 'bubbles']) o[key] = p[key] + (z[key] - p[key]) * k;
  o.water = p.water.map((v, j) => v + (z.water[j] - v) * k); o.web = p.web.map((v, j) => v + (z.web[j] - v) * k);
  o.i = i;
  return o;
};

// ---------- the path ----------
const path = s => [3.2 * Math.sin(s * 0.031) + 1.5 * Math.sin(s * 0.013 + 1), -0.22 * s + 1.5 * Math.sin(s * 0.02), -s];
const pathD = s => [3.2 * 0.031 * Math.cos(s * 0.031) + 1.5 * 0.013 * Math.cos(s * 0.013 + 1), -0.22 + 1.5 * 0.02 * Math.cos(s * 0.02), -1];
const GLSL_PATH = /* glsl */ `
  vec3 pathPos(float s) { return vec3(3.2 * sin(s * .031) + 1.5 * sin(s * .013 + 1.), -.22 * s + 1.5 * sin(s * .02), -s); }`;
const SURFACE_Y = 6.5;

// ---------- stage ----------
const FOV = 52;
const renderer = new Renderer({ dpr: Math.min(devicePixelRatio || 1, 1.5), alpha: false, antialias: false, depth: true, webgl: 2 });
const gl = renderer.gl;
document.getElementById('bg').appendChild(gl.canvas);
const camera = new Camera(gl, { fov: FOV, near: 0.05, far: 140 });
const scene = new Transform();
const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.perspective({ aspect: innerWidth / innerHeight }); };
addEventListener('resize', resize); resize();
const PX = () => (innerHeight * renderer.dpr) / (2 * Math.tan((FOV * Math.PI) / 360));

// shared: water, light, the lures (up to 4 lights in the dark), colours
const W = {
  uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uPx: { value: 1 }, uSize: { value: 1 }, uSway: { value: 1 },
  uWater: { value: [0, 0, 0] }, uFog: { value: 0.04 }, uAmb: { value: 1 }, uRays: { value: 1 }, uGlow: { value: 0 }, uWeb: { value: 0 },
  uLures: { value: new Array(16).fill(0) }, uCam: { value: [0, 0, 0] }, uA: { value: VIOLET }, uB: { value: LILAC }
};
const GLSL_LIGHT = /* glsl */ `
  uniform vec4 uLures[4];
  float lureLight(vec3 p) { float l = 0.; for (int i = 0; i < 4; i++) { vec3 d = p - uLures[i].xyz; l += uLures[i].w * exp(-dot(d, d) / 5.); } return l; }
  vec3 webOf(vec3 c) {
    float l = dot(c, vec3(.3, .59, .11));
    return mix(mix(uA * .22, uA * .9, smoothstep(.05, .35, l)), mix(uB, vec3(1.), .5), smoothstep(.35, .85, l));
  }
  // lit by the water's light (stronger near the surface and in the light rays) and by the lures, then into the fog
  vec3 shade(vec3 base, vec3 p, float d) {
    vec3 c = mix(base, webOf(base), uWeb);
    float ripple = .5 + .5 * sin(p.x * 2.3 + uTime * 1.1) * sin(p.z * 1.9 - uTime * .8);
    float lu = lureLight(p);
    c = c * (uAmb * (1. + .25 * uRays * ripple) + lu * 1.6) + vec3(1., .95, .8) * lu * .08;
    return mix(uWater, c, exp(-d * uFog));
  }`;
const opaque = { depthTest: true, depthWrite: true };
const glowy = p => { p.setBlendFunc(gl.ONE, gl.ONE); return p; };

// ---------- landscape templates: points in path space, drawn per cell ----------
// position: ds (along the path from the cell's start), x, y (across, above), random · aColor · aK: a template's own
// value (how high up a kelp stalk, its phase …) · iCell: the cell's start s0, mirror, seed, floor height
const MAXC = 9;
const envProgram = (sway, { glow = false } = {}) => new Program(gl, {
  vertex: /* glsl */ `#version 300 es
    in vec4 position; in vec3 aColor; in vec2 aK; in vec4 iCell;
    uniform mat4 viewMatrix, projectionMatrix; uniform vec3 uWater, uA, uB;
    uniform float uTime, uDpr, uPx, uSize, uSway, uFog, uAmb, uRays, uGlow, uWeb, uFoot, uFootDs;
    out vec3 vC; out float vA;
    ${GLSL_PATH}
    ${GLSL_LIGHT}
    void main() {
      float ds = position.x, x = position.y * iCell.y, y = position.z, r = position.w, k = aK.x, ph = aK.y + iCell.z * 6.28;
      y += iCell.w;
      ${sway}
      vec3 p = pathPos(iCell.x + ds) + vec3(x, y, 0.);
      vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z;
      gl_Position = projectionMatrix * mv;
      ${glow ? `vec3 c = mix(aColor, webOf(aColor) * 1.4, uWeb);
      vC = c * (.4 + .6 * sin(uTime * (1. + r * 2.) + r * 40.) * .5 + .5) * uGlow * exp(-d * uFog * .6); vA = 1.;`
             : `vC = shade(aColor, p, d); vA = 1.;`}
      gl_PointSize = clamp(${glow ? '2.4' : '1.25'} * uSize * uFoot * mix(1., position.x, uFootDs) * uPx / max(d, .1), 1., ${glow ? '5.' : '12.'} * uDpr);
    }`,
  fragment: /* glsl */ `#version 300 es
    precision highp float; in vec3 vC; in float vA; out vec4 o;
    void main() { vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; o = vec4(vC${glow ? ' * smoothstep(.25, .0, r)' : ''}, 1.); }`,
  uniforms: { ...W, uFoot: { value: 0.05 }, uFootDs: { value: 0 } },
  ...(glow ? { transparent: true, depthTest: true, depthWrite: false } : opaque)
});
const templates = {};
const addTemplate = (name, { pos, color, k }, { cell, foot, sway = '', glow = false, cells }) => {
  const program = envProgram(sway, { glow });
  if (glow) glowy(program);
  program.uniforms.uFoot.value = foot;
  const iCell = { instanced: 1, size: 4, data: new Float32Array(MAXC * 4) };
  const mesh = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: pos }, aColor: { size: 3, data: color }, aK: { size: 2, data: k }, iCell }), program, mode: gl.POINTS, frustumCulled: false });
  mesh.setParent(scene);
  templates[name] = { mesh, iCell, cell, cells };
};
const R = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const build = (n, f) => { const pos = new Float32Array(n * 4), color = new Float32Array(n * 3), k = new Float32Array(n * 2); for (let i = 0; i < n; i++) f(i, pos, color, k); return { pos, color, k }; };
const Q = narrow ? 0.5 : 1;

// the sea floor: sand with soft dunes and a few dark stones
addTemplate('sand', build(Math.round(26000 * Q), (i, pos, color, k) => {
  const x = R(-18, 18), ds = R(0, 20), y = 0.35 * Math.sin(x * 0.6 + ds * 0.4) + 0.25 * Math.sin(x * 1.7 - ds * 0.9);
  const stone = Math.random() < 0.06, t = R(0.75, 1.1);
  pos.set([ds, x, y, Math.random()], i * 4);
  color.set(stone ? [0.2 * t, 0.21 * t, 0.2 * t] : [0.62 * t, 0.56 * t, 0.42 * t], i * 3);
}), { cell: 20, foot: 0.15, cells: s => true });

// kelp: tall stalks with blades, swaying in the current (the higher, the more)
addTemplate('kelp', build(Math.round(19000 * Q), (i, pos, color, k) => {
  const st = (i / 1200) | 0, rnd = Math.sin(st * 91.3) * 43758.5453, f = rnd - Math.floor(rnd), f2 = (Math.sin(st * 17.7) * 9999) % 1;
  const side = f < 0.5 ? -1 : 1, x0 = side * (2.4 + Math.abs(f2) * 8), ds0 = Math.abs((Math.sin(st * 3.1) * 777) % 1) * 20, h = 6 + Math.abs((Math.sin(st * 5.3) * 555) % 1) * 9;
  const t = Math.random(), blade = Math.random() < 0.55;
  const w = blade ? R(-1, 1) * (0.45 * Math.sin(t * Math.PI) + 0.1) : R(-0.08, 0.08);
  const a = t * 9 + st;
  pos.set([ds0 + Math.sin(a) * w, x0 + Math.cos(a) * w, -0.3 + t * h, Math.random()], i * 4);
  const g = 0.75 + 0.35 * t;
  color.set([0.36 * g, 0.34 * g, 0.12 * g].map(v => v * R(0.8, 1.15)), i * 3);
  k.set([t * h, st * 1.7], i * 2);
}), { cell: 20, foot: 0.07, sway: `float hk = k * .1; x += uSway * hk * hk * 1.4 * sin(uTime * .55 + ph + k * .25); ds += uSway * hk * hk * .7 * cos(uTime * .45 + ph);`, cells: s => s > 100 && s < 178 });

// rocks: boulders on the floor and, in every other cell, an arch over the way
const rock = (cx, cds, cy, rad, n, out, o) => {
  for (let i = 0; i < n; i++) {
    const u = R(-1, 1), a = R(0, Math.PI * 2), r = Math.sqrt(1 - u * u), nx = r * Math.cos(a), ny = u, nz = r * Math.sin(a);
    const bump = 1 + 0.18 * Math.sin(nx * 5 + nz * 3) + 0.1 * Math.sin(ny * 9 + nx * 7) + R(-0.04, 0.04);
    const t = R(0.7, 1.05), moss = ny > 0.35 && Math.random() < 0.5;
    out.pos.set([cds + nz * rad * bump, cx + nx * rad * bump * 1.2, cy + ny * rad * bump * 0.75, Math.random()], (o + i) * 4);
    out.color.set(moss ? [0.2 * t, 0.3 * t, 0.16 * t] : [0.3 * t, 0.32 * t, 0.34 * t], (o + i) * 3);
  }
};
{
  const per = 2600, nb = 6, out = build(per * nb, () => {});
  for (let b = 0; b < nb; b++) rock((b % 2 ? 1 : -1) * R(2.6, 9), R(1, 19), R(-0.5, 0.6), R(1, 2.6), per, out, b * per);
  addTemplate('rocks', out, { cell: 20, foot: 0.05, cells: s => (s > 160 && s < 236) || s > 282 });
  const arch = build(Math.round(14000 * Q), (i, pos, color) => {
    const a = R(0.05, Math.PI - 0.05), tube = R(0, Math.PI * 2), rr = 0.9 + 0.25 * Math.sin(a * 7) + R(-0.05, 0.05), Rb = 6.2;
    const cx = Math.cos(a) * (Rb + Math.cos(tube) * rr), cy = Math.sin(a) * (Rb * 1.05 + Math.cos(tube) * rr) - 0.3;
    const t = R(0.7, 1.05), moss = Math.sin(tube) > 0.2 && Math.random() < 0.6;
    pos.set([10 + Math.sin(tube) * rr * 1.3, cx, cy, Math.random()], i * 4);
    color.set(moss ? [0.22 * t, 0.32 * t, 0.17 * t] : [0.32 * t, 0.33 * t, 0.36 * t], i * 3);
  });
  addTemplate('arch', arch, { cell: 40, foot: 0.06, cells: s => s > 170 && s < 230 });
}

// glowing plankton in the deep
addTemplate('plankton', build(Math.round(4000 * Q), (i, pos, color) => {
  pos.set([R(0, 20), R(-11, 11), R(-0.5, 12), Math.random()], i * 4);
  color.set(pick([[0.3, 0.95, 0.9], [0.45, 0.8, 1], [0.75, 0.6, 1]]), i * 3);
}), { cell: 20, foot: 0.05, glow: true, sway: `x += .2 * sin(uTime * .3 + r * 30.); y += .2 * sin(uTime * .25 + r * 50.);`, cells: s => s > 212 });

// the flooded forest: the user's picture read into depth (as in "Zatopený prales"), a channel of open water through it
const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
Promise.all([load('/lab/prales/prales.webp'), load('/lab/prales/prales-hloubka.png')]).then(([ci, di]) => {
  const w = ci.naturalWidth, h = ci.naturalHeight;
  const read = img => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h); return x.getImageData(0, 0, w, h).data; };
  const C = read(ci), D = read(di);
  const TX = 1.15, TY = TX * (h / w), EYE = -0.8, ZN = 4, ZF = 26, N = Math.round(100000 * Q);
  const data = build(N, (i, pos, color) => {
    const x = Math.random() * w, y = Math.random() * h, j = ((y | 0) * w + (x | 0)) * 4, n = D[j] / 255;
    const Z = ZF + (ZN - ZF) * Math.pow(n, 0.9);
    let X = (x / w - 0.5) * 2 * TX * Z; const Y = EYE + (0.5 - y / h) * 2 * TY * Z;
    const e = (Y - 0.6) / 3.6; X += (X < 0 ? -1 : 1) * 3.1 * Math.sqrt(Math.max(0, 1 - e * e)); // the channel
    pos.set([Z, X, Y, Math.random()], i * 4);
    color.set([(C[j] / 255) ** 1.1, (C[j + 1] / 255) ** 1.1, (C[j + 2] / 255) ** 1.1], i * 3);
  });
  addTemplate('forest', data, { cell: 12, foot: 2 * TX * (Math.sqrt((w * h) / N) / w), sway: `float sp = iCell.x + ds; if (r > smoothstep(44., 66., sp) * smoothstep(118., 100., sp) || ds > 22. + 4. * r) y += 1e5; // (and no chunk's far back wall: the next chunk is there) // the forest thickens as one swims in, thins out at its end
    float sw = uSway * (.04 + .05 * smoothstep(-2., 6., y)); x += sw * sin(uTime * .55 + y * .7 + ds * .25 + ph); y += sw * .4 * sin(uTime * .45 + x * .6 + ph);`, cells: s => s > 30 && s < 124 });
  // the forest's points scale with their depth in the picture (a pixel far away covers more)
  templates.forest.mesh.program.uniforms.uFootDs.value = 1;
});

// ---------- the surface overhead, light rays, snow and bubbles round the camera ----------
const surfN = Math.round(26000 * Q), surf = new Float32Array(surfN * 4);
for (let i = 0; i < surfN; i++) surf.set([R(-45, 45), SURFACE_Y, R(-20, 110), Math.random()], i * 4);
const surfProg = glowy(new Program(gl, {
  vertex: `attribute vec4 position; uniform mat4 viewMatrix, projectionMatrix; uniform float uTime, uDpr, uSize, uWeb; uniform vec3 uB; varying vec3 vC;
    float wave(vec2 p, float t){ return sin(p.x * .9 + t) * sin(p.y * .7 - t * .8) + sin((p.x + p.y) * 1.3 + t * 1.3) * .5; }
    void main(){ vec3 p = vec3(position.x, position.y, -position.z);
      float w = wave(p.xz, uTime * .9); p.y += w * .25;
      float c = pow(max(0., 1. - abs(w) * 1.4), 4.);
      vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z; gl_Position = projectionMatrix * mv;
      vC = mix(vec3(.75, .95, 1.), mix(uB, vec3(1.), .5), uWeb) * (.08 + .5 * c) * exp(-d * .03);
      gl_PointSize = 3. * uDpr * uSize * (6. / max(d, .5)); }`,
  fragment: `precision highp float; varying vec3 vC; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; gl_FragColor = vec4(vC * smoothstep(.25, 0., r), 1.); }`,
  uniforms: W, transparent: true, depthTest: true, depthWrite: false
}));
new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: surf } }), program: surfProg, mode: gl.POINTS, frustumCulled: false }).setParent(scene);

const shafts = [];
for (let i = 0; i < 12; i++) {
  const x = R(-12, 12), z = R(0, 40), w = R(0.8, 2.6);
  for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) shafts.push(x, z, w, u, v, Math.random());
}
const shaftProg = glowy(new Program(gl, {
  vertex: `attribute vec3 position; attribute vec3 aUv; uniform mat4 viewMatrix, projectionMatrix; uniform vec3 uCam; uniform float uTime;
    varying vec2 vUv; varying float vD, vR;
    void main(){ vUv = aUv.xy; vR = aUv.z;
      float z = uCam.z - 38. + mod(position.y - uCam.z + 38., 42.);
      vec3 c = vec3(uCam.x + position.x + sin(uTime * .1 + aUv.z * 6.) * .6, uCam.y + 3., z);
      vec3 toCam = normalize(vec3(uCam.x - c.x, 0., uCam.z - c.z)); vec3 side = vec3(toCam.z, 0., -toCam.x);
      vec3 p = c + side * (aUv.x - .5) * position.z + vec3(0., (aUv.y - .5) * 18., 0.) + side * (aUv.y - .5) * 2.5;
      vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragment: `precision highp float; uniform float uRays, uTime, uWeb; uniform vec3 uB; varying vec2 vUv; varying float vD, vR;
    void main(){ float x = 1. - abs(vUv.x * 2. - 1.); float a = x * x * smoothstep(0., .9, vUv.y) * (.6 + .4 * sin(uTime * .5 + vR * 9.));
      gl_FragColor = vec4(mix(vec3(.9, 1., .95), mix(uB, vec3(1.), .4), uWeb) * a * .06 * uRays * exp(-vD * .04), 1.); }`,
  uniforms: W, transparent: true, depthTest: true, depthWrite: false, cullFace: null
}));
{
  const n = shafts.length / 6, pos = new Float32Array(n * 3), uv = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos.set(shafts.slice(i * 6, i * 6 + 3), i * 3); uv.set(shafts.slice(i * 6 + 3, i * 6 + 6), i * 3); }
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: pos }, aUv: { size: 3, data: uv } }), program: shaftProg, frustumCulled: false }).setParent(scene);
}
// snow sinks, bubbles rise (both in a box that travels with the camera)
const motes = (n, up) => {
  const d = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) d.set([R(-12, 12), R(-6, 8), R(0, 36), Math.random()], i * 4);
  const p = glowy(new Program(gl, {
    vertex: `attribute vec4 position; uniform mat4 viewMatrix, projectionMatrix; uniform vec3 uCam, uB; uniform float uTime, uDpr, uSize, uWeb, uAmb, uGlow, uK;
      varying vec3 vC; varying float vA;
      void main(){ vec3 p = position.xyz;
        p.z = uCam.z - 34. + mod(p.z - uCam.z + 34., 36.); p.x += uCam.x;
        p.y = uCam.y - 6. + mod(p.y + ${up ? '' : '-'}uTime * ${up ? '.9' : '.08'} * (.5 + position.w) + 6., 14.); p.x += sin(uTime * ${up ? '2.' : '.3'} + position.w * 20.) * ${up ? '.05' : '.2'};
        vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z; gl_Position = projectionMatrix * mv;
        vC = ${up ? 'vec3(.8, .95, 1.) * .5' : 'mix(vec3(.85, .9, .8), uB, uWeb) * .45 * (.5 + position.w) * (uAmb + .5 * uGlow)'} * uK; vA = exp(-d * .1);
        gl_PointSize = ${up ? '3.' : '2.2'} * uDpr * uSize * (4. / max(d, .4)); }`,
    fragment: `precision highp float; varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; gl_FragColor = vec4(vC * vA * ${up ? 'smoothstep(.25, .12, r) * 1.6 + vC * vA * .2' : 'smoothstep(.25, 0., r)'}, 1.); }`,
    uniforms: { ...W, uK: { value: 1 } }, transparent: true, depthTest: true, depthWrite: false
  }));
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: d } }), program: p, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
  return p;
};
motes(Math.round(5000 * Q), false);
const bubbles = motes(Math.round(1400 * Q), true);

// ---------- the animals ----------
const KINDS = {
  zralok: { base: '/lab/tunel/zralok', hmax: 80.9, lay: 'side', head: [1, 0], move: 'tail', n: 14000 },
  kladivoun: { base: '/lab/kladivoun/kladivoun', hmax: 101.7, lay: 'top', head: [0, 1], move: 'tailTop', n: 16000 },
  mantaA: { base: '/lab/manty/manta-a', hmax: 80.8, lay: 'top', head: [-74.4, -112.8], c: [247.2, 210], move: 'flap', n: 16000 },
  mantaB: { base: '/lab/manty/manta-b', hmax: 115.6, lay: 'top', head: [75, 144], c: [255, 180], move: 'flap', n: 13000 },
  meduza: { base: '/lab/meduza/meduza', hmax: 140.9, lay: 'front', head: [0, 1], move: 'pulse', n: 10000, glow: 1 },
  chobotnice: { base: '/lab/chobotnice/chobotnice', hmax: 120, lay: 'front', head: [0, 1], move: 'arms', n: 16000 },
  das: { base: '/lab/das/das', hmax: 173.2, lay: 'side', head: [1, 0], move: 'fins', n: 12000 }
};
const MOVES = {
  tail: `float sw = pow(s, 1.5) * sin(ph - s * 7.); z += .09 * sw; q.y += .01 * sw;`,
  tailTop: `q += perp * .07 * pow(s, 1.5) * sin(ph - s * 7.); z += .02 * pow(s, 2.) * cos(ph - s * 7.);`,
  flap: `float wg = abs(q.y) / max(uLmax, .1); z += .3 * uLmax * pow(wg, 1.6) * sin(ph - wg * 1.7); q.y *= 1. - .05 * pow(wg, 2.);`,
  pulse: `float bell = 1. - smoothstep(.17, .23, s); float pz = pow(sin(ph * .5) * .5 + .5, 3.); q.x *= 1. - .14 * bell * pz; z *= 1. - .14 * bell * pz; q.y += .02 * bell * pz;
    float sn = clamp((s - .2) / .8, 0., 1.); q.x += .025 * sn * sin(ph * .6 - s * 14.); z += .04 * sn * cos(ph * .55 - s * 12. + q.x * 9.);`,
  arms: `float sn = clamp((s - .24) / .76, 0., 1.); float w = pow(sn, 1.3); q += perp * .035 * w * sin(ph * .6 - s * 17.) * (1. - .6 * iS.w); z += .06 * w * cos(ph * .55 - s * 15. + q.x * 6.) * (1. - .6 * iS.w);
    q.x *= 1. - .55 * iS.w * sn; z *= 1. - .5 * iS.w * sn;`,
  fins: `float hn = clamp(abs(z) / .15, 0., 1.); z += .015 * pow(1. - hn, 2.) * smoothstep(.42, .7, s) * sin(ph * 4. + s * 14.); q.y += .008 * sin(ph);`
};
const AU = { uOrig: { value: 1 } };
const MAXA = 16;
const kinds = {};
for (const [name, K] of Object.entries(KINDS)) {
  const U = { ...W, ...AU, uSp: { value: 0.01 }, uLmax: { value: 0.4 }, uRot: { value: [1, 0, 0, 1] }, uC: { value: [0, 0] }, uGlowK: { value: K.glow || 0 } };
  const program = new Program(gl, {
    vertex: /* glsl */ `#version 300 es
      in vec4 position; in vec4 aBody; in vec3 iP; in vec3 iE1; in vec3 iE2; in vec3 iE3; in vec4 iS; // iS: size, phase, opacity, squeeze
      uniform mat4 viewMatrix, projectionMatrix; uniform vec3 cameraPosition, uWater, uA, uB;
      uniform float uTime, uDpr, uPx, uSize, uOrig, uSp, uLmax, uFog, uAmb, uGlow, uGlowK, uWeb, uRays; uniform mat2 uRot; uniform vec2 uC;
      out vec3 vC; out float vA;
      ${GLSL_TONE}
      ${GLSL_LIGHT}
      void main() {
        if (iS.z <= .003) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
        float r = position.w, s = aBody.x, L = aBody.w;
        vec2 q = uRot * (position.xy - uC);
        vec2 t = uRot * aBody.yz; vec2 perp = vec2(-t.y, t.x);
        float z = position.z, ph = iS.y;
        ${MOVES[K.move]}
        vec3 p = iP + (iE1 * q.x + iE2 * q.y + iE3 * z) * iS.x;
        p += .008 * iS.x * vec3(sin(uTime * 1.3 + r * 40.), sin(uTime * 1.1 + r * 60.), sin(uTime * .9 + r * 80.));
        vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z;
        gl_Position = projectionMatrix * mv;
        vec3 base = toneColor(L, uOrig, uA, uB);
        float lu = lureLight(p), wv = exp(-d * uFog);
        vec3 lit = base * (max(uAmb, .12) + lu * 1.8);
        // the jellyfish glow in the deep
        vec3 glow = mix(vec3(.35, .95, .95), mix(uB, vec3(1.), .3), max(uWeb, 1. - uOrig)) * (.35 + .9 * smoothstep(.3, .9, L)) * 1.3;
        lit = mix(lit, glow, uGlow * uGlowK);
        vC = mix(uWater, lit, max(wv, uGlow * uGlowK * .6)) * (.8 + .35 * r);
        float a = toneAlpha(L, uOrig) * facingAlpha(sign(position.z), p, cameraPosition, iE3);
        vA = clamp(a * 1.25, 0., 1.) * iS.z * (.35 + .65 * wv) * smoothstep(60., 44., d);
        gl_PointSize = clamp(1.8 * uSize * uSp * iS.x * uPx / max(d, .1), 1., 18. * uDpr);
      }`,
    fragment: /* glsl */ `#version 300 es
      precision highp float; in vec3 vC; in float vA; out vec4 o;
      void main() { vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; float a = vA * smoothstep(.25, .1, r); o = vec4(vC * a, a); }`,
    uniforms: U, transparent: true, depthTest: true, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const kind = { K, U, mesh: null, attrs: null };
  kinds[name] = kind;
  drawing(K.base).then(d => {
    const m = Math.max(d.w, d.h);
    const { pos, body, spacing } = sample(d, { N: Math.round(K.n * Q), sc: 1 / m, hmax: K.hmax, thick: 0.6 });
    const rotA = K.lay === 'front' ? 0 : -Math.atan2(K.head[1], K.head[0]);
    U.uRot.value = [Math.cos(rotA), Math.sin(rotA), -Math.sin(rotA), Math.cos(rotA)];
    if (K.c) U.uC.value = [(K.c[0] - d.w / 2) / m, (d.h / 2 - K.c[1]) / m];
    let lmax = 0.1;
    for (let k = 0; k < pos.length; k += 4) { const x = pos[k] - U.uC.value[0], y = pos[k + 1] - U.uC.value[1]; lmax = Math.max(lmax, Math.abs(Math.sin(rotA) * x + Math.cos(rotA) * y)); }
    U.uLmax.value = lmax; U.uSp.value = spacing;
    const inst = n => ({ instanced: 1, size: n, data: new Float32Array(MAXA * n) });
    kind.attrs = { iP: inst(3), iE1: inst(3), iE2: inst(3), iE3: inst(3), iS: inst(4) };
    kind.mesh = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: pos }, aBody: { size: 4, data: body }, ...kind.attrs }), program, mode: gl.POINTS, frustumCulled: false });
    kind.mesh.setParent(scene);
  });
}
// the lures: stars of light (up to 4)
const lurePts = [];
for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, len = k % 2 ? 0.48 : 1; for (let i = 0; i < 40; i++) { const t = Math.random(); lurePts.push(Math.cos(a) * t * len, Math.sin(a) * t * len, 0, Math.random()); } }
for (let i = 0; i < 500; i++) { const a = Math.random() * 6.283, rr = Math.abs(Math.random() + Math.random() + Math.random() - 1.5) * 1.3; lurePts.push(Math.cos(a) * rr, Math.sin(a) * rr, 0, 2 + Math.random()); }
const lureMeshes = [0, 1, 2, 3].map(() => {
  const U = { uTime: W.uTime, uDpr: W.uDpr, uPx: W.uPx, uWeb: W.uWeb, uB: W.uB, uPos: { value: [0, -999, 0] }, uR: { value: 0.2 }, uOn: { value: 0 } };
  const p = glowy(new Program(gl, {
    vertex: `attribute vec4 position; uniform mat4 viewMatrix, projectionMatrix; uniform vec3 uPos, uB; uniform float uTime, uDpr, uPx, uR, uWeb, uOn;
      varying vec3 vC; varying float vA;
      void main(){ bool halo = position.w >= 2.; float a = uTime * .2; vec2 q = mat2(cos(a), sin(a), -sin(a), cos(a)) * position.xy;
        vec4 mv = viewMatrix * vec4(uPos + vec3(q * uR * (1. + .08 * sin(uTime * 2.3)), 0.), 1.); gl_Position = projectionMatrix * mv; float d = -mv.z;
        vC = mix(vec3(1., .96, .82), mix(uB, vec3(1.), .55), uWeb); vA = (halo ? .14 : 1.) * exp(-d * .03) * uOn;
        gl_PointSize = (halo ? 3.4 : 1.9) * uDpr * uPx * .04 * uR / max(d, .2); }`,
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
const frameOf = (kind, fwd, bank, cam, pos) => {
  const lay = KINDS[kind].lay;
  if (lay === 'front') { const e2 = norm(fwd); let e3 = sub(cam, pos); e3 = norm(sub(e3, mul(e2, dot(e3, e2)))); return [cross(e2, e3), e2, e3]; }
  const e1 = norm(fwd);
  let side = cross(UP, e1); if (len(side) < 1e-3) side = [1, 0, 0]; side = norm(side);
  const upo = cross(e1, side), c = Math.cos(bank), s = Math.sin(bank);
  if (lay === 'side') { const e2 = add(mul(upo, c), mul(side, -s)); return [e1, e2, cross(e1, e2)]; }
  const e2 = add(mul(side, c), mul(upo, s));
  return [e1, e2, cross(e1, e2)];
};

// ---------- life: animals in path space (along s, across x, above y), by stretch ----------
const LIVE = [
  { meduza: 6, mantaA: 1, mantaB: 1, zralok: 2 },
  { zralok: 3, chobotnice: 1, meduza: 3, mantaA: 1 },
  { zralok: 5, kladivoun: 1, meduza: 2 },
  { kladivoun: 2, chobotnice: 2, mantaB: 1, zralok: 1 },
  { das: 3, meduza: 6 },
  { das: 2, chobotnice: 1, mantaA: 1, meduza: 3 }
];
const SPEC = {
  zralok: { size: [1.5, 2.6], v: [0.35, 0.5], turn: 0.5, tail: 0.9 },
  kladivoun: { size: [2.4, 3.4], v: [0.3, 0.42], turn: 0.4, tail: 0.7 },
  mantaA: { size: [3, 5], v: [0.22, 0.32], turn: 0.25, tail: 0.45 },
  mantaB: { size: [2.6, 4], v: [0.22, 0.32], turn: 0.25, tail: 0.45 },
  meduza: { size: [0.6, 1.5], v: [0.1, 0.2], turn: 0.2, tail: 0.37 },
  chobotnice: { size: [1, 1.7], v: [0.12, 0.2], turn: 0.6, tail: 0.5 },
  das: { size: [0.8, 1.3], v: [0.06, 0.1], turn: 0.3, tail: 0.4 }
};
const floorY = s => (s < 40 ? -13 : s < 52 ? -13 + ((s - 40) / 12) * 8.4 : -4.6);
const spot = (kind, s, size) => {
  let x, y;
  switch (kind) {
    case 'kladivoun': x = R(-7, 7); y = Math.random() < 0.6 ? R(2, 5) : R(-3.6, -2.2); break;
    case 'mantaA': case 'mantaB': x = R(-8, 8); y = R(1.6, 5); break;
    case 'chobotnice': x = (Math.random() < 0.5 ? -1 : 1) * R(1.8, 6); y = floorY(s) + size * 0.3; break;
    case 'das': x = (Math.random() < 0.5 ? -1 : 1) * R(1.8, 6); y = R(-3.6, -1.4); break;
    case 'meduza': x = (Math.random() < 0.5 ? -1 : 1) * R(1.6, 7); y = R(-3, 5); break;
    default: x = (Math.random() < 0.5 ? -1 : 1) * R(1.8, 8); y = R(-3, 3);
  }
  if (Math.hypot(x, y) < 1.8) x = Math.sign(x || 1) * 2;
  return [s, x, y];
};
const pool = Array.from({ length: 40 }, (_, i) => ({ i, alive: false }));
const spawn = (a, s) => {
  const table = LIVE[zoneAt(s)], names = Object.keys(table), weights = names.map(n => table[n]);
  let r = Math.random() * weights.reduce((x, y) => x + y, 0), kind = names[0];
  for (let j = 0; j < names.length; j++) { r -= weights[j]; if (r <= 0) { kind = names[j]; break; } }
  const sp = SPEC[kind];
  a.kind = kind; a.size = R(...sp.size); a.v = R(...sp.v);
  [a.s, a.x, a.y] = spot(kind, s, a.size);
  a.wp = spot(kind, a.s + R(-12, 16), a.size);
  a.f = norm([a.wp[1] - a.x, a.wp[2] - a.y, a.wp[0] - a.s]); // (x, y, s)
  if (kind === 'meduza') a.f = norm([R(-0.3, 0.3), 1, R(-0.3, 0.3)]);
  a.bank = 0; a.yaw = 0; a.phase = R(0, 6.28); a.t = R(4, 9); a.state = kind === 'chobotnice' ? 'crawl' : 'swim'; a.squeeze = 0; a.boost = 0; a.alive = true; a.fade = 0;
};
const steer = (a, d, omega, dt) => { d = norm(d); const c = clamp(dot(a.f, d), -1, 1), ang = Math.acos(c); if (ang > 1e-4) a.f = norm(mix3(a.f, d, Math.min(1, (omega * dt) / ang))); };
const live = (a, dt, camS) => {
  const sp = SPEC[a.kind];
  a.t -= dt; a.fade = Math.min(1, a.fade + dt * 0.7);
  if (a.kind === 'meduza') {
    a.phase += dt * 2.3;
    const pz = Math.pow(Math.sin(a.phase * 0.5) * 0.5 + 0.5, 3);
    if (a.t <= 0) { a.t = R(3, 7); a.tilt = norm([R(-0.35, 0.35), 1, R(-0.35, 0.35)]); }
    if (a.tilt) steer(a, a.tilt, 0.15, dt);
    const v = (0.05 + pz * 0.45) * a.size;
    a.x += a.f[0] * v * dt; a.y += a.f[1] * v * dt; a.s += a.f[2] * v * dt;
    if (a.y > 6.5) a.y = -3.5;
    return;
  }
  if (a.kind === 'chobotnice') {
    a.phase += dt * 3;
    const fy = floorY(a.s) + a.size * 0.3;
    if (a.state === 'crawl') {
      const dx = a.wp[1] - a.x, ds = a.wp[0] - a.s, l = Math.hypot(dx, ds) || 1;
      a.x += (dx / l) * a.v * dt; a.s += (ds / l) * a.v * dt; a.y += (fy - a.y) * Math.min(1, dt * 2);
      a.f = norm(mix3(a.f, [0, 1, 0], Math.min(1, dt * 2))); a.squeeze += (0 - a.squeeze) * Math.min(1, dt * 2);
      if (l < 0.6 || a.t <= 0) { a.state = 'jet'; a.t = R(4, 7); a.wp = spot('meduza', a.s + R(-6, 8), a.size); }
    } else {
      const cyc = (a.phase / 3.5) % 1, thrust = cyc < 0.25 ? Math.sin((cyc / 0.25) * Math.PI) : 0;
      a.squeeze += ((cyc < 0.45 ? 1 : 0.35) - a.squeeze) * Math.min(1, dt * 4);
      steer(a, [a.wp[1] - a.x, a.wp[2] - a.y, a.wp[0] - a.s], 0.8, dt);
      a.boost = a.boost * Math.exp(-dt * 1.5) + thrust * dt * 5;
      const v = (0.15 + a.boost) * a.size;
      a.x += a.f[0] * v * dt; a.y += a.f[1] * v * dt; a.s += a.f[2] * v * dt;
      if (a.t <= 0) { a.state = 'crawl'; a.t = R(6, 12); a.wp = spot('chobotnice', a.s + R(-5, 5), a.size); }
    }
    return;
  }
  if (a.t <= 0 || Math.hypot(a.wp[0] - a.s, a.wp[1] - a.x, a.wp[2] - a.y) < 1.5) { a.t = R(5, 10); a.wp = spot(a.kind, clamp(a.s + R(-14, 14), camS - 4, camS + 40), a.size); }
  const before = Math.atan2(a.f[0], a.f[2]);
  let want = [a.wp[1] - a.x, a.wp[2] - a.y, a.wp[0] - a.s];
  // keep off the camera's way
  if (Math.abs(a.s - camS) < 5 && Math.hypot(a.x, a.y) < 2.2) want = add(norm(want), [Math.sign(a.x || 1) * 1.5, Math.sign(a.y || 1) * 0.5, 0]);
  steer(a, want, sp.turn, dt);
  a.f[1] = clamp(a.f[1], -0.45, 0.45); a.f = norm(a.f);
  let dyaw = Math.atan2(a.f[0], a.f[2]) - before; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
  a.yaw += (dyaw / Math.max(dt, 1e-3) - a.yaw) * Math.min(1, dt * 2);
  a.bank += (clamp(a.yaw * 1.4, -0.8, 0.8) - a.bank) * Math.min(1, dt * 1.5);
  const v = a.v * a.size;
  a.x += a.f[0] * v * dt; a.y += a.f[1] * v * dt; a.s += a.f[2] * v * dt;
  a.phase += dt * 6.283 * sp.tail;
};
// path space → world (the path's tangent bends a direction along it)
const toWorld = (s, x, y) => add(path(s), [x, y, 0]);
const dirWorld = (s, f) => { const d = pathD(s); return norm([f[0] + d[0] * f[2], f[1] + d[1] * f[2], d[2] * f[2]]); };

// ---------- scroll, looking round, the copy, the gauge ----------
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
addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || ui(e)) return; tx((e.clientX / innerWidth) * 2 - 1); ty((e.clientY / innerHeight) * 2 - 1); }, { passive: true });
const gaugeZone = document.getElementById('lh-zone'), gaugeDepth = document.getElementById('lh-depth'), gaugeBar = document.getElementById('lh-bar');
let lastZone = -1;

// ---------- panel ----------
document.querySelectorAll('[data-set]').forEach(inp => {
  const key = inp.dataset.set, out = inp.parentElement.querySelector('output');
  inp.value = S[key];
  const show = () => { if (out) out.textContent = Number(inp.value).toFixed(2); };
  show();
  inp.addEventListener('input', () => { S[key] = Number(inp.value); show(); });
});
{
  const btns = document.querySelectorAll('[data-barva]');
  const set = v => { VIEW.barvy = v; btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.barva === v))); };
  btns.forEach(b => b.addEventListener('click', () => set(b.dataset.barva)));
  set(VIEW.barvy);
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
const col = { web: 0, orig: 1 };
const tick = now => {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const go = reduce ? 0 : dt;
  time += go;
  const cs = cam.s;
  // the camera: on the path, a gentle swimmer's bob, looking ahead along it (and where the pointer says)
  const cp = add(path(cs), [Math.sin(time * 0.4) * 0.08, Math.sin(time * 0.6) * 0.1, 0]);
  const ahead = path(cs + 6);
  const yaw = look.x * 0.45, pitch = -look.y * 0.3;
  const fwd = norm(sub(ahead, cp));
  const right = norm(cross(fwd, UP)), upv = cross(right, fwd);
  const lookDir = norm(add(add(fwd, mul(right, Math.tan(yaw))), mul(upv, Math.tan(pitch))));
  camera.position.set(...cp);
  camera.lookAt(add(cp, mul(lookDir, 4)));

  // the stretch round the camera
  const z = zoneMix(cs);
  const web = VIEW.barvy === 'web' ? 1 : 0, orig = VIEW.barvy === 'puvodni' ? 1 : 0;
  col.web += (web - col.web) * Math.min(1, dt * 3); col.orig += (orig - col.orig) * Math.min(1, dt * 3);
  const water = mix3(z.water, z.web, col.web);
  W.uWater.value = water; gl.clearColor(water[0], water[1], water[2], 1);
  W.uFog.value = z.fog; W.uAmb.value = z.amb * (0.6 + 0.4 * S.light); W.uRays.value = z.rays * S.light; W.uGlow.value = z.glow; W.uWeb.value = col.web; AU.uOrig.value = col.orig;
  W.uTime.value = time; W.uSize.value = S.size; W.uSway.value = S.sway; W.uPx.value = PX(); W.uDpr.value = renderer.dpr; W.uCam.value = cp;
  bubbles.uniforms.uK.value = z.bubbles;
  if (z.i !== lastZone) {
    lastZone = z.i;
    if (gaugeZone) { gaugeZone.textContent = ZONES[z.i].name; gsap.fromTo(gaugeZone, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }); }
  }
  if (gaugeDepth) gaugeDepth.textContent = `${Math.max(0, Math.round(-cp[1] * 4 + 2))} m`;
  if (gaugeBar) gaugeBar.style.transform = `scaleY(${(cs / L).toFixed(4)})`;

  // landscape: the cells round the camera
  for (const t of Object.values(templates)) {
    const d = t.iCell.data; let n = 0;
    const k0 = Math.floor((cs - 30) / t.cell), k1 = Math.floor((cs + 80) / t.cell);
    for (let k = k0; k <= k1 && n < MAXC; k++) {
      const s0 = k * t.cell;
      if (s0 < -t.cell || !t.cells(s0 + t.cell / 2)) continue;
      const seed = ((Math.sin(k * 12.9898 + t.cell) * 43758.5453) % 1 + 1) % 1;
      d.set([s0, k % 2 ? -1 : 1, seed, t === templates.sand ? floorY(s0 + t.cell / 2) : t === templates.rocks || t === templates.arch ? -4.6 : t === templates.kelp ? -4.6 : 0], n * 4);
      n++;
    }
    t.mesh.visible = n > 0;
    t.mesh.geometry.setInstancedCount(Math.max(1, n));
    t.iCell.needsUpdate = true;
  }

  // life: keep the pool alive round the camera
  const shown = {}; for (const k in kinds) shown[k] = 0;
  const lures = [];
  const want = Math.round(pool.length * 0.65 * S.animals);
  for (const a of pool) {
    if (a.i >= want) { a.alive = false; continue; }
    if (!a.alive) spawn(a, cs + R(6, 45));
    else if (a.s < cs - 8) spawn(a, cs + R(30, 48));
    else if (a.s > cs + 60) spawn(a, cs - R(3, 7));
    live(a, go, cs);
    const K = kinds[a.kind]; if (!K.attrs || shown[a.kind] >= MAXA) continue;
    const pos = toWorld(a.s, a.x, a.y), f = dirWorld(a.s, a.f);
    const e = frameOf(a.kind, f, a.bank, cp, pos);
    const op = a.fade * Math.min(1, (a.s - cs + 8) / 4);
    const k = shown[a.kind]++;
    K.attrs.iP.data.set(pos, k * 3); K.attrs.iE1.data.set(e[0], k * 3); K.attrs.iE2.data.set(e[1], k * 3); K.attrs.iE3.data.set(e[2], k * 3);
    K.attrs.iS.data.set([a.size, a.phase, op, a.squeeze || 0], k * 4);
    if (a.kind === 'das' && lures.length < 4) lures.push([add(pos, add(mul(e[0], 0.316 * a.size), mul(e[1], 0.251 * a.size))), op, a.size]);
  }
  for (const [name, K] of Object.entries(kinds)) {
    if (!K.attrs) continue;
    K.mesh.visible = shown[name] > 0;
    K.mesh.geometry.setInstancedCount(Math.max(1, shown[name]));
    for (const at of Object.values(K.attrs)) at.needsUpdate = true;
  }
  // the lures light the dark round them
  const lv = W.uLures.value;
  for (let i = 0; i < 4; i++) {
    const l = lures[i], U = lureMeshes[i];
    if (l) { const strength = l[1] * (0.9 + 0.1 * Math.sin(time * 2.1 + i)) * (0.4 + z.glow); lv.splice(i * 4, 4, ...l[0], strength); U.uPos.value = l[0]; U.uR.value = 0.17 * l[2]; U.uOn.value = l[1]; }
    else { lv.splice(i * 4, 4, 0, -999, 0, 0); U.uOn.value = 0; }
  }
  renderer.render({ scene, camera });
};
requestAnimationFrame(tick);
