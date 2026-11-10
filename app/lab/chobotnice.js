/* Grafysta lab: the octopus down the whole page.
   The octopus from the user's drawing, made of particles in 3D: chobotnice-pole.png holds, for every pixel of the
   drawing, how far it is from the middle of the mantle along the body (s: 0 mantle … 1 tips of the arms), which way
   the arm runs there, and how thick the body is there (round tubes for the arms, a dome for the mantle); the points
   sit on the front and back of that volume and take their tone from the drawing (white skin, black spots).
   Motion: waves run down every arm from its root to its tip and the tips curl; every few seconds it pulses as if
   swimming (the mantle squeezes, the arms draw in, the whole body lifts), then slowly opens again; the arms also
   spread out into depth, so it reads in 3D from the side. Scrolling stirs it up.
   The camera travels down the octopus as the page scrolls, from the mantle to the tips, swaying round it (GSAP); the
   content sections turn with the camera (CSS 3D, ScrollTrigger), as in the camera lab. */
import { Renderer, Camera, Transform, Program, Mesh, Geometry } from 'ogl';

const gsap = window.gsap, ST = window.ScrollTrigger;
gsap.registerPlugin(ST);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = innerWidth < 760;

const S = {
  orbit: 140, // how far the camera swings round the octopus over the page (deg)
  angle: 16, // how far a section is turned when it comes in / leaves (deg)
  wave: 1, // arm waves
  speed: 1, // speed of all its motion
  pulse: 1, // the swimming pulse
  spread: 1, // arms spread into depth
  boost: 1.5, // how much the scroll stirs it up
  size: 1 // particle size
};
const COL = { orig: 0 };

// ---------- renderer ----------
const host = document.getElementById('bg');
const renderer = new Renderer({ dpr: Math.min(devicePixelRatio || 1, 1.5), alpha: false, antialias: false, depth: false });
const gl = renderer.gl;
gl.clearColor(10 / 255, 10 / 255, 10 / 255, 1);
host.appendChild(gl.canvas);
const FOV = 45;
const camera = new Camera(gl, { fov: FOV, near: 0.05, far: 120 });
const scene = new Transform();
const VIOLET = [82 / 255, 39 / 255, 1], LILAC = [177 / 255, 158 / 255, 239 / 255];
const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.perspective({ aspect: innerWidth / innerHeight }); };
addEventListener('resize', resize); resize();
const SIZE = { value: S.size };
const progs = [];

// the drawing in the world: 1288 px (half of the original) = 24 units high, centred
const IW = 595, IH = 1288, SC = 24 / IH, HMAX = 120; // HMAX: the thickest half of the body in px
const MANTLE = [(285 - IW / 2) * SC, (IH / 2 - 155) * SC]; // the middle of the mantle

// ---------- dust: a slow cloud of faint points around the octopus ----------
let dustProg = null;
(function dust() {
  const N = narrow ? 2500 : 5000, pos = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    const r = 3 + Math.random() * 13, a = Math.random() * Math.PI * 2;
    pos[k * 3] = Math.cos(a) * r; pos[k * 3 + 1] = Math.random() * 30 - 15; pos[k * 3 + 2] = Math.sin(a) * r;
  }
  const program = new Program(gl, {
    vertex: `attribute vec3 position; uniform mat4 viewMatrix, projectionMatrix; uniform float uTime, uDpr, uSize, uOrig; uniform vec3 uA, uB; varying vec3 vC; varying float vD;
      void main(){ vec3 p = position; p.y += sin(uTime * .2 + p.x) * .3; p.x += cos(uTime * .15 + p.z) * .3;
        vC = mix(mix(uA, uB, fract(position.x * 3.7)), vec3(.7) * (.6 + .5 * fract(position.z * 5.3)), uOrig) * .35;
        vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; gl_PointSize = 2.6 * uDpr * uSize * (6. / max(vD, .5)); }`,
    fragment: `precision highp float; varying vec3 vC; varying float vD;
      void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
        gl_FragColor = vec4(vC * smoothstep(.25, 0., r) * exp(-max(vD - 6., 0.) * .06), 1.); }`,
    uniforms: { uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uSize: SIZE, uOrig: { value: 0 }, uA: { value: VIOLET }, uB: { value: LILAC } },
    transparent: true, depthTest: false, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE);
  dustProg = program;
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: pos } }), program, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
  progs.push(program);
})();

// ---------- the octopus ----------
const OU = {
  uTime: { value: 0 }, uPhase: { value: 0 }, uDpr: { value: renderer.dpr }, uPx: { value: 1 }, uSp: { value: 0.03 }, uSize: SIZE, uOrig: { value: 0 },
  uWave: { value: S.wave }, uPulse: { value: 0 }, uSpread: { value: S.spread }, uStir: { value: 0 }, uMantle: { value: MANTLE },
  uA: { value: VIOLET }, uB: { value: LILAC }
};
const octoProg = new Program(gl, {
  vertex: /* glsl */ `#version 300 es
    in vec4 position; // x, y, z (front or back of the body), random
    in vec4 aBody;    // s (0 mantle … 1 tips), arm direction (x, y), tone of the drawing
    uniform mat4 viewMatrix, projectionMatrix; uniform vec3 cameraPosition;
    uniform float uTime, uPhase, uDpr, uPx, uSp, uSize, uOrig, uWave, uPulse, uSpread, uStir; uniform vec2 uMantle; uniform vec3 uA, uB;
    out vec3 vC; out float vA; out float vD;
    void main() {
      vec3 p = position.xyz; float r = position.w;
      float s = aBody.x, L = aBody.w;
      vec2 tang = aBody.yz, perp = vec2(-tang.y, tang.x);
      float arm = smoothstep(.24, .42, s);           // 0 on the mantle and the web, 1 along the arms
      float sn = clamp((s - .24) / .76, 0., 1.);       // along the arm: 0 root … 1 tip
      vec2 c = vec2(uMantle.x, 0.);

      // the pulse: the mantle squeezes, the arms draw in towards the body's axis, the body lifts
      float mantle = 1. - smoothstep(.12, .26, s);
      p.xy = mix(p.xy, uMantle + (p.xy - uMantle) * (1. - .05 * uPulse), mantle);
      p.x = c.x + (p.x - c.x) * (1. - .14 * uPulse * arm);
      p.z *= 1. - .1 * uPulse * arm;

      // the arms spread into depth: they curve back at the sides and fan out front and back as they grow longer
      p.z += uSpread * arm * (s - .24) * 5.5 * sin(p.x * .85 + .6);
      p.z -= uSpread * .06 * p.x * p.x * arm;

      // waves run down every arm from the root to the tip, sideways and in depth; the tips curl
      float amp = uWave * pow(sn, 1.3) * 1.7 * (1. + uStir * .6);
      float ph = uPhase - s * 17. + p.x * .45;
      p.xy += perp * amp * sin(ph);
      p.z += amp * .9 * cos(ph * .9 + 1.3);
      float curl = amp * .45 * smoothstep(.62, 1., sn);
      p.xy += perp * curl * sin(ph * 2.3 + 1.);
      p.z += curl * cos(ph * 2.1);

      // the whole body bobs slowly and lifts with every pulse
      p.y += sin(uTime * .35) * .3 + uPulse * .45;
      p += .012 * vec3(sin(uTime * 1.3 + r * 40.), sin(uTime * 1.1 + r * 60.), sin(uTime * .9 + r * 80.));

      vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z;
      gl_Position = projectionMatrix * mv;
      // original: white skin, the black spots and outline are gaps; site colours: skin lilac → white, spots deep violet
      float skin = smoothstep(.2, .82, L);
      // (the black of the drawing still shows as a body: deep violet / dark grey; the skin is light)
      vec3 orig = mix(vec3(.3), vec3(pow(L, 1.2)) * 1.05, skin);
      vec3 brand = mix(uA * 1.05, mix(uB, vec3(1.), .4), skin);
      vC = mix(brand, orig, uOrig) * (.75 + .5 * r);
      vA = mix(.5 + .4 * skin, .32 + .6 * skin, uOrig);
      // the far side of the body is hidden behind the near one (otherwise its skin fills the spots in front)
      float facing = sign(position.z) * normalize(cameraPosition - p).z;
      vA *= mix(.08, 1., smoothstep(-.15, .25, facing));
      gl_PointSize = clamp(1.5 * uSize * uSp * uPx / max(vD, .2), 1., 8. * uDpr * max(uSize, .4));
    }`,
  fragment: /* glsl */ `#version 300 es
    precision highp float; in vec3 vC; in float vA; in float vD; out vec4 o;
    void main() { vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
      o = vec4(vC * vA * smoothstep(.25, .02, r) * exp(-max(vD - 12., 0.) * .05), 1.); }`,
  uniforms: OU, transparent: true, depthTest: false, depthWrite: false
});
octoProg.setBlendFunc(gl.ONE, gl.ONE);
progs.push(octoProg);

const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const pixels = img => {
  const cv = document.createElement('canvas'); cv.width = IW; cv.height = IH;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0, IW, IH);
  return cx.getImageData(0, 0, IW, IH).data;
};
Promise.all([load('/lab/chobotnice/chobotnice-pole.png'), load('/lab/chobotnice/chobotnice.webp')]).then(([fieldImg, toneImg]) => {
  const F = pixels(fieldImg), T = pixels(toneImg);
  const inside = [];
  for (let i = 0; i < IW * IH; i++) if (F[i * 4 + 2] > 0) inside.push(i);
  const N = narrow ? 90000 : 180000;
  const pos = new Float32Array(N * 4), body = new Float32Array(N * 4);
  for (let k = 0; k < N; k++) {
    const i = inside[(Math.random() * inside.length) | 0];
    const x = (i % IW) + Math.random(), y = Math.floor(i / IW) + Math.random();
    const s = (F[i * 4] - 1) / 254, ang = (F[i * 4 + 1] / 255) * Math.PI, h = ((F[i * 4 + 2] - 1) / 254) * HMAX;
    // most points on the front or back of the body, a few inside it
    const side = Math.random() < 0.5 ? 1 : -1, depth = Math.random() < 0.85 ? 1 : Math.random();
    pos[k * 4] = (x - IW / 2) * SC; pos[k * 4 + 1] = (IH / 2 - y) * SC; pos[k * 4 + 2] = side * depth * h * SC * 0.85; pos[k * 4 + 3] = Math.random();
    body[k * 4] = s; body[k * 4 + 1] = Math.cos(ang); body[k * 4 + 2] = -Math.sin(ang); body[k * 4 + 3] = T[i * 4] / 255;
  }
  OU.uSp.value = Math.sqrt((inside.length * SC * SC * 2) / N);
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: pos }, aBody: { size: 4, data: body } }), program: octoProg, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
});

// ---------- scroll stirs it up ----------
const stir = { v: 0 };
const toStir = gsap.quickTo(stir, 'v', { duration: 0.9, ease: 'power2.out' });
let lastY = scrollY, lastT = performance.now(), quiet = 0;
addEventListener('scroll', () => {
  const now = performance.now(), v = (Math.abs(scrollY - lastY) / Math.max(1, now - lastT)) * 1000 / innerHeight;
  lastY = scrollY; lastT = now;
  toStir(Math.min(1, v / 1.5));
  clearTimeout(quiet); quiet = setTimeout(() => toStir(0), 120);
}, { passive: true });

// ---------- camera: down the octopus with the scroll, swaying round it, leaning after the pointer ----------
const cam = { p: 0, lx: 0, ly: 0 };
const toP = gsap.quickTo(cam, 'p', { duration: 1.2, ease: 'power3.out' });
const toLx = gsap.quickTo(cam, 'lx', { duration: 1.2, ease: 'power3.out' });
const toLy = gsap.quickTo(cam, 'ly', { duration: 1.2, ease: 'power3.out' });
const progressFor = () => Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
addEventListener('scroll', () => toP(progressFor()), { passive: true });
addEventListener('pointermove', e => { if (reduce) return; toLx((e.clientX / innerWidth) * 2 - 1); toLy((e.clientY / innerHeight) * 2 - 1); }, { passive: true });
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

let time = 0, phase = 0, last = performance.now();
const tick = now => {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const go = reduce ? 0 : dt * S.speed;
  time += go;
  phase += go * 1.1 * (1 + stir.v * S.boost);
  // the swimming pulse: a quick squeeze every ~5 s, then it slowly opens again
  const pulse = Math.pow(0.5 + 0.5 * Math.sin((time * Math.PI * 2) / 5), 4) * S.pulse;
  // from the mantle down to the tips of the arms, swinging round it: front at the top, then side to side
  const p = reduce ? 0.2 : cam.p;
  const yaw = ((S.orbit * Math.PI) / 180) * 0.5 * Math.sin(p * Math.PI * 1.5) + cam.lx * 0.2;
  const cy = 8.6 - 18 * smooth(0, 1, p);
  const r = (narrow ? 15 : 10.5) * (1 - 0.12 * Math.sin(p * Math.PI));
  camera.position.set(Math.sin(yaw) * r, cy + 1.2 - cam.ly * 0.6, Math.cos(yaw) * r);
  camera.lookAt([0, cy, 0]);
  OU.uTime.value = time; OU.uPhase.value = phase; OU.uPulse.value = pulse; OU.uStir.value = stir.v * S.boost;
  OU.uWave.value = S.wave; OU.uSpread.value = S.spread;
  OU.uPx.value = (innerHeight * renderer.dpr) / (2 * Math.tan((FOV * Math.PI) / 360));
  OU.uOrig.value += (COL.orig - OU.uOrig.value) * 0.08;
  if (dustProg) dustProg.uniforms.uOrig.value = OU.uOrig.value;
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
  const show = () => { if (out) out.textContent = Number(inp.value).toFixed(['orbit', 'angle'].includes(key) ? 0 : 2); };
  show();
  inp.addEventListener('input', () => {
    S[key] = Number(inp.value); show();
    if (key === 'angle') build(); else if (key === 'size') SIZE.value = S.size;
  });
});
const modeBtns = document.querySelectorAll('[data-barvy]');
const setMode = m => { COL.orig = m === 'puvodni' ? 1 : 0; modeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.barvy === m))); };
modeBtns.forEach(b => b.addEventListener('click', () => setMode(b.dataset.barvy)));
setMode('web');
document.getElementById('panel-toggle').addEventListener('click', () => document.body.classList.add('panel-closed'));
document.querySelector('.lab-toggle').addEventListener('click', () => document.body.classList.remove('panel-closed'));
const copy = document.getElementById('copy');
copy.addEventListener('click', () => {
  const txt = JSON.stringify({ ...S, barvy: COL.orig ? 'puvodni' : 'web' });
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { copy.textContent = 'Zkopírováno ✓'; }, () => { prompt('Nastavení:', txt); });
  setTimeout(() => { copy.textContent = 'Zkopírovat nastavení'; }, 1800);
});
