/* Grafysta lab: the trunk from the photo in the middle of the page, sharks circling it.
   The trunk (from the camera lab, "Kmen z fotky"): a mossy trunk read back into 3D from a worm's-eye photo, with its
   crown and the canopy overhead. The camera climbs it as the page scrolls, orbiting it all the way (GSAP, damped).
   The sharks (from the shark lab, cut out of the user's video): each one a cloud of points with some body to it (two
   shells around the drawing, thick in the middle, thin at the fins), circling the trunk at its own height, radius and
   speed, rising and sinking a little, its body waving sideways and bending into the curve. Scrolling hurries them on.
   The content sections turn with the camera (CSS 3D, ScrollTrigger), as in the camera lab. */
import { Renderer, Camera, Transform, Program, Mesh, Geometry } from 'ogl';

const gsap = window.gsap, ST = window.ScrollTrigger;
gsap.registerPlugin(ST);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = innerWidth < 760;

const S = {
  orbit: 90, // camera turn per screen of scroll (deg)
  angle: narrow ? 16 : 26, // how far a section is turned when it comes in / leaves (deg)
  count: narrow ? 6 : 8, // sharks around the trunk (spread over its whole height)
  scale: 1, // shark size
  speed: 1, // swimming speed
  radius: 1, // how far from the trunk they circle
  boost: 1.5, // how much the scroll hurries them on
  wave: 1, // body waving
  size: 1 // particle size (trunk, sharks, dust)
};
const MAX = 14;

// ---------- renderer ----------
const host = document.getElementById('bg');
const renderer = new Renderer({ dpr: Math.min(devicePixelRatio || 1, 1.5), alpha: false, antialias: false, depth: false });
const gl = renderer.gl;
gl.clearColor(10 / 255, 10 / 255, 10 / 255, 1);
host.appendChild(gl.canvas);
const camera = new Camera(gl, { fov: 45, near: 0.05, far: 80 });
const scene = new Transform();
const VIOLET = [82 / 255, 39 / 255, 1], LILAC = [177 / 255, 158 / 255, 239 / 255];
const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.perspective({ aspect: innerWidth / innerHeight }); };
addEventListener('resize', resize); resize();
// colours: 1 = original (the photo's moss, the woodcut's black-and-white), 0 = site colours; particle size for all
const COL = { trunk: 1, shark: 0, mode: 'smisene' };
const SIZE = { value: 1 };
const progs = [];

// ---------- the trunk from the photo (as in the camera lab) ----------
let trunkProg = null;
async function trunk() {
  const img = new Image(); img.src = '/lab/kamera/kmen.webp'; await img.decode();
  const iw = 392, ih = 800, cv = document.createElement('canvas'); cv.width = iw; cv.height = ih;
  const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, iw, ih);
  const d = x.getImageData(0, 0, iw, ih).data;
  const CX = 400 / 784, TOP = 370 / 1600, BOT = 1560 / 1600;
  const half = yn => (10 + (yn * 1600 - 370) * 0.36) / 784;
  const N = narrow ? 80000 : 160000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), rnd = new Float32Array(N);
  let k = 0, guard = 0;
  while (k < N && guard++ < N * 40) {
    const px = Math.random() * iw, py = Math.random() * ih, i = ((py | 0) * iw + (px | 0)) * 4;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const xn = px / iw, yn = py / ih;
    if ((b > r + 0.08 && b > g - 0.02 && lum > 0.45) || lum < 0.03) continue;
    let X, Y, Z;
    const hw = half(yn);
    if (yn > TOP && Math.abs(xn - CX) < hw) {
      if (Math.random() > 0.55) continue;
      const tt = Math.min(1, Math.max(0, (BOT - yn) / (BOT - TOP)));
      const H = 16 * Math.pow(tt, 1.7), R = 0.12 + 1.6 * (1 - 0.92 * tt);
      const u = Math.max(-1, Math.min(1, (xn - CX) / hw));
      const phi = Math.asin(u) + (Math.random() < 0.5 ? 0 : Math.PI);
      const rr = R * (1 + (Math.random() - 0.5) * 0.08);
      X = Math.sin(phi) * rr; Y = H - 0.5; Z = Math.cos(phi) * rr;
    } else {
      if (Math.random() > Math.pow(lum, 0.6) * 1.2) continue;
      const dx = (xn - CX) * 784, dy = (yn - TOP) * 1600, rad = Math.hypot(dx, dy);
      const al = Math.atan2(dx, -dy) + ((Math.random() * 3) | 0) * (Math.PI * 2 / 3);
      if (rad < 330 && yn < TOP + 0.12) {
        const f = rad / 330;
        X = Math.sin(al) * f * 3.2; Y = 15.8 - f * 3.4 + (Math.random() - 0.5) * 0.6; Z = Math.cos(al) * f * 3.2;
      } else {
        const th = Math.min(1.45, (rad / 950) * 1.45), Rc = 4.5 + Math.random() * 4.5;
        X = Math.sin(al) * Rc; Y = Math.min(19, Rc / Math.tan(Math.max(th, 0.2))) - 0.5; Z = Math.cos(al) * Rc;
      }
    }
    pos[k * 3] = X; pos[k * 3 + 1] = Y; pos[k * 3 + 2] = Z;
    col[k * 3] = r; col[k * 3 + 1] = g; col[k * 3 + 2] = b; rnd[k] = Math.random();
    k++;
  }
  const program = new Program(gl, {
    vertex: `attribute vec3 position, aC; attribute float aR; uniform mat4 viewMatrix, projectionMatrix; uniform float uTime, uDpr, uOrig, uSize; uniform vec3 uA, uB;
      varying vec3 vC; varying float vD;
      void main(){
        vec3 p = position;
        float leaf = step(1.8, length(p.xz)) + step(13.5, p.y);
        p += leaf * .06 * vec3(sin(uTime * .8 + aR * 30.), sin(uTime * .6 + aR * 50.), cos(uTime * .7 + aR * 70.));
        float l = dot(aC, vec3(.3, .59, .11));
        vec3 brand = mix(uA, mix(uB, vec3(1.), .4), clamp(l * 1.4, 0., 1.));
        vC = mix(brand, pow(aC, vec3(.75)) * 1.6, uOrig) * (.8 + .45 * aR);
        vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z;
        gl_Position = projectionMatrix * mv; gl_PointSize = min(2.2 * uDpr * uSize * (7. / max(vD, .3)), 5. * uDpr * uSize); }`,
    fragment: `precision highp float; varying vec3 vC; varying float vD;
      void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
        gl_FragColor = vec4(vC * smoothstep(.25, 0., r) * exp(-max(vD - 8., 0.) * .04) * .75, 1.); }`,
    uniforms: { uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uOrig: { value: 1 }, uSize: SIZE, uA: { value: VIOLET }, uB: { value: LILAC } },
    transparent: true, depthTest: false, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE);
  trunkProg = program;
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: pos }, aC: { size: 3, data: col }, aR: { size: 1, data: rnd } }), program, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
  progs.push(program);
}

// a slow cloud of faint points around the trunk, so depth reads everywhere
let dustProg = null;
(function dust() {
  const N = narrow ? 2500 : 5000, pos = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    const r = 2 + Math.random() * 12, a = Math.random() * Math.PI * 2;
    pos[k * 3] = Math.cos(a) * r; pos[k * 3 + 1] = Math.random() * 18 - 1; pos[k * 3 + 2] = Math.sin(a) * r;
  }
  const program = new Program(gl, {
    vertex: `attribute vec3 position; uniform mat4 viewMatrix, projectionMatrix; uniform float uTime, uDpr, uSize, uOrig; uniform vec3 uA, uB; varying vec3 vC; varying float vD;
      void main(){ vec3 p = position; p.y += sin(uTime * .2 + p.x) * .3; p.x += cos(uTime * .15 + p.z) * .3;
        vC = mix(mix(uA, uB, fract(position.x * 3.7)), vec3(.62, .66, .58) * (.6 + .5 * fract(position.z * 5.3)), uOrig) * .35;
        vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; gl_PointSize = 2.6 * uDpr * uSize * (6. / max(vD, .5)); }`,
    fragment: `precision highp float; varying vec3 vC; varying float vD;
      void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
        gl_FragColor = vec4(vC * smoothstep(.25, 0., r) * exp(-max(vD - 4., 0.) * .07), 1.); }`,
    uniforms: { uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uSize: SIZE, uOrig: { value: 0 }, uA: { value: VIOLET }, uB: { value: LILAC } },
    transparent: true, depthTest: false, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE);
  dustProg = program;
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: pos } }), program, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
  progs.push(program);
})();

// ---------- the sharks ----------
// the drawing → points on an even jittered grid, each pushed out to one of two shells around the body: the body is
// thick in the middle of every column of the drawing and thin towards its top and bottom (fins), so it has volume
// from every side. x along the body (-.5 tail … .5 head), y up, z across (all in shark lengths)
function sample(img, n) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  const px = cx.getImageData(0, 0, w, h).data;
  const ink = new Float32Array(w * h);
  let area = 0;
  for (let i = 0; i < w * h; i++) { ink[i] = px[i * 4] / 255; if (ink[i] > 0.5) area++; }
  const at = (x, y) => ink[Math.min(h - 1, Math.max(0, Math.round(y))) * w + Math.min(w - 1, Math.max(0, Math.round(x)))];
  // every column's body: its middle and half height (rows with ink, the 15 % extremes left out as fins)
  const mid = new Float32Array(w), hh = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const rows = [];
    for (let y = 0; y < h; y++) if (ink[y * w + x] > 0.5) rows.push(y);
    if (!rows.length) continue;
    const a = rows[Math.floor(rows.length * 0.15)], b = rows[Math.floor(rows.length * 0.85)];
    mid[x] = (a + b) / 2; hh[x] = Math.max(2, (b - a) / 2);
  }
  const step = Math.sqrt((area * 2) / n), out = [];
  for (let gy = step / 2; gy < h; gy += step) for (let gx = step / 2; gx < w; gx += step) {
    const x = gx + (Math.random() - 0.5) * step * 0.7, y = gy + (Math.random() - 0.5) * step * 0.7;
    if (at(x, y) < 0.5) continue;
    const d = Math.max(1, step * 0.6);
    const e = Math.min(1, Math.hypot(at(x + d, y) - at(x - d, y), at(x, y + d) - at(x, y - d)));
    const c = Math.min(w - 1, Math.max(0, Math.round(x)));
    const t = Math.sqrt(Math.max(0, 1 - Math.pow((y - mid[c]) / (hh[c] * 1.25), 2))) * hh[c] * 0.6;
    for (const side of [1, -1]) out.push(x / w - 0.5, (h / 2 - y) / w, (side * t) / w, Math.random(), e);
  }
  return { pts: new Float32Array(out), spacing: step / w };
}

const SU = {
  uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uPx: { value: 1 }, uSp: { value: 0.01 }, uSize: SIZE, uOrig: { value: 0 },
  uA: { value: VIOLET }, uB: { value: LILAC }
};
const sharkProg = new Program(gl, {
  vertex: /* glsl */ `#version 300 es
    in vec3 position; in float aR; in float aE;
    in vec3 iPos; in vec4 iDir; in vec4 iSwim; // iDir: heading (xyz), length · iSwim: tail phase, wave, bend, hurry
    uniform mat4 viewMatrix, projectionMatrix;
    uniform float uTime, uDpr, uPx, uSp, uSize, uOrig; uniform vec3 uA, uB;
    out vec3 vC; out float vA; out float vD;
    void main() {
      float L = iDir.w, r = aR;
      vec3 l = position;
      // a wave runs from the head to the tail and grows towards it (sideways, across the body)
      float tail = pow(smoothstep(.32, -.5, l.x), 1.4);
      float side = iSwim.y * tail * sin(iSwim.x - l.x * 6.5) * .2;
      float bend = iSwim.z * (l.x - .2) * (l.x - .2); // into the curve of the path
      vec3 b = vec3(l.x, l.y, l.z + side + bend) * L;
      // the body's frame: forward along the heading, up (fin up), across
      vec3 T = normalize(iDir.xyz);
      vec3 N = normalize(cross(T, vec3(0., 1., 0.)));
      vec3 Up = cross(N, T);
      vec3 p = iPos + T * b.x + Up * b.y + N * b.z;
      p += .015 * L * vec3(sin(uTime * 1.3 + r * 40.), sin(uTime * 1.1 + r * 60.), sin(uTime * .9 + r * 80.));
      vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z;
      gl_Position = projectionMatrix * mv;
      // site colours: violet → lilac on the edges; original: the woodcut's neutral grey, its cuts and edges white
      float e = clamp(aE * 1.3, 0., 1.);
      vC = mix(mix(uA * .9, mix(uB, vec3(1.), .35), e), mix(vec3(.5, .5, .49), vec3(1.), e), uOrig) * (.75 + .5 * r);
      vA = (.42 + .3 * clamp(aE, 0., 1.)) * (1. + iSwim.w * .3);
      gl_PointSize = L < .001 ? 0. : clamp(1.3 * uSize * uSp * L * uPx / max(vD, .2), 1., 9. * uDpr * uSize);
    }`,
  fragment: /* glsl */ `#version 300 es
    precision highp float; in vec3 vC; in float vA; in float vD; out vec4 o;
    void main() { vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
      o = vec4(vC * vA * smoothstep(.25, .02, r) * exp(-max(vD - 9., 0.) * .05), 1.); }`,
  uniforms: SU, transparent: true, depthTest: false, depthWrite: false
});
sharkProg.setBlendFunc(gl.ONE, gl.ONE);
progs.push(sharkProg);

const inst = { iPos: new Float32Array(MAX * 3), iDir: new Float32Array(MAX * 4), iSwim: new Float32Array(MAX * 4) };
let sharkMesh = null;
const sharkImg = new Image();
sharkImg.onload = () => {
  const { pts, spacing } = sample(sharkImg, narrow ? 3400 : 5000);
  SU.uSp.value = spacing;
  const n = pts.length / 5, pos = new Float32Array(n * 3), aR = new Float32Array(n), aE = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos.set(pts.subarray(i * 5, i * 5 + 3), i * 3); aR[i] = pts[i * 5 + 3]; aE[i] = pts[i * 5 + 4]; }
  sharkMesh = new Mesh(gl, {
    geometry: new Geometry(gl, {
      position: { size: 3, data: pos }, aR: { size: 1, data: aR }, aE: { size: 1, data: aE },
      iPos: { instanced: 1, size: 3, data: inst.iPos }, iDir: { instanced: 1, size: 4, data: inst.iDir }, iSwim: { instanced: 1, size: 4, data: inst.iSwim }
    }),
    program: sharkProg, mode: gl.POINTS, frustumCulled: false
  });
  sharkMesh.setParent(scene);
};
sharkImg.src = '/lab/zraloci/zralok.png';

// every shark: its own height on the trunk (spread from the foot to the crown), radius, speed and way round
const rnd = (a, b) => a + Math.random() * (b - a);
const sharks = Array.from({ length: MAX }, (_, i) => ({
  y: 0, // set by spread()
  R: rnd(2.6, 4.4), dir: Math.random() < 0.8 ? 1 : -1, a: rnd(0, Math.PI * 2), k: rnd(0.8, 1.15),
  bob: rnd(0.4, 1.1), bobW: rnd(0.12, 0.25), bobP: rnd(0, 6.28), wob: rnd(0.2, 0.5), wobP: rnd(0, 6.28), vk: rnd(0.85, 1.15), phase: rnd(0, 6.28)
}));
const spread = () => {
  const n = Math.min(S.count, MAX);
  const order = [...Array(n).keys()].sort(() => Math.random() - 0.5);
  sharks.forEach((s, i) => { if (i < n) s.y = 0.8 + ((order[i] + rnd(0.15, 0.85)) / n) * 14; });
};
spread();
const shark = (s, t) => {
  const R = (s.R + Math.sin(t * 0.13 + s.wobP) * s.wob) * S.radius;
  return [Math.sin(s.a) * R, s.y + Math.sin(t * s.bobW + s.bobP) * s.bob, Math.cos(s.a) * R, R];
};
const hurry = { v: 0 };
const toHurry = gsap.quickTo(hurry, 'v', { duration: 0.9, ease: 'power2.out' });
let lastY = scrollY, lastT = performance.now();
addEventListener('scroll', () => {
  const now = performance.now(), dy = Math.abs(scrollY - lastY) / Math.max(1, now - lastT) * 1000 / innerHeight;
  lastY = scrollY; lastT = now;
  toHurry(Math.min(1, dy / 1.5));
  clearTimeout(hurry.t); hurry.t = setTimeout(() => toHurry(0), 120);
}, { passive: true });
const tickSharks = (dt, t) => {
  const n = Math.min(S.count, MAX);
  for (let i = 0; i < MAX; i++) {
    const s = sharks[i];
    if (i >= n) { inst.iDir[i * 4 + 3] = 0; continue; }
    const L = 2.3 * S.scale * s.k;
    const v = L * 0.3 * S.speed * s.vk * (1 + hurry.v * S.boost);
    const [x0, y0, z0, R] = shark(s, t);
    if (!reduce) s.a += (s.dir * v * dt) / R;
    const [x1, y1, z1] = shark(s, t + dt);
    let hx = x1 - x0, hy = y1 - y0, hz = z1 - z0;
    if (Math.hypot(hx, hy, hz) < 1e-6) { hx = Math.cos(s.a) * s.dir; hy = 0; hz = -Math.sin(s.a) * s.dir; }
    s.phase += dt * 6.28 * 1.2 * (1 + hurry.v * S.boost * 0.7);
    inst.iPos.set([x1, y1, z1], i * 3);
    inst.iDir.set([hx, hy * 0.6, hz, L], i * 4);
    // bend into the curve: head and tail towards the trunk (the shader's "across" is heading × up = (-hz, 0, hx))
    const inward = Math.sign(hz * x1 - hx * z1) || 1;
    inst.iSwim.set([s.phase, S.wave * (1 + hurry.v * 0.5), (L / R) * 0.9 * inward, hurry.v], i * 4);
  }
  if (sharkMesh) {
    const a = sharkMesh.geometry.attributes;
    a.iPos.needsUpdate = true; a.iDir.needsUpdate = true; a.iSwim.needsUpdate = true;
  }
};

trunk();

// ---------- camera: up the trunk, orbiting it with the scroll (damped), leaning after the pointer ----------
const cam = { yaw: 0, p: 0, lx: 0, ly: 0 };
const toYaw = gsap.quickTo(cam, 'yaw', { duration: 1.2, ease: 'power3.out' });
const toP = gsap.quickTo(cam, 'p', { duration: 1.2, ease: 'power3.out' });
const toLx = gsap.quickTo(cam, 'lx', { duration: 1.2, ease: 'power3.out' });
const toLy = gsap.quickTo(cam, 'ly', { duration: 1.2, ease: 'power3.out' });
const yawFor = () => (scrollY / innerHeight) * S.orbit * (Math.PI / 180);
const progressFor = () => Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
addEventListener('scroll', () => { toYaw(yawFor()); toP(progressFor()); }, { passive: true });
addEventListener('pointermove', e => { if (reduce) return; toLx((e.clientX / innerWidth) * 2 - 1); toLy((e.clientY / innerHeight) * 2 - 1); }, { passive: true });
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

let time = 0, last = performance.now();
const tick = now => {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  time += dt * (reduce ? 0 : 1);
  tickSharks(reduce ? 0 : dt, time);
  // from the mossy foot up into the crown, circling the bark; far enough out for the sharks to pass in front
  const p = reduce ? 0.3 : cam.p;
  const yaw = (reduce ? 0 : cam.yaw) + cam.lx * 0.18;
  const cy = 0.9 + 12.2 * smooth(0, 1, p);
  const r = (narrow ? 1.3 : 1) * (6.6 - 0.8 * smooth(0, 1, p));
  camera.position.set(Math.sin(yaw) * r, cy - cam.ly * 0.4, Math.cos(yaw) * r);
  camera.lookAt([0, cy + 1.8 - 1.2 * smooth(0.75, 1, p), 0]);
  if (trunkProg) trunkProg.uniforms.uOrig.value += (COL.trunk - trunkProg.uniforms.uOrig.value) * 0.08;
  SU.uOrig.value += (COL.shark - SU.uOrig.value) * 0.08;
  if (dustProg) dustProg.uniforms.uOrig.value += (COL.shark - dustProg.uniforms.uOrig.value) * 0.08;
  SU.uPx.value = (innerHeight * renderer.dpr) / (2 * Math.tan((45 * Math.PI) / 360));
  for (const pr of progs) { pr.uniforms.uTime.value = time; pr.uniforms.uDpr.value = renderer.dpr; }
  renderer.render({ scene, camera });
};
requestAnimationFrame(tick);

// ---------- content: every section turns in with the camera, straight in the middle, turns away ----------
let tls = [];
const build = () => {
  tls.forEach(t => { t.scrollTrigger && t.scrollTrigger.kill(); t.kill(); });
  tls = [];
  if (reduce) return;
  document.querySelectorAll('.ks-panel').forEach(panel => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: panel.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
    tl.fromTo(panel, { rotateY: S.angle, rotateX: 5, z: -220, opacity: 0.35 }, { rotateY: 0, rotateX: 0, z: 0, opacity: 1, duration: 0.7, ease: 'power2.out' })
      .to(panel, { rotateY: 0, duration: 0.6 })
      .to(panel, { rotateY: -S.angle, rotateX: -5, z: -220, opacity: 0.35, duration: 0.7, ease: 'power2.in' });
    tls.push(tl);
  });
  ST.refresh();
};
build();

// ---------- panel ----------
document.querySelectorAll('[data-set]').forEach(inp => {
  const key = inp.dataset.set, out = inp.parentElement.querySelector('output');
  inp.value = S[key];
  const show = () => { if (out) out.textContent = Number(inp.value).toFixed(['orbit', 'angle', 'count'].includes(key) ? 0 : 2); };
  show();
  inp.addEventListener('input', () => {
    S[key] = Number(inp.value); show();
    if (key === 'orbit') toYaw(yawFor()); else if (key === 'angle') build(); else if (key === 'count') spread(); else if (key === 'size') SIZE.value = S.size;
  });
});
const MODES = { puvodni: [1, 1], web: [0, 0], smisene: [1, 0] };
const modeBtns = document.querySelectorAll('[data-barvy]');
const setMode = m => {
  COL.mode = m; [COL.trunk, COL.shark] = MODES[m];
  modeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.barvy === m)));
};
modeBtns.forEach(b => b.addEventListener('click', () => setMode(b.dataset.barvy)));
setMode(COL.mode);
document.getElementById('panel-toggle').addEventListener('click', () => document.body.classList.add('panel-closed'));
document.querySelector('.lab-toggle').addEventListener('click', () => document.body.classList.remove('panel-closed'));
const copy = document.getElementById('copy');
copy.addEventListener('click', () => {
  const txt = JSON.stringify({ ...S, barvy: COL.mode });
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { copy.textContent = 'Zkopírováno ✓'; }, () => { prompt('Nastavení:', txt); });
  setTimeout(() => { copy.textContent = 'Zkopírovat nastavení'; }, 1800);
});
