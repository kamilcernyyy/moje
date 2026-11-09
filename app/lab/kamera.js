/* Grafysta lab: the camera turns with the scroll, all the way round and round, and the content follows it.
   Background: the tree from the reference, made of particles in 3D; the camera orbits its trunk as you scroll and
   travels from the crown down to the roots, pulling back so more and more of the tree comes into view.
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

// the tree from the reference, made 3D: every sampled pixel is spun around the trunk. Most points sit on a few
// planes through the trunk (so branches and roots keep their drawing from every side), the rest fill the volume.
const TREE = { orig: 1 };
let treeProg = null, treeMesh = null, trunkMesh = null, trunkProg = null;
const SCENE = { name: new URLSearchParams(location.search).get('strom') === 'kresba' ? 'kresba' : 'fotka' };
async function tree() {
  const img = new Image(); img.src = '/lab/kamera/strom.webp'; await img.decode();
  const iw = 368, ih = 552, cv = document.createElement('canvas'); cv.width = iw; cv.height = ih;
  const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, iw, ih);
  const d = x.getImageData(0, 0, iw, ih).data, cdf = new Float32Array(iw * ih); let sum = 0;
  for (let i = 0; i < iw * ih; i++) {
    const lum = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    sum += lum > 0.12 ? Math.pow(lum, 0.8) : 0; cdf[i] = sum;
  }
  const N = narrow ? 50000 : 95000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), rnd = new Float32Array(N);
  // the drawing spans x 75–667, y 77–962 of 736×1104: trunk at x ≈ 371, ground (crown / roots) around the middle
  const cx = 371 / 736, cy = 519.5 / 1104, S = 9 / (885 / 1104);
  const PLANES = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];
  for (let k = 0; k < N; k++) {
    const r = Math.random() * sum; let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < r) lo = m + 1; else hi = m; }
    const px = (lo % iw) + Math.random(), py = Math.floor(lo / iw) + Math.random();
    const dx = (px / iw - cx) * S * (iw / ih), y = (cy - py / ih) * S;
    const th = Math.random() < 0.72 ? PLANES[(Math.random() * 4) | 0] + (Math.random() - 0.5) * 0.06 : Math.random() * Math.PI;
    pos[k * 3] = dx * Math.cos(th); pos[k * 3 + 1] = y; pos[k * 3 + 2] = dx * Math.sin(th);
    col[k * 3] = d[lo * 4] / 255; col[k * 3 + 1] = d[lo * 4 + 1] / 255; col[k * 3 + 2] = d[lo * 4 + 2] / 255;
    rnd[k] = Math.random();
  }
  const program = new Program(gl, {
    vertex: `attribute vec3 position, aC; attribute float aR; uniform mat4 viewMatrix, projectionMatrix; uniform float uTime, uDpr, uOrig; uniform vec3 uA, uB;
      varying vec3 vC; varying float vD;
      void main(){
        vec3 p = position;
        // the crown breathes in the wind, the roots stay still
        float crown = smoothstep(.5, 2.5, p.y);
        p.x += sin(uTime * .9 + p.y * 1.3 + aR * 2.) * .05 * crown;
        p.z += cos(uTime * .7 + p.y * 1.1 + aR * 3.) * .05 * crown;
        p += .012 * vec3(sin(uTime * 1.3 + aR * 40.), sin(uTime * 1.1 + aR * 60.), sin(uTime * .9 + aR * 80.));
        float l = dot(aC, vec3(.3, .59, .11));
        vec3 brand = mix(uA, mix(uB, vec3(1.), .4), clamp(l * 1.3, 0., 1.));
        vC = mix(brand, aC * 1.2, uOrig) * (.7 + .4 * aR);
        vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z;
        gl_Position = projectionMatrix * mv; gl_PointSize = min(2.2 * uDpr * (7. / max(vD, .4)), 4.5 * uDpr); }`,
    fragment: POINT_FRAG,
    uniforms: { uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uOrig: { value: 1 }, uA: { value: VIOLET }, uB: { value: LILAC } },
    transparent: true, depthTest: false, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE);
  treeProg = program;
  treeMesh = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: pos }, aC: { size: 3, data: col }, aR: { size: 1, data: rnd } }), program, mode: gl.POINTS, frustumCulled: false });
  treeMesh.visible = SCENE.name === 'kresba';
  treeMesh.setParent(scene);
  return program;
}


// the trunk from the photo (a worm's-eye view up a mossy trunk): the photo is read back into 3D. The trunk is a cone
// standing on the ground: every trunk pixel goes onto its bark (height from how far up the photo it is, around the
// trunk from how far from its middle; the back of the trunk repeats the front). The canopy around it becomes a dome
// of leaves overhead (direction from the point the trunk vanishes into), repeated around so it closes all round.
async function trunk() {
  const img = new Image(); img.src = '/lab/kamera/kmen.webp'; await img.decode();
  const iw = 392, ih = 800, cv = document.createElement('canvas'); cv.width = iw; cv.height = ih;
  const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, iw, ih);
  const d = x.getImageData(0, 0, iw, ih).data;
  // photo geometry (in 784×1600 px): the trunk vanishes at (400, 370), widens to the bottom
  const CX = 400 / 784, TOP = 370 / 1600, BOT = 1560 / 1600;
  const half = yn => (10 + (yn * 1600 - 370) * 0.36) / 784; // trunk half width (in image widths) at height yn
  const N = narrow ? 80000 : 160000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), rnd = new Float32Array(N);
  let k = 0, guard = 0;
  while (k < N && guard++ < N * 40) {
    const px = Math.random() * iw, py = Math.random() * ih, i = ((py | 0) * iw + (px | 0)) * 4;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const xn = px / iw, yn = py / ih;
    if ((b > r + 0.08 && b > g - 0.02 && lum > 0.45) || lum < 0.03) continue; // sky and pure black out
    let X, Y, Z;
    const hw = half(yn);
    if (yn > TOP && Math.abs(xn - CX) < hw) {
      // bark: a cone 16 high, 1.7 wide at the foot; all of the moss counts, dark or light
      if (Math.random() > 0.55) continue;
      const tt = Math.min(1, Math.max(0, (BOT - yn) / (BOT - TOP)));
      const H = 16 * Math.pow(tt, 1.7), R = 0.12 + 1.6 * (1 - 0.92 * tt);
      const u = Math.max(-1, Math.min(1, (xn - CX) / hw));
      const phi = Math.asin(u) + (Math.random() < 0.5 ? 0 : Math.PI);
      const rr = R * (1 + (Math.random() - 0.5) * 0.08);
      X = Math.sin(phi) * rr; Y = H - 0.5; Z = Math.cos(phi) * rr;
    } else {
      if (Math.random() > Math.pow(lum, 0.6) * 1.2) continue;
      // looking up from the foot: a pixel's angle from the zenith (distance from the vanishing point) says where it is
      const dx = (xn - CX) * 784, dy = (yn - TOP) * 1600, rad = Math.hypot(dx, dy);
      const al = Math.atan2(dx, -dy) + ((Math.random() * 3) | 0) * (Math.PI * 2 / 3);
      if (rad < 330 && yn < TOP + 0.12) {
        // the fir crown fanning out around the top of the trunk
        const f = rad / 330;
        X = Math.sin(al) * f * 3.2; Y = 15.8 - f * 3.4 + (Math.random() - 0.5) * 0.6; Z = Math.cos(al) * f * 3.2;
      } else {
        // the forest canopy around: on a ring of trees 4.5–9 away, as high as the view angle says
        const th = Math.min(1.45, (rad / 950) * 1.45), Rc = 4.5 + Math.random() * 4.5;
        X = Math.sin(al) * Rc; Y = Math.min(19, Rc / Math.tan(Math.max(th, 0.2))) - 0.5; Z = Math.cos(al) * Rc;
      }
    }
    pos[k * 3] = X; pos[k * 3 + 1] = Y; pos[k * 3 + 2] = Z;
    col[k * 3] = r; col[k * 3 + 1] = g; col[k * 3 + 2] = b; rnd[k] = Math.random();
    k++;
  }
  const program = new Program(gl, {
    vertex: `attribute vec3 position, aC; attribute float aR; uniform mat4 viewMatrix, projectionMatrix; uniform float uTime, uDpr, uOrig; uniform vec3 uA, uB;
      varying vec3 vC; varying float vD;
      void main(){
        vec3 p = position;
        // leaves stir, the bark stays still
        float leaf = step(1.8, length(p.xz)) + step(13.5, p.y);
        p += leaf * .06 * vec3(sin(uTime * .8 + aR * 30.), sin(uTime * .6 + aR * 50.), cos(uTime * .7 + aR * 70.));
        float l = dot(aC, vec3(.3, .59, .11));
        vec3 brand = mix(uA, mix(uB, vec3(1.), .4), clamp(l * 1.4, 0., 1.));
        vC = mix(brand, pow(aC, vec3(.75)) * 1.6, uOrig) * (.8 + .45 * aR);
        vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z;
        gl_Position = projectionMatrix * mv; gl_PointSize = min(2.2 * uDpr * (7. / max(vD, .3)), 5. * uDpr); }`,
    fragment: `precision highp float; varying vec3 vC; varying float vD;
      void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
        gl_FragColor = vec4(vC * smoothstep(.25, 0., r) * exp(-max(vD - 8., 0.) * .04) * .75, 1.); }`,
    uniforms: { uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uOrig: { value: 1 }, uA: { value: VIOLET }, uB: { value: LILAC } },
    transparent: true, depthTest: false, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE);
  trunkProg = program;
  trunkMesh = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: pos }, aC: { size: 3, data: col }, aR: { size: 1, data: rnd } }), program, mode: gl.POINTS, frustumCulled: false });
  trunkMesh.visible = SCENE.name === 'fotka';
  trunkMesh.setParent(scene);
  return program;
}

// dust: a slow cloud of faint points around the tree, so depth reads even where the tree is not
function dust() {
  const N = narrow ? 2500 : 5000, pos = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    const r = 2 + Math.random() * 12, a = Math.random() * Math.PI * 2;
    pos[k * 3] = Math.cos(a) * r; pos[k * 3 + 1] = (Math.random() - 0.5) * 14; pos[k * 3 + 2] = Math.sin(a) * r;
  }
  const program = new Program(gl, {
    vertex: `attribute vec3 position; uniform mat4 viewMatrix, projectionMatrix; uniform float uTime, uDpr; uniform vec3 uA, uB; varying vec3 vC; varying float vD;
      void main(){ vec3 p = position; p.y += sin(uTime * .2 + p.x) * .3; p.x += cos(uTime * .15 + p.z) * .3;
        vC = mix(uA, uB, fract(position.x * 3.7)) * .35;
        vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; gl_PointSize = 2.6 * uDpr * (6. / max(vD, .5)); }`,
    fragment: POINT_FRAG,
    uniforms: { uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uA: { value: VIOLET }, uB: { value: LILAC } },
    transparent: true, depthTest: false, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE);
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: pos } }), program, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
  return program;
}

const progs = [dust()];
tree().then(p => progs.push(p));
trunk().then(p => progs.push(p));

// ---------- camera: orbit with the scroll (damped), lean with the pointer ----------
const cam = { yaw: 0, lx: 0, ly: 0 };
const toYaw = gsap.quickTo(cam, 'yaw', { duration: 1.2, ease: 'power3.out' });
const toLx = gsap.quickTo(cam, 'lx', { duration: 1.2, ease: 'power3.out' });
const toLy = gsap.quickTo(cam, 'ly', { duration: 1.2, ease: 'power3.out' });
const yawFor = () => (scrollY / innerHeight) * S.orbit * (Math.PI / 180);
addEventListener('scroll', () => toYaw(yawFor()), { passive: true });
addEventListener('pointermove', e => { if (reduce) return; toLx((e.clientX / innerWidth) * 2 - 1); toLy((e.clientY / innerHeight) * 2 - 1); }, { passive: true });

let time = 0, last = performance.now();
const cam2 = { p: 0 };
const toP = gsap.quickTo(cam2, 'p', { duration: 1.2, ease: 'power3.out' });
const progressFor = () => Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
addEventListener('scroll', () => toP(progressFor()), { passive: true });
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const tick = now => {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  time += dt * (reduce ? 0.2 : 1);
  // from the crown down to the roots: the camera starts close among the branches and pulls back as it descends,
  // so more and more of the tree comes into view; all the while it orbits the trunk
  const p = reduce ? 0.35 : cam2.p;
  const yaw = (reduce ? 0 : cam.yaw) + cam.lx * 0.18;
  if (SCENE.name === 'fotka') {
    // up the trunk: from its mossy foot, looking up like the photo, climbing into the crown while circling the bark
    const cy = 0.6 + 12.8 * smooth(0, 1, p);
    const r = (narrow ? 1.25 : 1) * (3.4 - 0.6 * smooth(0, 1, p));
    camera.position.set(Math.sin(yaw) * r, cy - cam.ly * 0.3, Math.cos(yaw) * r);
    camera.lookAt([0, cy + 5.5 - 3.5 * smooth(0.7, 1, p), 0]);
  } else {
    // from the crown down to the roots: the camera starts close among the branches and pulls back as it descends,
    // so more and more of the tree comes into view; all the while it orbits the trunk
    const ty = 2.7 + (-2.1 - 2.7) * smooth(0, 1, p);
    const r = (narrow ? 1.5 : 1) * (5.6 + (10.5 - 5.6) * smooth(0, 0.9, p));
    const lift = r * (0.1 - 0.12 * smooth(0.6, 1, p)) - cam.ly * 0.3;
    camera.position.set(Math.sin(yaw) * r, ty + lift, Math.cos(yaw) * r);
    camera.lookAt([0, ty, 0]);
  }
  for (const pr of [treeProg, trunkProg]) if (pr) pr.uniforms.uOrig.value += (TREE.orig - pr.uniforms.uOrig.value) * 0.08;
  for (const pr of progs) { pr.uniforms.uTime.value = time; pr.uniforms.uDpr.value = renderer.dpr; }
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
document.querySelectorAll('[data-strom]').forEach(b => {
  b.setAttribute('aria-pressed', String(b.dataset.strom === SCENE.name));
  b.addEventListener('click', () => {
    SCENE.name = b.dataset.strom;
    if (treeMesh) treeMesh.visible = SCENE.name === 'kresba';
    if (trunkMesh) trunkMesh.visible = SCENE.name === 'fotka';
    document.querySelectorAll('[data-strom]').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
  });
});
const colBtn = document.getElementById('colors');
if (colBtn) colBtn.addEventListener('click', () => { TREE.orig = TREE.orig ? 0 : 1; colBtn.textContent = TREE.orig ? 'Barvy webu' : 'Původní barvy'; });
const panelBtn = document.getElementById('panel-toggle');
panelBtn.addEventListener('click', () => { document.body.classList.add('panel-closed'); });
document.querySelector('.lab-toggle').addEventListener('click', () => document.body.classList.remove('panel-closed'));
const copy = document.getElementById('copy');
copy.addEventListener('click', () => {
  const txt = JSON.stringify(S);
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { copy.textContent = 'Zkopírováno ✓'; }, () => { prompt('Nastavení:', txt); });
  setTimeout(() => { copy.textContent = 'Zkopírovat nastavení'; }, 1800);
});
