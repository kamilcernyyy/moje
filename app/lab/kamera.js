/* Grafysta lab: the camera turns with the scroll, all the way round and round, and the content follows it.
   Background: the GRAFYSTA wordmark made of particles above a breathing field; the camera orbits it as you scroll.
   Content: plain HTML sections on 3D panels (CSS); each one comes in turned with the camera, straightens while it is
   read in the middle of the screen, and turns away as it leaves. GSAP ScrollTrigger drives both, sliders tune it. */
import { Renderer, Camera, Transform, Program, Mesh, Geometry } from 'ogl';

const gsap = window.gsap, ST = window.ScrollTrigger;
gsap.registerPlugin(ST);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = innerWidth < 760;

const S = {
  angle: narrow ? 16 : 26, // how far a section is turned when it comes in / leaves (deg)
  tilt: 5, // a touch of tilt in the other axis (deg)
  flat: 0.3, // how long a section stays straight around the middle of the screen (0–0.9)
  depth: 220, // how far back a turned section sits (px)
  persp: 1400, // CSS perspective (px): lower = stronger 3D
  orbit: 90 // camera turn per screen of scroll (deg)
};

// ---------- background ----------
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

const POINT_FRAG = `precision highp float; varying vec3 vC; varying float vD;
  void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
    gl_FragColor = vec4(vC * smoothstep(.25, 0., r) * exp(-max(vD - 4., 0.) * .07), 1.); }`;

// the wordmark, sampled from a canvas
async function wordmark() {
  try { await document.fonts.load('400 300px "Odibee Sans CZ"'); } catch (e) {}
  const cw = 1400, ch = 380, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '400 300px "Odibee Sans CZ", "Odibee Sans", "Arial Narrow", sans-serif';
  x.fillText('GRAFYSTA', cw / 2, ch / 2 + 12);
  const d = x.getImageData(0, 0, cw, ch).data, cand = [];
  for (let i = 0; i < cw * ch; i++) if (d[i * 4 + 3] > 128) cand.push(i);
  const N = narrow ? 14000 : 24000, pos = new Float32Array(N * 3), rnd = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    const i = cand[(Math.random() * cand.length) | 0];
    pos[k * 3] = ((i % cw) / cw - 0.5) * 8; pos[k * 3 + 1] = -(Math.floor(i / cw) / ch - 0.5) * (8 * ch / cw) + 0.6; pos[k * 3 + 2] = (Math.random() - 0.5) * 0.5;
    rnd[k] = Math.random();
  }
  const program = new Program(gl, {
    vertex: `attribute vec3 position; attribute float aR; uniform mat4 viewMatrix, projectionMatrix; uniform float uTime, uDpr; varying vec3 vC; varying float vD;
      uniform vec3 uA, uB;
      void main(){ vec3 p = position + .03 * vec3(sin(uTime * 1.3 + aR * 40.), sin(uTime * 1.1 + aR * 60.), sin(uTime * .9 + aR * 80.));
        vC = mix(uB, vec3(1.), .5) * (.55 + .5 * aR) * .7;
        vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; gl_PointSize = 2.3 * uDpr * (6. / max(vD, .5)); }`,
    fragment: POINT_FRAG,
    uniforms: { uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uA: { value: VIOLET }, uB: { value: LILAC } },
    transparent: true, depthTest: false, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE);
  const mesh = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: pos }, aR: { size: 1, data: rnd } }), program, mode: gl.POINTS, frustumCulled: false });
  mesh.setParent(scene);
  return program;
}

// the field: a round disc of points under the wordmark, so it reads the same from every side of the orbit
function field() {
  const N = narrow ? 18000 : 32000, pos = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    const r = Math.sqrt(Math.random()) * 16, a = Math.random() * Math.PI * 2;
    pos[k * 3] = Math.cos(a) * r; pos[k * 3 + 1] = Math.random(); pos[k * 3 + 2] = Math.sin(a) * r;
  }
  const program = new Program(gl, {
    vertex: `attribute vec3 position; uniform mat4 viewMatrix, projectionMatrix; uniform float uTime, uDpr; uniform vec3 uA, uB; varying vec3 vC; varying float vD;
      void main(){ vec3 p = vec3(position.x, -1.6, position.z); float t = uTime * .35;
        p.y += sin(p.x * .45 + t) * .3 + sin(p.z * .6 - t * 1.3) * .25 + sin((p.x + p.z) * .9 + t * .7) * .1;
        float h = p.y + 1.6;
        vC = mix(uA, uB, clamp(h * .9 + .45, 0., 1.)) * (.7 + 1.1 * clamp(h + .5, 0., 1.4)) * .9;
        vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; gl_PointSize = 3.6 * uDpr * (6. / max(vD, .5)); }`,
    fragment: POINT_FRAG,
    uniforms: { uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uA: { value: VIOLET }, uB: { value: LILAC } },
    transparent: true, depthTest: false, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE);
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: pos } }), program, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
  return program;
}

const progs = [field()];
wordmark().then(p => progs.push(p));

// ---------- camera: orbit with the scroll (damped), lean with the pointer ----------
const cam = { yaw: 0, lx: 0, ly: 0 };
const toYaw = gsap.quickTo(cam, 'yaw', { duration: 1.2, ease: 'power3.out' });
const toLx = gsap.quickTo(cam, 'lx', { duration: 1.2, ease: 'power3.out' });
const toLy = gsap.quickTo(cam, 'ly', { duration: 1.2, ease: 'power3.out' });
const yawFor = () => (scrollY / innerHeight) * S.orbit * (Math.PI / 180);
addEventListener('scroll', () => toYaw(yawFor()), { passive: true });
addEventListener('pointermove', e => { if (reduce) return; toLx((e.clientX / innerWidth) * 2 - 1); toLy((e.clientY / innerHeight) * 2 - 1); }, { passive: true });

let time = 0, last = performance.now();
const tick = now => {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  time += dt * (reduce ? 0.2 : 1);
  const r = narrow ? 9.5 : 7.2, yaw = (reduce ? 0 : cam.yaw) + cam.lx * 0.18, pitch = 0.16 + cam.ly * 0.08;
  camera.position.set(Math.sin(yaw) * Math.cos(pitch) * r, 0.4 + Math.sin(pitch) * r, Math.cos(yaw) * Math.cos(pitch) * r);
  camera.lookAt([0, 0.2, 0]);
  for (const p of progs) { p.uniforms.uTime.value = time; p.uniforms.uDpr.value = renderer.dpr; }
  renderer.render({ scene, camera });
};
requestAnimationFrame(tick);

// ---------- content: every section turns in with the camera, straight in the middle, turns away ----------
let tls = [];
const build = () => {
  tls.forEach(t => { t.scrollTrigger && t.scrollTrigger.kill(); t.kill(); });
  tls = [];
  document.documentElement.style.setProperty('--persp', `${S.persp}px`);
  if (reduce) return;
  document.querySelectorAll('.ks-panel').forEach(panel => {
    const turn = 1 - S.flat;
    const tl = gsap.timeline({ scrollTrigger: { trigger: panel.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
    tl.fromTo(panel, { rotateY: S.angle, rotateX: S.tilt, z: -S.depth, opacity: 0.35 }, { rotateY: 0, rotateX: 0, z: 0, opacity: 1, duration: turn, ease: 'power2.out' })
      .to(panel, { rotateY: 0, duration: S.flat * 2 })
      .to(panel, { rotateY: -S.angle, rotateX: -S.tilt, z: -S.depth, opacity: 0.35, duration: turn, ease: 'power2.in' });
    tls.push(tl);
  });
  ST.refresh();
};
build();

// ---------- panel ----------
document.querySelectorAll('[data-set]').forEach(inp => {
  const key = inp.dataset.set, out = inp.parentElement.querySelector('output');
  inp.value = S[key];
  const show = () => { if (out) out.textContent = Number(inp.value).toFixed(key === 'flat' ? 2 : 0); };
  show();
  inp.addEventListener('input', () => { S[key] = Number(inp.value); show(); if (key === 'orbit') toYaw(yawFor()); else build(); });
});
const panelBtn = document.getElementById('panel-toggle');
panelBtn.addEventListener('click', () => { document.body.classList.add('panel-closed'); });
document.querySelector('.lab-toggle').addEventListener('click', () => document.body.classList.remove('panel-closed'));
const copy = document.getElementById('copy');
copy.addEventListener('click', () => {
  const txt = JSON.stringify(S);
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { copy.textContent = 'Zkopírováno ✓'; }, () => { prompt('Nastavení:', txt); });
  setTimeout(() => { copy.textContent = 'Zkopírovat nastavení'; }, 1800);
});
