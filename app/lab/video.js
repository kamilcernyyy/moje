/* Grafysta lab: a short video made of particles, in 3D.
   A grid of points lies over the video; every frame each point reads its pixel of the video (on the GPU, the video is
   a texture). The black ink of the drawing lights up in the site colours and comes forward, the paper stays dark,
   the edges of the drawing glow. The whole picture sinks into a funnel around its middle, so the vortex of sharks
   becomes a real whirlpool with the diver at the bottom. The camera leans after the pointer (or circles on its own),
   the pointer blows the points apart. GSAP drives the intro and damps every move; sliders tune it. */
import { Renderer, Camera, Transform, Program, Mesh, Geometry, Texture, Plane, Vec3 } from 'ogl';

const gsap = window.gsap;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = innerWidth < 760;
const coarse = matchMedia('(pointer: coarse)').matches;

const S = {
  size: 1.15, // point size (1 = one grid cell)
  density: narrow ? 0.8 : 1, // grid density
  depth: 1.4, // how far the ink comes forward
  funnel: 3.8, // how deep the middle of the vortex sinks
  edge: 1, // glow of the edges of the drawing
  paper: 0.06, // faint dust where the paper is
  jitter: 0.03, // points trembling
  blow: 1, // pointer blows the points apart
  tilt: narrow ? 14 : 18, // camera lean (deg)
  zoom: narrow ? 1.12 : 1.15, // 1 = the whole video fits
  speed: 1 // video playback rate
};
const VIEW = { mode: 'castice', brand: true, wide: true, orbit: coarse || reduce ? !reduce : false, playing: true };

const host = document.getElementById('bg');
const video = document.querySelector('.lv-src');
const PH = 10, PW = PH * (9 / 16); // the video plane, in world units (the video is 9:16)

let renderer;
try { renderer = new Renderer({ dpr: Math.min(devicePixelRatio || 1, 1.75), alpha: false, antialias: false, depth: false, webgl: 2 }); } catch (e) { renderer = null; }
if (!renderer || !renderer.isWebgl2) {
  document.documentElement.classList.add('no-gl');
} else {
  run();
}

function run() {
  const gl = renderer.gl;
  gl.clearColor(10 / 255, 10 / 255, 10 / 255, 1);
  host.appendChild(gl.canvas);
  const camera = new Camera(gl, { fov: 38, near: 0.1, far: 200 });
  const scene = new Transform();
  const VIOLET = [82 / 255, 39 / 255, 1], LILAC = [177 / 255, 158 / 255, 239 / 255];

  // the video as a texture: uploaded only when the video has a new frame
  const tex = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR, wrapS: gl.MIRRORED_REPEAT, wrapT: gl.CLAMP_TO_EDGE });
  let fresh = false, hasFrame = false;
  const onFrame = () => { fresh = true; video.requestVideoFrameCallback(onFrame); };
  if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(onFrame);
  const upload = () => {
    if (video.readyState < 2) return;
    if (!hasFrame) { tex.image = video; hasFrame = true; fresh = true; }
    if (fresh || !('requestVideoFrameCallback' in video)) { tex.needsUpdate = true; fresh = false; }
  };

  const U = {
    tVid: { value: tex }, uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uPx: { value: 1 }, uCell: { value: [0, 0] }, uSpacing: { value: 0.03 },
    uPlane: { value: [PW, PH] }, uHalf: { value: PW / 2 }, uTexel: { value: [1 / 540, 1 / 960] }, uSize: { value: S.size }, uDepth: { value: S.depth }, uFunnel: { value: S.funnel },
    uEdge: { value: S.edge }, uPaper: { value: S.paper }, uJitter: { value: S.jitter }, uBlow: { value: 0 }, uPtr: { value: [0, 0, 0] },
    uBrand: { value: 1 }, uOn: { value: reduce ? 1 : 0 }, uShow: { value: 1 }, uA: { value: VIOLET }, uB: { value: LILAC }
  };

  const program = new Program(gl, {
    vertex: /* glsl */ `#version 300 es
      in vec3 position; // u, v, random
      uniform mat4 viewMatrix, projectionMatrix; uniform sampler2D tVid;
      uniform float uHalf, uTime, uDpr, uPx, uSpacing, uSize, uDepth, uFunnel, uEdge, uPaper, uJitter, uBlow, uBrand, uOn, uShow;
      uniform vec2 uCell, uPlane, uTexel; uniform vec3 uPtr, uA, uB;
      out vec3 vC; out float vA;
      float lum(vec2 uv) { return dot(texture(tVid, uv).rgb, vec3(.299, .587, .114)); }
      void main() {
        float r = position.z;
        // a little shift inside its cell, so the grid never reads as a grid
        vec2 uv = position.xy + (vec2(fract(r * 91.7), fract(r * 57.3)) - .5) * uCell;
        vec3 rgb = texture(tVid, uv).rgb;
        float l = dot(rgb, vec3(.299, .587, .114));
        float ink = smoothstep(.62, .22, l);
        vec2 t = uTexel * 1.5;
        float gx = lum(uv + vec2(t.x, 0.)) - lum(uv - vec2(t.x, 0.));
        float gy = lum(uv + vec2(0., t.y)) - lum(uv - vec2(0., t.y));
        float edge = clamp(length(vec2(gx, gy)) * 2.2, 0., 1.);

        // the plane, sunk into a funnel around the middle (the diver at its bottom); the ink comes forward
        vec2 q = (uv - .5) * uPlane;
        float rr = length(q / vec2(uPlane.x * .62, uPlane.x * .62));
        float sink = pow(max(1. - rr, 0.), 1.7);
        // soft edges: the drawing (and its mirrored copies at the sides) fades into the dark
        float fade = smoothstep(uHalf, uHalf * .82, abs(q.x)) * smoothstep(0., .05, uv.y) * smoothstep(1., .95, uv.y);
        vec3 p = vec3(q, -uFunnel * sink + ink * uDepth * (1. - .35 * edge));
        p += uJitter * vec3(sin(uTime * 1.3 + r * 40.), sin(uTime * 1.1 + r * 60.), sin(uTime * .9 + r * 80.));

        // the pointer blows the points apart (sideways and towards the camera)
        vec2 d = p.xy - uPtr.xy; float dl = length(d);
        float f = uBlow * exp(-dl * dl / .55);
        p.xy += d / max(dl, 1e-3) * f * .7 * (.6 + .8 * r);
        p.z += f * (.8 + 1.4 * r);

        // intro: the points come in from a scattered cloud
        vec3 from = p + vec3(sin(r * 311.) * 9., cos(r * 173.) * 9., -8. - 14. * fract(r * 13.7));
        p = mix(from, p, smoothstep(r * .45, r * .45 + .55, uOn));

        vec4 mv = viewMatrix * vec4(p, 1.);
        float depth = -mv.z;
        gl_Position = projectionMatrix * mv;

        // site colours: the ink glows violet → lilac → white on its edges; original: the paper is white and the
        // sharks are the dark gaps between the points, as in the drawing
        vec3 brand = mix(uA * .9, mix(uB, vec3(1.), .35), clamp(edge * uEdge * 1.3 + ink * .15, 0., 1.));
        float aBrand = ink * (.5 + .5 * clamp(edge * uEdge, 0., 1.)) + uPaper * (1. - ink);
        vec3 cBrand = mix(vec3(.55, .5, .75), brand, ink);
        vec3 cOrig = rgb * (1. + edge * uEdge * .4);
        float aOrig = (1. - ink) * .8 + uPaper * .3 * ink;
        vC = mix(cOrig, cBrand, uBrand) * (.75 + .5 * r) * (1. + f * .8);
        vA = mix(aOrig, aBrand, uBrand) * fade * uShow * smoothstep(0., .25, uOn);
        float sz = uSize * uSpacing * uPx / depth * mix(.8, 1.2, ink * uBrand + (1. - ink) * (1. - uBrand));
        gl_PointSize = vA < .004 ? 0. : clamp(sz, 1., 9. * uDpr);
      }`,
    fragment: /* glsl */ `#version 300 es
      precision highp float; in vec3 vC; in float vA; out vec4 o;
      void main() { vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
        o = vec4(vC * vA * smoothstep(.25, .02, r), 1.); }`,
    uniforms: U, transparent: true, depthTest: false, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE);

  // the plain video on a plane, for comparison (Video / Obojí)
  const flat = new Program(gl, {
    vertex: /* glsl */ `#version 300 es
      in vec3 position; in vec2 uv; uniform mat4 modelViewMatrix, projectionMatrix; out vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragment: /* glsl */ `#version 300 es
      precision highp float; uniform sampler2D tVid; uniform float uAlpha, uBrand; uniform vec3 uA, uB; in vec2 vUv; out vec4 o;
      void main() { vec3 c = texture(tVid, vUv).rgb; o = vec4(c, uAlpha); }`,
    uniforms: { tVid: { value: tex }, uAlpha: { value: 0 }, uBrand: U.uBrand, uA: U.uA, uB: U.uB },
    transparent: true, depthTest: false, depthWrite: false
  });
  const plane = new Mesh(gl, { geometry: new Plane(gl, { width: PW, height: PH }), program: flat });
  plane.setParent(scene);

  // the grid of points
  // on a wide screen the drawing goes on to the sides, mirrored (the texture repeats mirrored), so the screen is full
  let points = null;
  const grid = () => {
    const t = Math.tan((camera.fov * Math.PI) / 360), a = innerWidth / innerHeight;
    const dist = Math.max(PH / 2 / t, PW / 2 / (t * a)) / S.zoom;
    const half = VIEW.wide ? Math.min(Math.max(dist * t * a * 1.3, PW / 2), PW * 2.5) : PW / 2;
    const ext = (half - PW / 2) / PW;
    let cols = Math.round((narrow ? 190 : 300) * S.density * (1 + 2 * ext)), rows = Math.round((narrow ? 190 : 300) * S.density * 16 / 9);
    const MAX = narrow ? 90000 : 240000;
    if (cols * rows > MAX) { const f = Math.sqrt(MAX / (cols * rows)); cols = Math.round(cols * f); rows = Math.round(rows * f); }
    const data = new Float32Array(cols * rows * 3);
    let k = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      data[k++] = -ext + ((x + 0.5) / cols) * (1 + 2 * ext); data[k++] = (y + 0.5) / rows; data[k++] = Math.random();
    }
    U.uCell.value = [(1 + 2 * ext) / cols, 1 / rows];
    U.uSpacing.value = (PW * (1 + 2 * ext)) / cols;
    U.uHalf.value = half;
    if (points) { points.setParent(null); points.geometry.remove(); }
    points = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data } }), program, mode: gl.POINTS, frustumCulled: false });
    points.setParent(scene);
  };
  // ---------- camera ----------
  const cam = { yaw: 0, pitch: 0, dist: 1 };
  const fit = () => {
    const t = Math.tan((camera.fov * Math.PI) / 360), a = innerWidth / innerHeight;
    cam.dist = Math.max(PH / 2 / t, PW / 2 / (t * a)) / S.zoom;
  };
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.perspective({ aspect: innerWidth / innerHeight });
    U.uPx.value = (innerHeight * renderer.dpr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    U.uDpr.value = renderer.dpr;
    fit();
  };
  resize(); grid();
  let rz = 0, lw = innerWidth;
  addEventListener('resize', () => {
    resize();
    clearTimeout(rz);
    // a phone's address bar sliding is not a new layout
    if (innerWidth !== lw) rz = setTimeout(() => { lw = innerWidth; grid(); }, 250);
  });

  // damped values (GSAP quickTo, or straight through without GSAP)
  const st = { yaw: 0, pitch: 0, blow: 0, px: 0, py: 0 };
  const q = (k, d) => (gsap ? gsap.quickTo(st, k, { duration: d, ease: 'power3.out' }) : v => { st[k] = v; });
  const toYaw = q('yaw', 1.2), toPitch = q('pitch', 1.2), toBlow = q('blow', 0.7), toPx = q('px', 0.25), toPy = q('py', 0.25);
  let lean = { x: 0, y: 0 };
  addEventListener('pointermove', e => {
    if (e.target.closest && e.target.closest('.lab-panel, .gm, .lab-toggle')) { toBlow(0); return; }
    toPx(e.clientX); toPy(e.clientY);
    if (e.pointerType === 'mouse' || e.buttons) toBlow(1);
    lean = { x: (e.clientX / innerWidth) * 2 - 1, y: (e.clientY / innerHeight) * 2 - 1 };
  }, { passive: true });
  host.addEventListener('pointerdown', e => { st.px = e.clientX; st.py = e.clientY; toPx(e.clientX); toPy(e.clientY); toBlow(1); });
  addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') toBlow(0); });
  document.documentElement.addEventListener('pointerleave', () => toBlow(0));

  // the pointer on the plane (a ray from the camera to z = 0)
  const v = new Vec3();
  const pointer = () => {
    v.set((st.px / innerWidth) * 2 - 1, 1 - (st.py / innerHeight) * 2, 0.5);
    camera.unproject(v);
    const o = camera.position, dx = v.x - o.x, dy = v.y - o.y, dz = v.z - o.z;
    const t = Math.abs(dz) > 1e-5 ? -o.z / dz : 0;
    U.uPtr.value = [o.x + dx * t, o.y + dy * t, 0];
  };

  // ---------- intro ----------
  const start = () => {
    if (reduce || !gsap) { U.uOn.value = 1; return; }
    gsap.to(U.uOn, { value: 1, duration: 3.2, ease: 'power2.inOut' });
  };
  const playVideo = () => { const p = video.play(); if (p && p.catch) p.catch(() => { VIEW.playing = false; syncPlay(); }); };
  video.playbackRate = S.speed;
  if (reduce) { VIEW.playing = false; video.pause(); } else playVideo();
  let started = false;
  const ready = () => { if (started) return; started = true; upload(); start(); };
  if (video.readyState >= 2) ready(); else video.addEventListener('loadeddata', ready, { once: true });

  // ---------- render ----------
  let raf = 0, last = performance.now(), time = 0;
  const tick = now => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05); last = now; time += dt;
    upload();
    // camera: leans after the pointer, or circles slowly on its own
    const T = (S.tilt * Math.PI) / 180;
    if (VIEW.orbit && !reduce) { toYaw(Math.sin(time * 0.23) * T); toPitch(Math.cos(time * 0.17) * T * 0.7 - T * 0.15); }
    else { toYaw(lean.x * T); toPitch(-lean.y * T * 0.75); }
    const d = cam.dist;
    camera.position.set(Math.sin(st.yaw) * Math.cos(st.pitch) * d, Math.sin(st.pitch) * d, Math.cos(st.yaw) * Math.cos(st.pitch) * d);
    camera.lookAt([0, 0, -S.funnel * 0.25]);
    camera.updateMatrixWorld();
    pointer();
    U.uTime.value = time; U.uBlow.value = st.blow * S.blow * (VIEW.mode === 'video' ? 0 : 1);
    U.uBrand.value += ((VIEW.brand ? 1 : 0) - U.uBrand.value) * 0.08;
    const showP = VIEW.mode === 'video' ? 0 : 1, showV = VIEW.mode === 'video' ? 1 : VIEW.mode === 'obe' ? 0.22 : 0;
    U.uShow.value += (showP - U.uShow.value) * 0.1;
    flat.uniforms.uAlpha.value += (showV - flat.uniforms.uAlpha.value) * 0.1;
    plane.visible = flat.uniforms.uAlpha.value > 0.003 && hasFrame;
    points.visible = U.uShow.value > 0.003;
    renderer.render({ scene, camera });
  };
  raf = requestAnimationFrame(tick);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (document.hidden) video.pause();
    else { if (VIEW.playing) playVideo(); last = performance.now(); raf = requestAnimationFrame(tick); }
  });

  // ---------- panel ----------
  const fmt = (k, x) => (k === 'tilt' ? String(Math.round(x)) : Number(x).toFixed(k === 'jitter' ? 3 : 2));
  const apply = k => {
    if (k === 'size') U.uSize.value = S.size;
    else if (k === 'depth') U.uDepth.value = S.depth;
    else if (k === 'funnel') U.uFunnel.value = S.funnel;
    else if (k === 'edge') U.uEdge.value = S.edge;
    else if (k === 'paper') U.uPaper.value = S.paper;
    else if (k === 'jitter') U.uJitter.value = S.jitter;
    else if (k === 'zoom') fit();
    else if (k === 'speed') video.playbackRate = S.speed;
  };
  document.querySelectorAll('[data-set]').forEach(inp => {
    const k = inp.dataset.set, out = inp.parentElement.querySelector('output');
    inp.value = S[k];
    const show = () => { if (out) out.textContent = fmt(k, inp.value); };
    show();
    inp.addEventListener('input', () => { S[k] = Number(inp.value); show(); if (k !== 'density') apply(k); });
    if (k === 'density' || k === 'zoom') inp.addEventListener('change', grid);
  });
  const modes = document.querySelectorAll('[data-mode]');
  const syncModes = () => modes.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === VIEW.mode)));
  modes.forEach(b => b.addEventListener('click', () => { VIEW.mode = b.dataset.mode; syncModes(); }));
  syncModes();
  const toggle = (id, key) => {
    const b = document.getElementById(id);
    b.setAttribute('aria-pressed', String(VIEW[key]));
    b.addEventListener('click', () => { VIEW[key] = !VIEW[key]; b.setAttribute('aria-pressed', String(VIEW[key])); });
  };
  toggle('colors', 'brand');
  toggle('orbit', 'orbit');
  toggle('wide', 'wide');
  document.getElementById('wide').addEventListener('click', grid);
  const playBtn = document.getElementById('play');
  const syncPlay = () => { playBtn.textContent = VIEW.playing ? 'Pauza' : 'Přehrát'; };
  playBtn.addEventListener('click', () => { VIEW.playing = !VIEW.playing; if (VIEW.playing) playVideo(); else video.pause(); syncPlay(); });
  syncPlay();
  document.getElementById('panel-toggle').addEventListener('click', () => document.body.classList.add('panel-closed'));
  document.querySelector('.lab-toggle').addEventListener('click', () => document.body.classList.remove('panel-closed'));
  const copy = document.getElementById('copy');
  copy.addEventListener('click', () => {
    const txt = JSON.stringify({ ...S, pohled: VIEW.mode, barvyWebu: VIEW.brand, doStran: VIEW.wide, kameraKrouzi: VIEW.orbit });
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { copy.textContent = 'Zkopírováno ✓'; }, () => { prompt('Nastavení:', txt); });
    setTimeout(() => { copy.textContent = 'Zkopírovat nastavení'; }, 1800);
  });
}
