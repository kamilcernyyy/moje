/* Grafysta lab: sharks made of particles, along the whole page.
   The shark is cut out of the user's video (zralok.png, the ink of its first frame) and turned into a few thousand
   points, edges weighted. Each shark on screen is one instance of those points: it comes from somewhere beyond the edge
   of the screen, swims across on its own slowly bending path (its body waves in 3D, the tail sweeping in depth, and it
   rolls over when it turns back) and leaves somewhere else; then another one comes. Only a few at a time.
   Scrolling: every shark turns to the nearest way out and dashes off the page. The moment the scroll stops, new ones
   come in from beyond the edges. The camera leans after the pointer, the pointer blows the points apart; GSAP damps it. */
import { Renderer, Camera, Transform, Program, Mesh, Geometry, Vec3 } from 'ogl';

const gsap = window.gsap;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = innerWidth < 760;

const S = {
  count: narrow ? 2 : 3, // sharks on screen at most
  scale: 1, // shark size
  speed: 1, // swimming speed
  wave: 1, // how much the body waves
  flee: 1, // how fast they dash off when the page scrolls
  back: 0.15, // seconds after the scroll stops until the first one comes back
  size: 1.35, // point size
  density: 1, // points per shark
  edge: 1, // glow of the edges of the drawing
  blow: 1, // pointer blows the points apart
  tilt: 8 // camera lean (deg)
};
const MAX = 6; // shark slots
const SPRITE = '/lab/zraloci/zralok.png';

const host = document.getElementById('bg');
const FOV = 38, H = 10; // the plane z = 0 fills the screen exactly: 10 world units high

let renderer;
try { renderer = new Renderer({ dpr: Math.min(devicePixelRatio || 1, 1.75), alpha: false, antialias: false, depth: false, webgl: 2 }); } catch (e) { renderer = null; }
if (renderer && renderer.isWebgl2) {
  const img = new Image();
  img.onload = () => run(img);
  img.src = SPRITE;
}

// the shark's ink → points on an even, slightly jittered grid (so the white cuts of the woodcut stay readable);
// x along the body: -.5 tail … .5 head, y across at the same scale; edges noted for the glow
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
  const step = Math.sqrt(area / n), out = [];
  for (let gy = step / 2; gy < h; gy += step) for (let gx = step / 2; gx < w; gx += step) {
    const x = gx + (Math.random() - 0.5) * step * 0.7, y = gy + (Math.random() - 0.5) * step * 0.7;
    if (at(x, y) < 0.5) continue;
    const d = Math.max(1, step * 0.6);
    const e = Math.min(1, Math.hypot(at(x + d, y) - at(x - d, y), at(x, y + d) - at(x, y - d)));
    out.push(x / w - 0.5, (h / 2 - y) / w, Math.random(), e);
  }
  return { pts: new Float32Array(out), spacing: step / w };
}

function run(img) {
  const gl = renderer.gl;
  gl.clearColor(10 / 255, 10 / 255, 10 / 255, 1);
  host.appendChild(gl.canvas);
  const camera = new Camera(gl, { fov: FOV, near: 0.1, far: 200 });
  const scene = new Transform();
  const DIST = H / 2 / Math.tan((FOV * Math.PI) / 360);

  const U = {
    uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uPx: { value: 1 }, uSize: { value: S.size }, uSp: { value: 0.01 }, uEdge: { value: S.edge },
    uBlow: { value: 0 }, uPtr: { value: [0, 0, 0] }, uOn: { value: 0 }, uView: { value: [1, 1] }, uCell: { value: [0, 0] }, uDustSp: { value: 0.03 },
    uA: { value: [82 / 255, 39 / 255, 1] }, uB: { value: [177 / 255, 158 / 255, 239 / 255] }
  };
  const BLOW = /* glsl */ `
        vec2 d = p.xy - uPtr.xy; float dl = length(d);
        float bl = uBlow * exp(-dl * dl / .55);
        p.xy += d / max(dl, 1e-3) * bl * .7 * (.6 + .8 * r);
        p.z += bl * (.8 + 1.4 * r);`;

  // ---------- the sharks: instanced points ----------
  const program = new Program(gl, {
    vertex: /* glsl */ `#version 300 es
      in vec4 position; // body x, body y, random, edge
      in vec3 iPos; in vec4 iMove; in vec4 iSwim;
      // iMove: heading cos, heading sin, length, roll · iSwim: tail phase, wave, bend (turning), dash (0 … 1)
      uniform mat4 viewMatrix, projectionMatrix;
      uniform float uTime, uDpr, uPx, uSize, uSp, uEdge, uBlow; uniform vec3 uPtr, uA, uB;
      out vec3 vC; out float vA;
      void main() {
        float r = position.z, edge = position.w, L = iMove.z;
        vec2 l = position.xy;
        // the body waves: a wave runs from the head to the tail and grows towards it (sideways = in depth, a little up and down)
        float tail = pow(smoothstep(.32, -.5, l.x), 1.4);
        float s = sin(iSwim.x - l.x * 6.5);
        float side = iSwim.y * tail * s * .22;
        float bend = iSwim.z * (l.x - .2) * (l.x - .2); // the body follows the curve of the path
        // rolled over when swimming back (so the fin stays up): the body's y turns into depth and back
        float c = cos(iMove.w), sn = sin(iMove.w);
        vec3 b = vec3(l.x, l.y * c + bend + iSwim.y * tail * s * .05, l.y * sn + side) * L;
        // at a dash the points stream out behind the shark
        b.x -= iSwim.w * r * r * L * .45;
        vec2 dir = iMove.xy;
        vec3 p = iPos + vec3(dir * b.x + vec2(-dir.y, dir.x) * b.y, b.z);
        p += .02 * L * vec3(sin(uTime * 1.3 + r * 40.), sin(uTime * 1.1 + r * 60.), sin(uTime * .9 + r * 80.));
        ${BLOW}
        vec4 mv = viewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        vC = mix(uA * .9, mix(uB, vec3(1.), .35), clamp(edge * uEdge * 1.3, 0., 1.)) * (.75 + .5 * r) * (1. + bl * .8);
        vA = (.6 + .4 * clamp(edge * uEdge, 0., 1.)) * (1. - iSwim.w * r * .6);
        gl_PointSize = L < .001 ? 0. : clamp(uSize * uSp * L * uPx / -mv.z, 1., 9. * uDpr);
      }`,
    fragment: /* glsl */ `#version 300 es
      precision highp float; in vec3 vC; in float vA; out vec4 o;
      void main() { vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
        o = vec4(vC * vA * smoothstep(.25, .02, r), 1.); }`,
    uniforms: U, transparent: true, depthTest: false, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE);

  // ---------- the sea's faint dust: a still grid over the screen (drawn first, under the sharks) ----------
  const dust = new Program(gl, {
    vertex: /* glsl */ `#version 300 es
      in vec3 position;
      uniform mat4 viewMatrix, projectionMatrix;
      uniform float uTime, uDpr, uPx, uSize, uDustSp, uBlow, uOn; uniform vec2 uView, uCell; uniform vec3 uPtr;
      out float vA; out float vR;
      void main() {
        float r = position.z;
        vec3 p = vec3((position.xy + (vec2(fract(r * 91.7), fract(r * 57.3)) - .5) * uCell) * uView, 0.);
        p += .03 * vec3(sin(uTime * 1.3 + r * 40.), sin(uTime * 1.1 + r * 60.), sin(uTime * .9 + r * 80.));
        ${BLOW}
        vec4 mv = viewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        vA = .055 * uOn; vR = r;
        gl_PointSize = clamp(uSize * uDustSp * uPx / -mv.z * .8, 1., 9. * uDpr);
      }`,
    fragment: /* glsl */ `#version 300 es
      precision highp float; in float vA; in float vR; out vec4 o;
      void main() { vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
        o = vec4(vec3(.55, .5, .75) * (.75 + .5 * vR) * vA * smoothstep(.25, .02, r), 1.); }`,
    uniforms: U, transparent: true, depthTest: false, depthWrite: false
  });
  dust.setBlendFunc(gl.ONE, gl.ONE);
  const dustLayer = new Transform(), sharkLayer = new Transform();
  dustLayer.setParent(scene); sharkLayer.setParent(scene);

  const inst = { iPos: new Float32Array(MAX * 3), iMove: new Float32Array(MAX * 4), iSwim: new Float32Array(MAX * 4) };
  let sharks = null;
  const build = () => {
    const n = Math.round((narrow ? 3200 : 4800) * S.density);
    const { pts, spacing } = sample(img, n);
    U.uSp.value = spacing;
    if (sharks) { sharks.setParent(null); sharks.geometry.remove(); }
    sharks = new Mesh(gl, {
      geometry: new Geometry(gl, {
        position: { size: 4, data: pts },
        iPos: { instanced: 1, size: 3, data: inst.iPos },
        iMove: { instanced: 1, size: 4, data: inst.iMove },
        iSwim: { instanced: 1, size: 4, data: inst.iSwim }
      }),
      program, mode: gl.POINTS, frustumCulled: false
    });
    sharks.setParent(sharkLayer);
  };

  const M = 1.3;
  let dusts = null;
  const grid = () => {
    const a = innerWidth / innerHeight;
    let cols = Math.round((narrow ? 150 : 240) * M), rows = Math.round(cols / a);
    const cap = narrow ? 50000 : 110000;
    if (cols * rows > cap) { const k = Math.sqrt(cap / (cols * rows)); cols = Math.round(cols * k); rows = Math.round(rows * k); }
    const data = new Float32Array(cols * rows * 3);
    let k = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { data[k++] = (x + 0.5) / cols - 0.5; data[k++] = (y + 0.5) / rows - 0.5; data[k++] = Math.random(); }
    U.uView.value = [H * a * M, H * M]; U.uCell.value = [1 / cols, 1 / rows]; U.uDustSp.value = (H * a * M) / cols;
    if (dusts) { dusts.setParent(null); dusts.geometry.remove(); }
    dusts = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data } }), program: dust, mode: gl.POINTS, frustumCulled: false });
    dusts.setParent(dustLayer);
  };

  // ---------- size ----------
  let VW = 16, VH = H;
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.perspective({ aspect: innerWidth / innerHeight });
    U.uPx.value = (innerHeight * renderer.dpr) / (2 * Math.tan((FOV * Math.PI) / 360));
    U.uDpr.value = renderer.dpr;
    VW = H * (innerWidth / innerHeight); VH = H;
  };
  resize(); build(); grid();
  let rz = 0, lw = innerWidth;
  addEventListener('resize', () => {
    resize();
    clearTimeout(rz);
    if (innerWidth !== lw) rz = setTimeout(() => { lw = innerWidth; grid(); }, 250);
  });

  // ---------- the sharks' swimming ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const len = () => Math.max(VW * 0.28, 2.9) * S.scale; // a shark's length (world units)
  const pool = [];
  const spawn = () => {
    const k = rnd(0.75, 1.1), L = len() * k, z = rnd(-2.6, 0.8);
    const depthK = (DIST - z) / DIST; // farther away = more of the world fits the screen
    const hw = (VW / 2) * depthK + L * 0.56, hh = (VH / 2) * depthK + L * 0.56;
    // from just beyond a random edge, towards a random point well inside, so it crosses the screen
    // (it is drawn from the side, so it swims mostly sideways: in from the left or the right, out on the other side)
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -hw : hw, y = rnd(-0.42, 0.42) * VH * depthK;
    const ty = rnd(-0.3, 0.3) * VH;
    const th = Math.max(-0.6, Math.min(0.6, Math.atan2(ty - y, hw))) * (fromLeft ? 1 : -1) + (fromLeft ? 0 : Math.PI);
    const roll = Math.cos(th) < 0 ? Math.PI : 0;
    pool.push({ x, y, z, k, L, th, turn: 0, turnTo: rnd(-0.12, 0.12), turnT: rnd(1.5, 4), vk: rnd(0.26, 0.36), phase: rnd(0, 6.28), roll, rollTo: roll, dash: 0, seen: false, hw, hh });
  };
  let scrolling = false, nextSpawn = 0.1;
  const tickSharks = dt => {
    // new ones come only while the page is still
    if (!scrolling && !reduce) {
      nextSpawn -= dt;
      if (nextSpawn <= 0 && pool.length < Math.min(S.count, MAX)) { spawn(); nextSpawn = pool.length < S.count ? rnd(0.5, 1.4) : rnd(2, 5); }
    }
    for (let i = pool.length - 1; i >= 0; i--) {
      const s = pool[i];
      s.L = len() * s.k;
      // a slowly changing turn; on a scroll it turns to the nearest way out and dashes off
      s.turnT -= dt;
      if (s.turnT <= 0) { s.turnTo = rnd(-0.16, 0.16); s.turnT = rnd(2, 5); }
      let want = s.turnTo;
      // never steeper than ~40°: steer back towards the horizontal
      const tilt = Math.atan2(Math.sin(s.th), Math.abs(Math.cos(s.th)));
      if (Math.abs(tilt) > 0.55) want -= Math.sign(tilt) * Math.sign(Math.cos(s.th) || 1) * (Math.abs(tilt) - 0.55) * 1.5;
      if (s.flee) {
        // out through the nearer side edge
        const out = Math.atan2(s.y * 0.35, s.x || 1e-3);
        let dth = Math.atan2(Math.sin(out - s.th), Math.cos(out - s.th));
        if (Math.cos(dth) > 0.5) dth *= 0.3; // already on the way out: keep going
        want = Math.max(-2.4, Math.min(2.4, dth * 3));
      }
      s.turn += (want - s.turn) * Math.min(1, dt * (s.flee ? 6 : 1.2));
      s.th += s.turn * dt;
      s.dash += ((s.flee ? 1 : 0) - s.dash) * Math.min(1, dt * 3);
      const base = s.L * s.vk * S.speed, v = base * (1 + s.dash * 3.5 * S.flee);
      s.x += Math.cos(s.th) * v * dt; s.y += Math.sin(s.th) * v * dt;
      // the tail beats faster the faster it swims
      s.phase += dt * 6.28 * 1.25 * Math.pow(v / Math.max(base, 1e-4), 0.7) * Math.min(1, S.speed + 0.3);
      // rolls over when it turns back (the fin stays on top)
      const c = Math.cos(s.th);
      if (c < -0.25) s.rollTo = Math.PI; else if (c > 0.25) s.rollTo = 0;
      s.roll += (s.rollTo - s.roll) * Math.min(1, dt * 2.2);
      const inside = Math.abs(s.x) < s.hw && Math.abs(s.y) < s.hh;
      if (inside) s.seen = true;
      // gone: beyond the edge and swimming away
      const away = s.x * Math.cos(s.th) + s.y * Math.sin(s.th) > 0;
      if ((s.seen && !inside && away) || Math.abs(s.x) > s.hw * 2.5 || Math.abs(s.y) > s.hh * 2.5) pool.splice(i, 1);
    }
    for (let k = 0; k < MAX; k++) {
      const s = pool[k];
      if (!s) { inst.iMove[k * 4 + 2] = 0; continue; }
      inst.iPos.set([s.x, s.y, s.z], k * 3);
      inst.iMove.set([Math.cos(s.th), Math.sin(s.th), s.L, s.roll], k * 4);
      inst.iSwim.set([s.phase, S.wave * (1 + s.dash * 0.6), -s.turn * 0.55, s.dash], k * 4);
    }
    const a = sharks.geometry.attributes;
    a.iPos.needsUpdate = true; a.iMove.needsUpdate = true; a.iSwim.needsUpdate = true;
  };

  // scroll on: every shark dashes off; scroll stopped: right away new ones come in from beyond the edges
  let still = 0;
  addEventListener('scroll', () => {
    if (reduce) return;
    if (!scrolling) { scrolling = true; pool.forEach(s => { s.flee = true; }); }
    clearTimeout(still);
    still = setTimeout(() => { scrolling = false; nextSpawn = S.back; }, 140);
  }, { passive: true });

  // ---------- pointer (damped with GSAP) ----------
  const st = { yaw: 0, pitch: 0, blow: 0, px: innerWidth / 2, py: innerHeight / 2 };
  const q = (k, d) => (gsap && !reduce ? gsap.quickTo(st, k, { duration: d, ease: 'power2.out' }) : v => { st[k] = v; });
  const toYaw = q('yaw', 1.1), toPitch = q('pitch', 1.1), toBlow = q('blow', 0.7), toPx = q('px', 0.25), toPy = q('py', 0.25);
  let lean = { x: 0, y: 0 };
  const off = el => el && el.closest && el.closest('.lab-panel, .lab-toggle, .gm');
  addEventListener('pointermove', e => {
    if (off(e.target)) { toBlow(0); return; }
    toPx(e.clientX); toPy(e.clientY);
    if (e.pointerType === 'mouse') toBlow(1);
    lean = { x: (e.clientX / innerWidth) * 2 - 1, y: (e.clientY / innerHeight) * 2 - 1 };
  }, { passive: true });
  addEventListener('touchstart', e => { const t = e.touches[0]; if (t && !off(e.target)) { st.px = t.clientX; st.py = t.clientY; } }, { passive: true });
  addEventListener('touchmove', e => { const t = e.touches[0]; if (!t || off(e.target)) return; toPx(t.clientX); toPy(t.clientY); toBlow(1); }, { passive: true });
  addEventListener('touchend', () => toBlow(0), { passive: true });
  document.documentElement.addEventListener('pointerleave', () => toBlow(0));
  const v3 = new Vec3();
  const pointer = () => {
    v3.set((st.px / innerWidth) * 2 - 1, 1 - (st.py / innerHeight) * 2, 0.5);
    camera.unproject(v3);
    const o = camera.position, dz = v3.z - o.z, t = Math.abs(dz) > 1e-5 ? -o.z / dz : 0;
    U.uPtr.value = [o.x + (v3.x - o.x) * t, o.y + (v3.y - o.y) * t, 0];
  };

  // reduced motion: two still sharks, no swimming
  if (reduce) {
    spawn(); spawn();
    pool.forEach((s, i) => { s.x = (i ? 0.22 : -0.2) * VW; s.y = (i ? -0.25 : 0.2) * VH; s.vk = 0; s.th = i ? Math.PI : 0; s.roll = s.rollTo = i ? Math.PI : 0; s.seen = true; });
  }
  if (gsap && !reduce) gsap.to(U.uOn, { value: 1, duration: 2, ease: 'power2.out' }); else U.uOn.value = 1;

  // ---------- render ----------
  let raf = 0, last = performance.now(), time = 0;
  const tick = now => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05); last = now; time += dt;
    tickSharks(reduce ? 0 : dt);
    const T = (S.tilt * Math.PI) / 180;
    toYaw(lean.x * T); toPitch(-lean.y * T * 0.6);
    camera.position.set(Math.sin(st.yaw) * Math.cos(st.pitch) * DIST, Math.sin(st.pitch) * DIST, Math.cos(st.yaw) * Math.cos(st.pitch) * DIST);
    camera.lookAt([0, 0, 0]);
    camera.updateMatrixWorld();
    pointer();
    U.uTime.value = time; U.uBlow.value = st.blow * S.blow;
    renderer.render({ scene, camera });
  };
  raf = requestAnimationFrame(tick);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); }
  });

  // ---------- panel ----------
  const fmt = (key, x) => (key === 'tilt' || key === 'count' ? String(Math.round(x)) : Number(x).toFixed(2));
  const apply = key => {
    if (key === 'size') U.uSize.value = S.size;
    else if (key === 'edge') U.uEdge.value = S.edge;
  };
  document.querySelectorAll('[data-set]').forEach(inp => {
    const key = inp.dataset.set, out = inp.parentElement.querySelector('output');
    inp.value = S[key];
    const show = () => { if (out) out.textContent = fmt(key, inp.value); };
    show();
    inp.addEventListener('input', () => { S[key] = Number(inp.value); show(); if (key !== 'density') apply(key); });
    if (key === 'density') inp.addEventListener('change', build);
  });
  document.getElementById('panel-toggle').addEventListener('click', () => document.body.classList.add('panel-closed'));
  document.querySelector('.lab-toggle').addEventListener('click', () => document.body.classList.remove('panel-closed'));
  const copy = document.getElementById('copy');
  copy.addEventListener('click', () => {
    const txt = JSON.stringify(S);
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { copy.textContent = 'Zkopírováno ✓'; }, () => { prompt('Nastavení:', txt); });
    setTimeout(() => { copy.textContent = 'Zkopírovat nastavení'; }, 1800);
  });
}
