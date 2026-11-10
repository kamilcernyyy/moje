/* Grafysta lab: a school of sharks made of particles, along the whole page.
   One video holds the same shark loop four times, each a quarter of the loop apart in time (2×2). Behind the page lies
   an endless sea tiled from it: every tile takes one of the four moments, mirrored its own way, at its own depth, and
   wanders on its own slow path; the tiles dissolve into each other at their edges, so a shark that swims out of its
   tile fades away and others turn up elsewhere. A fixed grid of points reads that sea every frame (on the GPU, the video
   is a texture): the black ink glows in the site colours and comes forward, the paper stays dark.
   The scroll carries the sea along, damped (GSAP): the sharks swim the way the page is scrolled and drift on a little
   after it stops; the camera leans into the scroll and after the pointer, the pointer blows the points apart. */
import { Renderer, Camera, Transform, Program, Mesh, Geometry, Texture, Vec3 } from 'ogl';

const gsap = window.gsap;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = innerWidth < 760;

const S = {
  follow: 0.45, // how the sea moves with the scroll: 0 = stays on screen, 1 = swims ahead, -1 = scrolls away with the page
  lag: 0.5, // seconds the sea needs to catch up with the scroll (inertia)
  scatter: 1, // while the page scrolls, the sharks swim out of the screen
  leave: 0.8, // seconds to swim out
  back: 2.4, // seconds to swim back in once the scroll stops
  wander: 1, // every school's own random path
  tile: narrow ? 0.85 : 0.7, // size of the sharks (one tile of the sea, relative to the screen)
  size: 1.15, // point size (1 = one grid cell)
  density: narrow ? 0.85 : 1,
  depth: 1.2, // how far the ink comes forward
  layers: 2.6, // schools at different depths
  edge: 1, // glow of the edges of the drawing
  blow: 1, // pointer blows the points apart
  tilt: 12, // camera lean (deg)
  speed: 1 // video playback rate
};
const VIEW = { brand: true, playing: !reduce };

const host = document.getElementById('bg');
const video = document.querySelector('.lz-src');
const FOV = 38, H = 10; // the plane z = 0 fills the screen exactly: 10 world units high

let renderer;
try { renderer = new Renderer({ dpr: Math.min(devicePixelRatio || 1, 1.75), alpha: false, antialias: false, depth: false, webgl: 2 }); } catch (e) { renderer = null; }
if (renderer && renderer.isWebgl2) run();

function run() {
  const gl = renderer.gl;
  gl.clearColor(10 / 255, 10 / 255, 10 / 255, 1);
  host.appendChild(gl.canvas);
  const camera = new Camera(gl, { fov: FOV, near: 0.1, far: 200 });
  const scene = new Transform();
  const DIST = H / 2 / Math.tan((FOV * Math.PI) / 360);

  // the video as a texture, uploaded only when it has a new frame
  const tex = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE });
  const rvfc = 'requestVideoFrameCallback' in video;
  let fresh = false, hasFrame = false;
  const onFrame = () => { fresh = true; video.requestVideoFrameCallback(onFrame); };
  if (rvfc) video.requestVideoFrameCallback(onFrame);
  const upload = () => {
    if (video.readyState < 2) return;
    if (!hasFrame) { tex.image = video; hasFrame = true; fresh = true; }
    if (fresh || !rvfc) { tex.needsUpdate = true; fresh = false; }
  };

  const U = {
    tVid: { value: tex }, uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uPx: { value: 1 }, uView: { value: [1, 1] }, uCell: { value: [0, 0] },
    uSpacing: { value: 0.03 }, uTile: { value: [1, 1] }, uRot: { value: 0 }, uOff: { value: [0, 0] }, uTexel: { value: [1 / 720, 1 / 1280] },
    uSize: { value: S.size }, uDepth: { value: S.depth }, uLayers: { value: S.layers }, uEdge: { value: S.edge }, uWander: { value: S.wander },
    uBlow: { value: 0 }, uPtr: { value: [0, 0, 0] }, uBrand: { value: 1 }, uScat: { value: 0 }, uOn: { value: reduce ? 1 : 0 },
    uA: { value: [82 / 255, 39 / 255, 1] }, uB: { value: [177 / 255, 158 / 255, 239 / 255] }
  };

  const program = new Program(gl, {
    vertex: /* glsl */ `#version 300 es
      in vec3 position; // x, y across the screen (-.5 … .5), random
      uniform mat4 viewMatrix, projectionMatrix; uniform sampler2D tVid;
      uniform float uTime, uDpr, uPx, uSpacing, uSize, uDepth, uLayers, uEdge, uWander, uBlow, uBrand, uScat, uOn, uRot;
      uniform vec2 uView, uCell, uTile, uOff, uTexel; uniform vec3 uPtr, uA, uB;
      out vec3 vC; out float vA;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float lum(vec2 uv) { return dot(texture(tVid, uv).rgb, vec3(.299, .587, .114)); }
      void main() {
        float r = position.z;
        vec2 p0 = (position.xy + (vec2(fract(r * 91.7), fract(r * 57.3)) - .5) * uCell) * uView;

        // which tile of the sea this point looks into, and where inside it
        vec2 o = (p0 + uOff) / uTile;
        vec2 cell = floor(o), f = fract(o);
        float h = hash(cell), h2 = hash(cell + 17.31), h3 = hash(cell + 41.7);
        // every tile wanders on its own slow path
        vec2 g = f + uWander * .13 * vec2(sin(uTime * (.07 + .06 * h2) + h * 40.), cos(uTime * (.06 + .05 * h3) + h2 * 30.));
        if (uRot > .5) g = vec2(g.y, 1. - g.x); // landscape screens: the 9:16 video lies on its side
        if (h3 > .5) g.x = 1. - g.x; // mirrored its own way
        if (fract(h * 7.13) > .5) g.y = 1. - g.y;
        // fade at the tile's edges and at the video's own edges: sharks swim out of sight instead of being cut
        vec2 ef = min(f, 1. - f) * uTile;
        vec2 eg = min(g, 1. - g);
        float fade = smoothstep(0., .9, min(ef.x, ef.y)) * smoothstep(0., .06, min(eg.x, eg.y));
        g = clamp(g, .004, .996);
        float qd = floor(h * 4.); // one of the four moments of the loop
        vec2 uv = (vec2(mod(qd, 2.), floor(qd / 2.)) + g) * .5;

        vec3 rgb = texture(tVid, uv).rgb;
        float l = dot(rgb, vec3(.299, .587, .114));
        // only the ink fades out at the edges (the paper stays even, so no seams show)
        float ink = smoothstep(.62, .22, l) * fade;
        vec2 t = uTexel * 1.5;
        float gx = lum(uv + vec2(t.x, 0.)) - lum(uv - vec2(t.x, 0.));
        float gy = lum(uv + vec2(0., t.y)) - lum(uv - vec2(0., t.y));
        float edge = clamp(length(vec2(gx, gy)) * 2.2, 0., 1.) * fade;

        // each school at its own depth, in front of the paper
        vec3 p = vec3(p0, ink * ((h2 - .55) * uLayers + uDepth * (1. - .35 * edge))); // the paper stays one even plane
        p += .03 * vec3(sin(uTime * 1.3 + r * 40.), sin(uTime * 1.1 + r * 60.), sin(uTime * .9 + r * 80.));

        // scrolling: every school swims out of the screen, away from the middle, on a slightly curved path; once the
        // scroll stops they come straight back in from the edges (each a little sooner or later than the others)
        vec2 cc = (cell + .5) * uTile - uOff;
        vec2 dir = normalize(cc + (vec2(h, h3) - .5) * uTile * .6 + 1e-4);
        float sc = smoothstep(0., 1., clamp(uScat * 1.35 - h * .35, 0., 1.));
        float bend = (h2 - .5) * 1.4 * sc;
        dir = mat2(cos(bend), sin(bend), -sin(bend), cos(bend)) * dir;
        float reach = length(uView) * .55 + max(uTile.x, uTile.y) * .6;
        float swim = smoothstep(0., .08, ink); // the sharks swim, the paper stays
        p.xy += dir * sc * reach * swim;
        p.z -= sc * 1.5 * swim;

        // the pointer blows the points apart
        vec2 d = p.xy - uPtr.xy; float dl = length(d);
        float bl = uBlow * exp(-dl * dl / .55);
        p.xy += d / max(dl, 1e-3) * bl * .7 * (.6 + .8 * r);
        p.z += bl * (.8 + 1.4 * r);

        // intro: in from a scattered cloud
        vec3 from = p + vec3(sin(r * 311.) * 9., cos(r * 173.) * 9., -8. - 14. * fract(r * 13.7));
        p = mix(from, p, smoothstep(r * .45, r * .45 + .55, uOn));

        vec4 mv = viewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;

        vec3 brand = mix(uA * .9, mix(uB, vec3(1.), .35), clamp(edge * uEdge * 1.3 + ink * .15, 0., 1.));
        float aBrand = ink * (.5 + .5 * clamp(edge * uEdge, 0., 1.)); // (the paper's dust is its own layer, below)
        vec3 cBrand = mix(vec3(.55, .5, .75), brand, ink);
        vec3 cOrig = mix(vec3(.93), rgb, fade) * (1. + edge * uEdge * .4);
        float aOrig = (1. - ink) * .7;
        vC = mix(cOrig, cBrand, uBrand) * (.75 + .5 * r) * (1. + bl * .8);
        vA = mix(aOrig, aBrand, uBrand) * smoothstep(0., .25, uOn);
        float sz = uSize * uSpacing * uPx / -mv.z * mix(.8, 1.2, ink * uBrand + (1. - ink) * (1. - uBrand));
        gl_PointSize = vA < .004 ? 0. : clamp(sz, 1., 9. * uDpr);
      }`,
    fragment: /* glsl */ `#version 300 es
      precision highp float; in vec3 vC; in float vA; out vec4 o;
      void main() { vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
        o = vec4(vC * vA * smoothstep(.25, .02, r), 1.); }`,
    uniforms: U, transparent: true, depthTest: false, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE);

  // the paper's faint dust: its own layer of the same points that never swims away, so the sharks leave no holes
  const dust = new Program(gl, {
    vertex: /* glsl */ `#version 300 es
      in vec3 position;
      uniform mat4 viewMatrix, projectionMatrix;
      uniform float uTime, uDpr, uPx, uSpacing, uSize, uBlow, uBrand, uOn; uniform vec2 uView, uCell; uniform vec3 uPtr;
      out float vA; out float vR;
      void main() {
        float r = position.z;
        vec3 p = vec3((position.xy + (vec2(fract(r * 91.7), fract(r * 57.3)) - .5) * uCell) * uView, 0.);
        p += .03 * vec3(sin(uTime * 1.3 + r * 40.), sin(uTime * 1.1 + r * 60.), sin(uTime * .9 + r * 80.));
        vec2 d = p.xy - uPtr.xy; float dl = length(d);
        float bl = uBlow * exp(-dl * dl / .55);
        p.xy += d / max(dl, 1e-3) * bl * .7 * (.6 + .8 * r);
        p.z += bl * (.8 + 1.4 * r);
        vec4 mv = viewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        vA = .05 * uBrand * smoothstep(0., .25, uOn); vR = r;
        gl_PointSize = vA < .004 ? 0. : clamp(uSize * uSpacing * uPx / -mv.z * .8, 1., 9. * uDpr);
      }`,
    fragment: /* glsl */ `#version 300 es
      precision highp float; in float vA; in float vR; out vec4 o;
      void main() { vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
        o = vec4(vec3(.55, .5, .75) * (.75 + .5 * vR) * vA * smoothstep(.25, .02, r), 1.); }`,
    uniforms: U, transparent: true, depthTest: false, depthWrite: false
  });
  dust.setBlendFunc(gl.ONE, gl.ONE);

  // the fixed grid of points over the screen (with a margin for the camera's lean)
  const M = 1.3;
  let points = null, dusts = null;
  const grid = () => {
    const a = innerWidth / innerHeight;
    let cols = Math.round((narrow ? 170 : 300) * S.density * M), rows = Math.round((cols / a));
    const MAX = narrow ? 80000 : 200000;
    if (cols * rows > MAX) { const k = Math.sqrt(MAX / (cols * rows)); cols = Math.round(cols * k); rows = Math.round(rows * k); }
    const data = new Float32Array(cols * rows * 3);
    let k = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      data[k++] = (x + 0.5) / cols - 0.5; data[k++] = (y + 0.5) / rows - 0.5; data[k++] = Math.random();
    }
    U.uView.value = [H * a * M, H * M];
    U.uCell.value = [1 / cols, 1 / rows];
    U.uSpacing.value = (H * a * M) / cols;
    if (points) { points.setParent(null); dusts.setParent(null); points.geometry.remove(); }
    const geometry = new Geometry(gl, { position: { size: 3, data } });
    dusts = new Mesh(gl, { geometry, program: dust, mode: gl.POINTS, frustumCulled: false });
    dusts.setParent(scene);
    points = new Mesh(gl, { geometry, program, mode: gl.POINTS, frustumCulled: false });
    points.setParent(scene);
  };
  // one tile of the sea: the video's long side follows the screen's long side
  const tiles = () => {
    const a = innerWidth / innerHeight, land = a > 1;
    U.uRot.value = land ? 1 : 0;
    U.uTile.value = land ? [H * a * S.tile, H * a * S.tile * (9 / 16)] : [H * S.tile * (9 / 16), H * S.tile];
  };
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.perspective({ aspect: innerWidth / innerHeight });
    U.uPx.value = (innerHeight * renderer.dpr) / (2 * Math.tan((FOV * Math.PI) / 360));
    U.uDpr.value = renderer.dpr;
    tiles();
  };
  resize(); grid();
  let rz = 0, lw = innerWidth;
  addEventListener('resize', () => {
    resize();
    clearTimeout(rz);
    // a phone's address bar sliding is not a new layout
    if (innerWidth !== lw) rz = setTimeout(() => { lw = innerWidth; grid(); }, 250);
  });

  // ---------- scroll, pointer (damped with GSAP) ----------
  const st = { sy: scrollY, yaw: 0, pitch: 0, blow: 0, px: innerWidth / 2, py: innerHeight / 2 };
  const q = (k, d) => (gsap && !reduce ? gsap.quickTo(st, k, { duration: d, ease: 'power2.out' }) : v => { st[k] = v; });
  let toSy = q('sy', S.lag);
  const toYaw = q('yaw', 1.1), toPitch = q('pitch', 1.1), toBlow = q('blow', 0.7), toPx = q('px', 0.25), toPy = q('py', 0.25);
  // scroll on: the sharks swim away; scroll stopped: right away they start swimming back in from the edges
  let leaving = false, still = 0;
  st.scat = 0;
  const comeBack = () => { leaving = false; if (gsap) gsap.to(st, { scat: 0, duration: S.back, ease: 'power2.out', overwrite: true }); else st.scat = 0; };
  addEventListener('scroll', () => {
    toSy(scrollY);
    if (reduce) return;
    if (!leaving) { leaving = true; if (gsap) gsap.to(st, { scat: 1, duration: S.leave, ease: 'power2.in', overwrite: true }); else st.scat = 1; }
    clearTimeout(still); still = setTimeout(comeBack, 140);
  }, { passive: true });
  let lean = { x: 0, y: 0 };
  const off = el => el && el.closest && el.closest('.lab-panel, .lab-toggle, .gm');
  addEventListener('pointermove', e => {
    if (off(e.target)) { toBlow(0); return; }
    toPx(e.clientX); toPy(e.clientY);
    if (e.pointerType === 'mouse') toBlow(1);
    lean = { x: (e.clientX / innerWidth) * 2 - 1, y: (e.clientY / innerHeight) * 2 - 1 };
  }, { passive: true });
  // a finger blows the points while it moves (also while it scrolls the page)
  addEventListener('touchmove', e => {
    const t = e.touches[0]; if (!t || off(e.target)) return;
    toPx(t.clientX); toPy(t.clientY); toBlow(1);
  }, { passive: true });
  addEventListener('touchstart', e => { const t = e.touches[0]; if (t && !off(e.target)) { st.px = t.clientX; st.py = t.clientY; } }, { passive: true });
  addEventListener('touchend', () => toBlow(0), { passive: true });
  document.documentElement.addEventListener('pointerleave', () => toBlow(0));

  const v = new Vec3();
  const pointer = () => {
    v.set((st.px / innerWidth) * 2 - 1, 1 - (st.py / innerHeight) * 2, 0.5);
    camera.unproject(v);
    const o = camera.position, dz = v.z - o.z, t = Math.abs(dz) > 1e-5 ? -o.z / dz : 0;
    U.uPtr.value = [o.x + (v.x - o.x) * t, o.y + (v.y - o.y) * t, 0];
  };

  // ---------- video, intro ----------
  const playVideo = () => { const p = video.play(); if (p && p.catch) p.catch(() => { VIEW.playing = false; syncPlay(); }); };
  video.playbackRate = S.speed;
  if (VIEW.playing) playVideo(); else video.pause();
  let started = false;
  const ready = () => {
    if (started) return; started = true; upload();
    if (!reduce && gsap) gsap.to(U.uOn, { value: 1, duration: 3, ease: 'power2.inOut' }); else U.uOn.value = 1;
  };
  if (video.readyState >= 2) ready(); else video.addEventListener('loadeddata', ready, { once: true });

  // ---------- render ----------
  let raf = 0, last = performance.now(), time = 0;
  const tick = now => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05); last = now; time += dt;
    upload();
    const k = H / innerHeight; // px → world
    // the sea: carried by the (damped) scroll, and drifting slowly on its own
    const W = reduce ? 0 : S.wander;
    U.uOff.value = [
      W * (Math.sin(time * 0.031) * 2.2 + Math.sin(time * 0.017 + 1.3) * 1.6),
      S.follow * st.sy * k + W * (Math.cos(time * 0.023) * 1.6 + Math.sin(time * 0.041 + 0.7) * 0.9)
    ];
    // camera: leans into the scroll (while the sea is catching up) and after the pointer
    const T = (S.tilt * Math.PI) / 180;
    const pull = Math.max(-1, Math.min(1, ((scrollY - st.sy) / innerHeight) * 2.5));
    toYaw(lean.x * T); toPitch(-lean.y * T * 0.6 - pull * T);
    camera.position.set(Math.sin(st.yaw) * Math.cos(st.pitch) * DIST, Math.sin(st.pitch) * DIST, Math.cos(st.yaw) * Math.cos(st.pitch) * DIST);
    camera.lookAt([0, 0, 0]);
    camera.updateMatrixWorld();
    pointer();
    U.uScat.value = st.scat * S.scatter;
    U.uTime.value = time; U.uBlow.value = st.blow * S.blow;
    U.uBrand.value += ((VIEW.brand ? 1 : 0) - U.uBrand.value) * 0.08;
    renderer.render({ scene, camera });
  };
  raf = requestAnimationFrame(tick);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (document.hidden) video.pause();
    else { if (VIEW.playing) playVideo(); last = performance.now(); raf = requestAnimationFrame(tick); }
  });

  // ---------- panel ----------
  const fmt = (key, x) => (key === 'tilt' ? String(Math.round(x)) : Number(x).toFixed(2));
  const apply = key => {
    if (key === 'size') U.uSize.value = S.size;
    else if (key === 'depth') U.uDepth.value = S.depth;
    else if (key === 'layers') U.uLayers.value = S.layers;
    else if (key === 'edge') U.uEdge.value = S.edge;
    else if (key === 'wander') U.uWander.value = S.wander;
    else if (key === 'tile') tiles();
    else if (key === 'speed') video.playbackRate = S.speed;
    else if (key === 'lag') toSy = q('sy', S.lag);
  };
  document.querySelectorAll('[data-set]').forEach(inp => {
    const key = inp.dataset.set, out = inp.parentElement.querySelector('output');
    inp.value = S[key];
    const show = () => { if (out) out.textContent = fmt(key, inp.value); };
    show();
    inp.addEventListener('input', () => { S[key] = Number(inp.value); show(); if (key !== 'density') apply(key); });
    if (key === 'density') inp.addEventListener('change', grid);
  });
  const colors = document.getElementById('colors');
  colors.setAttribute('aria-pressed', 'true');
  colors.addEventListener('click', () => { VIEW.brand = !VIEW.brand; colors.setAttribute('aria-pressed', String(VIEW.brand)); });
  const playBtn = document.getElementById('play');
  const syncPlay = () => { playBtn.textContent = VIEW.playing ? 'Pauza' : 'Přehrát'; };
  playBtn.addEventListener('click', () => { VIEW.playing = !VIEW.playing; if (VIEW.playing) playVideo(); else video.pause(); syncPlay(); });
  syncPlay();
  document.getElementById('panel-toggle').addEventListener('click', () => document.body.classList.add('panel-closed'));
  document.querySelector('.lab-toggle').addEventListener('click', () => document.body.classList.remove('panel-closed'));
  const copy = document.getElementById('copy');
  copy.addEventListener('click', () => {
    const txt = JSON.stringify({ ...S, barvyWebu: VIEW.brand });
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { copy.textContent = 'Zkopírováno ✓'; }, () => { prompt('Nastavení:', txt); });
    setTimeout(() => { copy.textContent = 'Zkopírovat nastavení'; }, 1800);
  });
}
