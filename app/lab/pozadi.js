/* Grafysta lab: 3D background made in code (three variants), one camera that answers the cursor, the scroll and a
   "page shot" (every page of the site would look at the scene from its own angle; switching pages flies the camera).
   Sliders tune everything live. Lab only: nothing here runs on the site yet. */
import { Renderer, Camera, Transform, Program, Mesh, Geometry, Triangle, Vec3 } from 'ogl';

const gsap = window.gsap;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- settings (sliders) ----------
const S = {
  scene: 'mlha',
  cursor: 1, // how far the camera leans after the pointer
  speed: 1, // time
  density: 1, // amount of fog / shards / particles
  glow: 1, // brightness
  depth: 1, // how fast things fade into the dark
  scroll: 1, // how far the scroll carries the camera
  quality: 1, // render resolution
  colA: '#5227FF',
  colB: '#B19EEF'
};
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

// ---------- camera shots: one per page ----------
const SHOTS = {
  uvod: { p: [0, 0.3, 6.2], t: [0, 0, 0] },
  prace: { p: [4.6, 0.9, 3.4], t: [0, -0.2, -1] },
  omne: { p: [-1.4, -0.5, 2.7], t: [0.5, 0.1, -0.2] },
  detail: { p: [0.2, 5.2, 2.4], t: [0, -0.4, -0.6] }
};
const shot = { px: 0, py: 0.3, pz: 6.2, tx: 0, ty: 0, tz: 0 };
const goShot = (name, instant) => {
  const s = SHOTS[name];
  const to = { px: s.p[0], py: s.p[1], pz: s.p[2], tx: s.t[0], ty: s.t[1], tz: s.t[2] };
  if (instant || reduce || !gsap) Object.assign(shot, to);
  else gsap.to(shot, { ...to, duration: 1.8, ease: 'power3.inOut', overwrite: true });
  document.querySelectorAll('[data-shot]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.shot === name)));
};

// ---------- pointer (damped with GSAP) and scroll ----------
const ptr = { x: 0, y: 0 };
const toX = gsap ? gsap.quickTo(ptr, 'x', { duration: 1.1, ease: 'power3.out' }) : v => (ptr.x = v);
const toY = gsap ? gsap.quickTo(ptr, 'y', { duration: 1.1, ease: 'power3.out' }) : v => (ptr.y = v);
const mouse = { x: 0, y: 0 }; // raw, -1..1
addEventListener('pointermove', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -((e.clientY / innerHeight) * 2 - 1);
  if (!reduce) { toX(mouse.x); toY(mouse.y); }
}, { passive: true });
let scrollP = 0;
const onScroll = () => {
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  scrollP = Math.min(1, Math.max(0, scrollY / max));
};
addEventListener('scroll', onScroll, { passive: true });

// ---------- renderer ----------
const canvasHost = document.getElementById('bg');
const renderer = new Renderer({ dpr: Math.min(devicePixelRatio || 1, 1.5), alpha: false, antialias: false, depth: true, powerPreference: 'high-performance' });
const gl = renderer.gl;
gl.clearColor(10 / 255, 10 / 255, 10 / 255, 1);
canvasHost.appendChild(gl.canvas);
const camera = new Camera(gl, { fov: 45, near: 0.05, far: 60 });
const scene = new Transform();
const resize = () => {
  renderer.dpr = Math.min(devicePixelRatio || 1, 1.5) * S.quality * (S.scene === 'mlha' ? 0.6 : 1);
  renderer.setSize(innerWidth, innerHeight);
  camera.perspective({ aspect: innerWidth / innerHeight });
};
addEventListener('resize', resize);

const NOISE = `
float h31(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 3; i++){ s += a * vnoise(p); p = p * 2.03 + 11.7; a *= .5; } return s; }`;

// ---------- 1) Mlha: volumetric fog with depth, lit by a light that follows the pointer ----------
function makeMist() {
  const program = new Program(gl, {
    vertex: `attribute vec2 position; attribute vec2 uv; varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 0., 1.); }`,
    fragment: `precision highp float; varying vec2 vUv;
      uniform vec3 uPos, uF, uR, uU, uLight, uA, uB; uniform float uTan, uAspect, uTime, uDensity, uGlow, uDepth;
      ${NOISE}
      float dens(vec3 p){
        float n = fbm(p * .42 + vec3(0., uTime * .05, uTime * .07));
        float band = exp(-abs(p.y + .2) * .55);
        return smoothstep(.5 - .1 * uDensity, .74, n) * band;
      }
      void main(){
        vec2 q = vUv * 2. - 1.;
        vec3 rd = normalize(uF + q.x * uTan * uAspect * uR + q.y * uTan * uU);
        vec3 col = vec3(0.); float a = 0.; float t = .4;
        for (int i = 0; i < 38; i++){
          vec3 p = uPos + rd * t;
          float d = dens(p) * .26;
          if (d > .001){
            float l = exp(-length(p - uLight) * .45) * 3.2 + .18;
            vec3 c = mix(uA, uB, clamp(l * .4, 0., 1.)) * l * uGlow * 1.4;
            float fog = exp(-t * .09 * uDepth);
            col += (1. - a) * d * c * fog; a += (1. - a) * d;
          }
          t += .24 + t * .04;
          if (a > .97 || t > 22.) break;
        }
        float g = (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))) - .5) / 255.;
        gl_FragColor = vec4(vec3(.039) * (1. - a) + col + g, 1.);
      }`,
    uniforms: { uPos: { value: new Vec3() }, uF: { value: new Vec3() }, uR: { value: new Vec3() }, uU: { value: new Vec3() }, uLight: { value: new Vec3() },
      uA: { value: hex(S.colA) }, uB: { value: hex(S.colB) }, uTan: { value: 0.414 }, uAspect: { value: 1 }, uTime: { value: 0 }, uDensity: { value: 1 }, uGlow: { value: 1 }, uDepth: { value: 1 } },
    depthTest: false, depthWrite: false
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
  return {
    root: mesh, fullscreen: true,
    update(time, cam, light) {
      const u = program.uniforms;
      u.uPos.value.copy(cam.pos); u.uF.value.copy(cam.f); u.uR.value.copy(cam.r); u.uU.value.copy(cam.u); u.uLight.value.copy(light);
      u.uTan.value = Math.tan((camera.fov * Math.PI) / 360); u.uAspect.value = innerWidth / innerHeight;
      u.uTime.value = time; u.uDensity.value = S.density; u.uGlow.value = S.glow; u.uDepth.value = S.depth;
      u.uA.value = hex(S.colA); u.uB.value = hex(S.colB);
    }
  };
}

// ---------- 2) Střepy: floating glass shards, light rims that catch the pointer light ----------
function makeShards() {
  // a thin crystal: stretched octahedron, flat-shaded
  const V = [[0, 1.25, 0], [0, -1.25, 0], [0.5, 0, 0], [-0.5, 0, 0], [0, 0, 0.13], [0, 0, -0.13]];
  const F = [[0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]];
  const pos = [], nor = [];
  for (const [a, b, c] of F) {
    const A = new Vec3(...V[a]), B = new Vec3(...V[b]), C = new Vec3(...V[c]);
    const n = new Vec3().sub(B, A).cross(new Vec3().sub(C, A)).normalize();
    for (const P of [A, B, C]) { pos.push(P.x, P.y, P.z); nor.push(n.x, n.y, n.z); }
  }
  const N = 260, off = [], rnd = [];
  for (let i = 0; i < N; i++) {
    off.push((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 7, -Math.random() * 16 + 3);
    rnd.push(Math.random(), Math.random(), Math.random(), 0.12 + Math.random() * 0.28);
  }
  const geometry = new Geometry(gl, {
    position: { size: 3, data: new Float32Array(pos) }, normal: { size: 3, data: new Float32Array(nor) },
    offset: { instanced: 1, size: 3, data: new Float32Array(off) }, rnd: { instanced: 1, size: 4, data: new Float32Array(rnd) }
  });
  const program = new Program(gl, {
    vertex: `attribute vec3 position, normal, offset; attribute vec4 rnd;
      uniform mat4 modelViewMatrix, projectionMatrix, viewMatrix; uniform float uTime, uCount;
      varying vec3 vN, vW; varying float vD, vHide;
      vec3 rot(vec3 v, vec3 k, float a){ return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1. - cos(a)); }
      void main(){
        vec3 k = normalize(vec3(rnd.x - .5, rnd.y - .5, rnd.z - .5) + .001);
        float a = uTime * (.15 + rnd.z * .35) + rnd.x * 6.28;
        vec3 p = rot(position * rnd.w * 1.6, k, a);
        vN = rot(normal, k, a);
        vec3 o = offset + vec3(sin(uTime * .3 + rnd.y * 6.) * .25, sin(uTime * .4 + rnd.x * 6.) * .35, 0.);
        vec4 w = vec4(p + o, 1.);
        vW = w.xyz;
        vec4 mv = viewMatrix * w;
        vD = -mv.z;
        vHide = step(uCount, rnd.y);
        gl_Position = projectionMatrix * mv;
      }`,
    fragment: `precision highp float; varying vec3 vN, vW; varying float vD, vHide;
      uniform vec3 uCam, uLight, uA, uB; uniform float uGlow, uDepth;
      void main(){
        if (vHide > .5) discard;
        vec3 n = normalize(vN), v = normalize(uCam - vW), l = normalize(uLight - vW);
        float fr = pow(1. - abs(dot(n, v)), 2.2);
        float sp = pow(max(dot(reflect(-l, n), v), 0.), 24.) * 1.4;
        float near = exp(-length(uLight - vW) * .35);
        vec3 c = uA * (.10 + .25 * near) + mix(uA, uB, fr) * fr * (.7 + near) + vec3(1.) * sp * (.4 + near);
        float fog = exp(-max(vD - 2., 0.) * .085 * uDepth);
        gl_FragColor = vec4(c * uGlow * fog, 1.);
      }`,
    uniforms: { uTime: { value: 0 }, uCount: { value: 1 }, uCam: { value: new Vec3() }, uLight: { value: new Vec3() }, uA: { value: hex(S.colA) }, uB: { value: hex(S.colB) }, uGlow: { value: 1 }, uDepth: { value: 1 } },
    transparent: true, depthTest: false, depthWrite: false, cullFace: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE);
  const mesh = new Mesh(gl, { geometry, program, frustumCulled: false });
  return {
    root: mesh,
    update(time, cam, light) {
      const u = program.uniforms;
      u.uTime.value = time; u.uCount.value = Math.min(1, 0.35 * S.density); u.uCam.value.copy(cam.pos); u.uLight.value.copy(light);
      u.uGlow.value = S.glow; u.uDepth.value = S.depth; u.uA.value = hex(S.colA); u.uB.value = hex(S.colB);
    }
  };
}

// ---------- 3) Částice: a breathing field of light points, rippling under the pointer ----------
function makeField() {
  const W = 220, H = 160, data = new Float32Array(W * H * 3);
  for (let j = 0, k = 0; j < H; j++) for (let i = 0; i < W; i++, k += 3) {
    data[k] = (i / (W - 1) - 0.5) * 22 + (Math.random() - 0.5) * 0.04;
    data[k + 1] = Math.random();
    data[k + 2] = -(j / (H - 1)) * 18 + 4 + (Math.random() - 0.5) * 0.04;
  }
  const geometry = new Geometry(gl, { position: { size: 3, data } });
  const program = new Program(gl, {
    vertex: `attribute vec3 position; uniform mat4 viewMatrix, projectionMatrix; uniform float uTime, uSize, uCount, uDpr; uniform vec3 uHit; uniform float uRipple;
      varying float vH, vD, vHide;
      void main(){
        vec3 p = vec3(position.x, -1.2, position.z);
        float t = uTime * .35;
        p.y += sin(p.x * .45 + t) * .35 + sin(p.z * .6 - t * 1.3) * .28 + sin((p.x + p.z) * .9 + t * .7) * .12;
        float d = distance(p.xz, uHit.xz);
        p.y += uRipple * exp(-d * d * .18) * (.55 + .25 * sin(d * 3.2 - uTime * 3.));
        vH = p.y;
        vHide = step(uCount, position.y);
        vec4 mv = viewMatrix * vec4(p, 1.);
        vD = -mv.z;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uDpr * (6. / max(vD, .5));
      }`,
    fragment: `precision highp float; varying float vH, vD, vHide; uniform vec3 uA, uB; uniform float uGlow, uDepth;
      void main(){
        if (vHide > .5) discard;
        vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
        float soft = smoothstep(.25, 0., r);
        vec3 col = mix(uA, uB, clamp(vH * .7 + .55, 0., 1.)) * (.7 + 1.1 * clamp(vH + .6, 0., 1.4));
        float fog = exp(-max(vD - 2., 0.) * .07 * uDepth);
        gl_FragColor = vec4(col * soft * fog * uGlow, 1.);
      }`,
    uniforms: { uTime: { value: 0 }, uSize: { value: 2 }, uCount: { value: 1 }, uDpr: { value: 1 }, uHit: { value: new Vec3(0, 0, -100) }, uRipple: { value: 0 },
      uA: { value: hex(S.colA) }, uB: { value: hex(S.colB) }, uGlow: { value: 1 }, uDepth: { value: 1 } },
    transparent: true, depthTest: false, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE);
  const mesh = new Mesh(gl, { geometry, program, mode: gl.POINTS, frustumCulled: false });
  const hit = new Vec3(0, -1.2, -100), ripple = { v: 0 };
  return {
    root: mesh,
    update(time, cam, light, ray) {
      // where the pointer ray meets the field (y = -1.2)
      if (ray.dir.y < -0.02) {
        const k = (-1.2 - ray.origin.y) / ray.dir.y;
        hit.set(ray.origin.x + ray.dir.x * k, -1.2, ray.origin.z + ray.dir.z * k);
        ripple.v += (1 - ripple.v) * 0.05;
      } else ripple.v *= 0.95;
      const u = program.uniforms;
      u.uTime.value = time; u.uCount.value = Math.min(1, 0.45 * S.density); u.uDpr.value = renderer.dpr; u.uSize.value = 4.2;
      u.uHit.value.copy(hit); u.uRipple.value = reduce ? 0 : ripple.v * S.cursor;
      u.uGlow.value = S.glow * 1.6; u.uDepth.value = S.depth; u.uA.value = hex(S.colA); u.uB.value = hex(S.colB);
    }
  };
}


// ---------- 4) Obraz: particles that form a picture (the GRAFYSTA wordmark, a Doe & Deer illustration) ----------
// Points are sampled from a picture drawn into a 2D canvas: the wordmark's letters, or the "ink" of an illustration
// (everything that is not the white paper). Brighter ink sits closer to the camera, so the picture has depth when the
// camera leans. The pointer blows the points aside; switching pictures flies every point to its new place.
const IMG = { mix: 0, orig: false };
let imgProgram = null;
const COUNT = 40000;
async function samplePictures() {
  const pick = (weights, w, h, n) => {
    // pixel indices drawn in proportion to their weight
    const cdf = new Float32Array(weights.length); let s = 0;
    for (let i = 0; i < weights.length; i++) { s += weights[i]; cdf[i] = s; }
    const out = new Uint32Array(n);
    for (let k = 0; k < n; k++) {
      const r = Math.random() * s; let lo = 0, hi = cdf.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < r) lo = m + 1; else hi = m; }
      out[k] = lo;
    }
    return out;
  };
  // A: the wordmark
  try { await document.fonts.load('400 200px "Odibee Sans CZ"'); } catch (e) {}
  const cw = 1400, ch = 380, c1 = document.createElement('canvas'); c1.width = cw; c1.height = ch;
  const x1 = c1.getContext('2d', { willReadFrequently: true });
  x1.fillStyle = '#fff'; x1.textAlign = 'center'; x1.textBaseline = 'middle';
  x1.font = '400 300px "Odibee Sans CZ", "Odibee Sans", "Arial Narrow", sans-serif';
  x1.fillText('GRAFYSTA', cw / 2, ch / 2 + 12);
  const d1 = x1.getImageData(0, 0, cw, ch).data, w1 = new Float32Array(cw * ch);
  for (let i = 0; i < w1.length; i++) w1[i] = d1[i * 4 + 3] > 128 ? 1 : 0;
  const s1 = pick(w1, cw, ch, COUNT);
  const A = new Float32Array(COUNT * 3), CA = new Float32Array(COUNT * 3);
  for (let k = 0; k < COUNT; k++) {
    const i = s1[k], x = (i % cw) + Math.random(), y = Math.floor(i / cw) + Math.random();
    A[k * 3] = (x / cw - 0.5) * 8; A[k * 3 + 1] = -(y / ch - 0.5) * (8 * ch / cw); A[k * 3 + 2] = (Math.random() - 0.5) * 0.35;
    CA[k * 3] = CA[k * 3 + 1] = CA[k * 3 + 2] = 0.75 + Math.random() * 0.25;
  }
  // B: the illustration (its ink, the white paper left out)
  const img = new Image(); img.src = '/prace/dd-sirup/obal.webp'; await img.decode();
  const iw = 420, ih = 420, c2 = document.createElement('canvas'); c2.width = iw; c2.height = ih;
  const x2 = c2.getContext('2d', { willReadFrequently: true }); x2.drawImage(img, 0, 0, iw, ih);
  const d2 = x2.getImageData(0, 0, iw, ih).data, w2 = new Float32Array(iw * ih), L = new Float32Array(iw * ih);
  for (let i = 0; i < L.length; i++) L[i] = (0.299 * d2[i * 4] + 0.587 * d2[i * 4 + 1] + 0.114 * d2[i * 4 + 2]) / 255;
  for (let y = 1; y < ih - 1; y++) for (let x = 1; x < iw - 1; x++) {
    const i = y * iw + x, r = d2[i * 4], g = d2[i * 4 + 1], b = d2[i * 4 + 2];
    const ink = Math.max(1 - L[i], (Math.max(r, g, b) - Math.min(r, g, b)) / 255); // dark or coloured = ink, white paper = nothing
    // outlines (Sobel) get extra points, so eyes, bottle and edges read clearly
    const gx = L[i - iw + 1] + 2 * L[i + 1] + L[i + iw + 1] - L[i - iw - 1] - 2 * L[i - 1] - L[i + iw - 1];
    const gy = L[i + iw - 1] + 2 * L[i + iw] + L[i + iw + 1] - L[i - iw - 1] - 2 * L[i - iw] - L[i - iw + 1];
    w2[i] = ink > 0.16 ? Math.pow(ink, 1.2) * 0.6 + Math.min(1, Math.hypot(gx, gy) * 1.6) * 1.4 : 0;
  }
  const s2 = pick(w2, iw, ih, COUNT);
  const B = new Float32Array(COUNT * 3), CB = new Float32Array(COUNT * 3);
  for (let k = 0; k < COUNT; k++) {
    const i = s2[k], x = (i % iw) + Math.random(), y = Math.floor(i / iw) + Math.random();
    const r = d2[i * 4] / 255, g = d2[i * 4 + 1] / 255, b = d2[i * 4 + 2] / 255, lum = 0.299 * r + 0.587 * g + 0.114 * b;
    B[k * 3] = (x / iw - 0.5) * 4.4; B[k * 3 + 1] = -(y / ih - 0.5) * 4.4; B[k * 3 + 2] = (0.6 - lum) * 1.1 + (Math.random() - 0.5) * 0.12;
    CB[k * 3] = r; CB[k * 3 + 1] = g; CB[k * 3 + 2] = b;
  }
  // pair points left to right in both pictures, so the swarm flows across instead of criss-crossing
  const order = arr => Array.from({ length: COUNT }, (_, k) => k).sort((p, q) => arr[p * 3] - arr[q * 3]);
  const oa = order(A), ob = order(B);
  const remap = (src, o, n) => { const out = new Float32Array(COUNT * n); o.forEach((k, j) => { for (let c = 0; c < n; c++) out[j * n + c] = src[k * n + c]; }); return out; };
  return { A: remap(A, oa, 3), CA: remap(CA, oa, 3), B: remap(B, ob, 3), CB: remap(CB, ob, 3) };
}
function makePicture() {
  const rnd = new Float32Array(COUNT * 4);
  for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random();
  const zero = new Float32Array(COUNT * 3);
  const geometry = new Geometry(gl, {
    position: { size: 3, data: zero }, aB: { size: 3, data: new Float32Array(COUNT * 3) },
    aCA: { size: 3, data: new Float32Array(COUNT * 3) }, aCB: { size: 3, data: new Float32Array(COUNT * 3) }, aR: { size: 4, data: rnd }
  });
  const program = new Program(gl, {
    vertex: `attribute vec3 position, aB, aCA, aCB; attribute vec4 aR;
      uniform mat4 viewMatrix, projectionMatrix; uniform float uTime, uMix, uSize, uDpr, uCount, uPush, uScale, uOrig, uReady;
      uniform vec3 uRo, uRd, uA, uB;
      varying vec3 vC; varying float vD, vHide;
      void main(){
        // each point leaves a little later than its neighbour and flies an arc
        float m = smoothstep(0., 1., clamp(uMix * 1.5 - aR.x * .5, 0., 1.));
        vec3 p = mix(position, aB, m);
        p += (aR.yzw - .5) * vec3(2.6, 2.2, 3.2) * sin(3.14159 * m);
        p *= uScale;
        // breathing, and the swarm gathers in when the page opens
        p += .025 * vec3(sin(uTime * 1.3 + aR.x * 6.28), sin(uTime * 1.1 + aR.y * 6.28), sin(uTime * .9 + aR.z * 6.28));
        p = mix((aR.xyz - .5) * vec3(14., 9., 10.), p, uReady);
        // the pointer blows the points aside (distance from the pointer ray)
        vec3 rel = p - uRo; float along = dot(rel, uRd); vec3 off = rel - uRd * along; float d = length(off);
        p += normalize(off + 1e-4) * uPush * exp(-d * d * 2.2) * (.6 + .6 * aR.y);
        vec3 brand = mix(uA, uB, clamp(aR.w * .6 + (1. - m) * .3 + dot(aCB, vec3(.3, .59, .11)) * m * .6, 0., 1.));
        vec3 own = mix(aCA * mix(uA, uB, aR.w), aCB, m);
        vC = mix(brand * 1.25, own * 1.5, uOrig);
        vHide = step(uCount, aR.z);
        vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uDpr * (6. / max(vD, .5));
      }`,
    fragment: `precision highp float; varying vec3 vC; varying float vD, vHide; uniform float uGlow, uDepth;
      void main(){
        if (vHide > .5) discard;
        vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
        float fog = exp(-max(vD - 3., 0.) * .08 * uDepth);
        gl_FragColor = vec4(vC * smoothstep(.25, .0, r) * fog * uGlow * .62, 1.);
      }`,
    uniforms: { uTime: { value: 0 }, uMix: { value: 0 }, uSize: { value: 2.3 }, uDpr: { value: 1 }, uCount: { value: 1 }, uPush: { value: 0 }, uScale: { value: 1 },
      uOrig: { value: 0 }, uReady: { value: 0 }, uRo: { value: new Vec3() }, uRd: { value: new Vec3(0, 0, -1) },
      uA: { value: hex(S.colA) }, uB: { value: hex(S.colB) }, uGlow: { value: 1 }, uDepth: { value: 1 } },
    transparent: true, depthTest: false, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE);
  imgProgram = program;
  const mesh = new Mesh(gl, { geometry, program, mode: gl.POINTS, frustumCulled: false });
  const ready = { v: 0 }, orig = { v: IMG.orig ? 1 : 0 };
  samplePictures().then(P => {
    geometry.updateAttribute(Object.assign(geometry.attributes.position, { data: P.A }));
    geometry.updateAttribute(Object.assign(geometry.attributes.aB, { data: P.B }));
    geometry.updateAttribute(Object.assign(geometry.attributes.aCA, { data: P.CA }));
    geometry.updateAttribute(Object.assign(geometry.attributes.aCB, { data: P.CB }));
    if (gsap && !reduce) gsap.to(ready, { v: 1, duration: 2.4, ease: 'power3.out' }); else ready.v = 1;
  });
  return {
    root: mesh,
    update(time, cam, light, ray) {
      const u = program.uniforms;
      // keep the picture inside the screen width (phones)
      const tn = Math.tan((camera.fov * Math.PI) / 360), dist = cam.pos.len();
      const visW = 2 * tn * dist * (innerWidth / innerHeight);
      u.uScale.value = Math.min(1, (visW * 0.86) / (8 + (4.4 - 8) * IMG.mix));
      orig.v += ((IMG.orig ? 1 : 0) - orig.v) * 0.08;
      u.uTime.value = time; u.uMix.value = IMG.mix; u.uDpr.value = renderer.dpr; u.uCount.value = Math.min(1, 0.4 * S.density);
      u.uPush.value = reduce ? 0 : 0.9 * S.cursor; u.uRo.value.copy(ray.origin); u.uRd.value.copy(ray.dir);
      u.uOrig.value = orig.v; u.uReady.value = ready.v;
      u.uGlow.value = S.glow; u.uDepth.value = S.depth; u.uA.value = hex(S.colA); u.uB.value = hex(S.colB);
    }
  };
}
const setPicture = (name, instant) => {
  const to = name === 'ilustrace' ? 1 : 0;
  if (instant || reduce || !gsap) IMG.mix = to;
  else gsap.to(IMG, { mix: to, duration: 2.6, ease: 'power2.inOut', overwrite: true });
  document.querySelectorAll('[data-img]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.img === name)));
};

const MAKERS = { mlha: makeMist, strepy: makeShards, castice: makeField, obraz: makePicture };
let current = null;
const setScene = name => {
  S.scene = name;
  if (current) current.root.setParent(null);
  current = MAKERS[name]();
  current.root.setParent(scene);
  document.querySelectorAll('[data-scene]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scene === name)));
  document.body.classList.toggle('is-obraz', name === 'obraz');
  resize();
};

// ---------- the frame ----------
const cam = { pos: new Vec3(), f: new Vec3(), r: new Vec3(), u: new Vec3() };
const light = new Vec3(), ray = { origin: new Vec3(), dir: new Vec3() }, UP = new Vec3(0, 1, 0);
let time = 0, last = performance.now(), frames = 0, fpsT = last;
const fpsEl = document.getElementById('fps');
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  time += dt * S.speed * (reduce ? 0.15 : 1);

  // base shot → scroll dolly/orbit → pointer lean
  const target = new Vec3(shot.tx, shot.ty, shot.tz);
  const off = new Vec3(shot.px - shot.tx, shot.py - shot.ty, shot.pz - shot.tz);
  const dist = off.len();
  const yaw = Math.atan2(off.x, off.z) + scrollP * 0.6 * S.scroll + ptr.x * 0.22 * S.cursor;
  const pitch = Math.asin(Math.max(-0.99, Math.min(0.99, off.y / dist))) - ptr.y * 0.12 * S.cursor;
  const r = dist * (1 - scrollP * 0.35 * S.scroll);
  cam.pos.set(target.x + Math.sin(yaw) * Math.cos(pitch) * r, target.y + Math.sin(pitch) * r, target.z + Math.cos(yaw) * Math.cos(pitch) * r);
  camera.position.copy(cam.pos);
  camera.lookAt(target);
  cam.f.sub(target, cam.pos).normalize();
  cam.r.cross(cam.f, UP).normalize();
  cam.u.cross(cam.r, cam.f).normalize();

  // the pointer as a ray from the camera; the light sits on it, at the target's depth
  const tn = Math.tan((camera.fov * Math.PI) / 360), asp = innerWidth / innerHeight;
  ray.origin.copy(cam.pos);
  ray.dir.copy(cam.f).add(new Vec3().copy(cam.r).scale(mouse.x * tn * asp)).add(new Vec3().copy(cam.u).scale(mouse.y * tn)).normalize();
  light.copy(ray.dir).scale(r * 0.8).add(cam.pos);

  current.update(time, cam, light, ray);
  renderer.render({ scene, camera });

  frames++;
  if (now - fpsT > 1000) { if (fpsEl) fpsEl.textContent = `${frames} fps`; frames = 0; fpsT = now; }
}

// ---------- panel ----------
document.querySelectorAll('[data-scene]').forEach(b => b.addEventListener('click', () => setScene(b.dataset.scene)));
document.querySelectorAll('[data-shot]').forEach(b => b.addEventListener('click', () => {
  goShot(b.dataset.shot);
  if (S.scene === 'obraz' && (b.dataset.shot === 'uvod' || b.dataset.shot === 'prace')) setPicture(b.dataset.shot === 'uvod' ? 'napis' : 'ilustrace');
}));
document.querySelectorAll('[data-img]').forEach(b => b.addEventListener('click', () => setPicture(b.dataset.img)));
const origBtn = document.getElementById('orig');
if (origBtn) origBtn.addEventListener('click', () => { IMG.orig = !IMG.orig; origBtn.setAttribute('aria-pressed', String(IMG.orig)); });
document.querySelectorAll('[data-set]').forEach(inp => {
  const key = inp.dataset.set, out = inp.parentElement.querySelector('output');
  const apply = () => {
    S[key] = inp.type === 'color' ? inp.value : Number(inp.value);
    if (out) out.textContent = inp.type === 'color' ? inp.value : Number(inp.value).toFixed(2);
    if (key === 'quality') resize();
  };
  inp.addEventListener('input', apply);
  apply();
});
const copy = document.getElementById('copy');
if (copy) copy.addEventListener('click', () => {
  const txt = JSON.stringify(S);
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { copy.textContent = 'Zkopírováno ✓'; }, () => { prompt('Nastavení:', txt); });
  setTimeout(() => { copy.textContent = 'Zkopírovat nastavení'; }, 1800);
});
const toggle = document.getElementById('content-toggle');
if (toggle) toggle.addEventListener('click', () => {
  const on = document.body.classList.toggle('no-content');
  toggle.setAttribute('aria-pressed', String(!on));
});
const panelBtn = document.getElementById('panel-toggle');
if (panelBtn) panelBtn.addEventListener('click', () => {
  const open = document.body.classList.toggle('panel-closed');
  panelBtn.setAttribute('aria-expanded', String(!open));
});

const startScene = new URLSearchParams(location.search).get('s');
setScene(MAKERS[startScene] ? startScene : 'obraz');
goShot('uvod', true);
onScroll();
requestAnimationFrame(frame);
