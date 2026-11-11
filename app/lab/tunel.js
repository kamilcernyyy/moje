/* Grafysta lab: the "Mé práce" tunnel with our sea creatures instead of the works.
   The same tunnel as the hero of "Mé práce" (Originkit hero-03 / gallery tunnel): 2 × 1.8 wide, segments 1 deep, a
   4 × 4 grid of lines in #4A4560, every other segment carrying slabs on the floor, the ceiling and both walls, half of
   the slots filled, fog of the background colour, the camera drifting forward (faster while pressed). Here the image
   slabs are our animals made of particles (the shark, the octopus, the jellyfish, both mantas, the hammerhead, the
   anglerfish), each lying on its slab and moving in its own way (tails, arms, wings, fins); as the camera comes near
   they lift off the wall and move more. The colour slabs stay, as stippled panels in the site's colours.
   The scroll flies the camera on through the tunnel (much farther than on the page), the copy flying past it. */
import { Program, Mesh, Geometry, Transform } from 'ogl';
import { stage, drawing, sample, panel, reduce, narrow, gsap, VIOLET, LILAC, GLSL_TONE } from './tvor.js';

const S = {
  flight: 6, // tunnel segments flown per screen of scroll
  speed: 1, // drifting speed when the page is still
  share: 0.7, // how many of the slabs are animals (the rest colour)
  motion: 1, // how much the animals move
  fog: 1, // how far one sees down the tunnel
  size: 1 // particle size
};
const st = stage({ fov: 45 });
const { gl, scene, camera, renderer } = st;
camera.near = 0.02; camera.perspective({});

// ---------- the tunnel (as on "Mé práce") ----------
const TW = 2, TH = 1.8, SEG = 1, NSEG = 15, GRID = 4, hw = TW / 2, hh = TH / 2, colW = TW / GRID, rowH = TH / GRID;
const FOG_FAR = NSEG * SEG * 0.95;
const FOG = /* glsl */ `float fogOf(float d, float far) { return clamp(1. - d / far, 0., 1.); }`;

// the slots of one segment: floor and ceiling (a column each), the two walls (a row each)
const SLOTS = [];
for (let i = 0; i < GRID; i++) {
  const x = -hw + i * colW + colW / 2;
  SLOTS.push({ c: [x, -hh, -SEG / 2], n: [0, 1, 0], b: [1, 0, 0], short: colW });
  SLOTS.push({ c: [x, hh, -SEG / 2], n: [0, -1, 0], b: [1, 0, 0], short: colW });
}
for (let i = 0; i < GRID; i++) {
  const y = -hh + i * rowH + rowH / 2;
  SLOTS.push({ c: [-hw, y, -SEG / 2], n: [1, 0, 0], b: [0, 1, 0], short: rowH });
  SLOTS.push({ c: [hw, y, -SEG / 2], n: [-1, 0, 0], b: [0, 1, 0], short: rowH });
}

// lines: NSEG + 1 segments of them, moved along with the camera one segment at a time
const lines = [];
for (let s = 0; s <= NSEG; s++) {
  const z0 = -s * SEG, z1 = z0 - SEG;
  const L = (a, b) => lines.push(...a, ...b);
  for (let i = 0; i <= GRID; i++) { const x = -hw + i * colW; L([x, -hh, z0], [x, -hh, z1]); L([x, hh, z0], [x, hh, z1]); }
  for (let i = 1; i < GRID; i++) { const y = -hh + i * rowH; L([-hw, y, z0], [-hw, y, z1]); L([hw, y, z0], [hw, y, z1]); }
  L([-hw, -hh, z0], [hw, -hh, z0]); L([-hw, hh, z0], [hw, hh, z0]); L([-hw, -hh, z0], [-hw, hh, z0]); L([hw, -hh, z0], [hw, hh, z0]);
}
const LU = { uFar: { value: FOG_FAR }, uColor: { value: [0x4a / 255, 0x45 / 255, 0x60 / 255] } };
const lineProg = new Program(gl, {
  vertex: `attribute vec3 position; uniform mat4 modelViewMatrix, projectionMatrix; uniform float uFar; varying float vF; ${FOG}
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vF = fogOf(-mv.z, uFar); gl_Position = projectionMatrix * mv; }`,
  fragment: `precision highp float; uniform vec3 uColor; varying float vF; void main(){ gl_FragColor = vec4(uColor * .5 * 1.6 * vF, 1.); }`,
  uniforms: LU, transparent: true, depthTest: false, depthWrite: false
});
lineProg.setBlendFunc(gl.ONE, gl.ONE);
const lineMesh = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: new Float32Array(lines) } }), program: lineProg, mode: gl.LINES, frustumCulled: false });
lineMesh.setParent(scene);

// ---------- slabs: instances laid on the slots ----------
// an instance: iC middle, iA the slab's long way (down the tunnel), iB across, iN out of the wall, iS scale (long, short),
// phase, mirror
const MAXI = 90;
const instAttrs = () => ({
  iC: { instanced: 1, size: 3, data: new Float32Array(MAXI * 3) }, iA: { instanced: 1, size: 3, data: new Float32Array(MAXI * 3) },
  iB: { instanced: 1, size: 3, data: new Float32Array(MAXI * 3) }, iN: { instanced: 1, size: 3, data: new Float32Array(MAXI * 3) },
  iS: { instanced: 1, size: 4, data: new Float32Array(MAXI * 4) }
});
const INST = /* glsl */ `in vec3 iC; in vec3 iA; in vec3 iB; in vec3 iN; in vec4 iS;`;

const common = {
  uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uPx: { value: 1 }, uSize: { value: 1 }, uOrig: { value: 0 }, uFar: { value: FOG_FAR },
  uMotion: { value: 1 }, uA: { value: VIOLET }, uB: { value: LILAC }
};

// the animals: where their drawing is, how thick, and how each of them moves (a wave along the body from its seed:
// where it starts, how strong sideways and out of the wall, how many waves, how fast)
const ANIMALS = [
  { base: '/lab/tunel/zralok', hmax: 80.9, start: 0.3, side: 0.07, lift: 0.04, k: 7, f: 0.9 },
  { base: '/lab/chobotnice/chobotnice', hmax: 120, start: 0.24, side: 0.05, lift: 0.05, k: 17, f: 0.55 },
  { base: '/lab/meduza/meduza', hmax: 140.9, start: 0.2, side: 0.04, lift: 0.05, k: 15, f: 0.5, pulse: 1 },
  { base: '/lab/manty/manta-a', hmax: 80.8, start: 0.15, side: 0.01, lift: 0.14, k: 3, f: 0.5 },
  { base: '/lab/manty/manta-b', hmax: 115.6, start: 0.15, side: 0.01, lift: 0.14, k: 3, f: 0.5 },
  { base: '/lab/kladivoun/kladivoun', hmax: 101.7, start: 0.25, side: 0.06, lift: 0.03, k: 7, f: 0.75 },
  { base: '/lab/das/das', hmax: 173.2, start: 0.45, side: 0.025, lift: 0.05, k: 12, f: 1.1 }
];
const animalVertex = A => /* glsl */ `#version 300 es
  in vec4 position; in vec4 aBody; ${INST}
  uniform mat4 viewMatrix, projectionMatrix; uniform vec3 cameraPosition;
  uniform float uTime, uDpr, uPx, uSize, uOrig, uFar, uMotion, uSp, uSwap; uniform vec3 uA, uB;
  out vec3 vC; out float vA; out float vD;
  ${GLSL_TONE}
  ${FOG}
  void main() {
    float r = position.w, s = aBody.x, L = aBody.w;
    if (iS.x <= 0.) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
    // the drawing in its own units (its long side = 1), laid with its long side down the slab
    vec2 q = uSwap > .5 ? position.yx : position.xy;
    vec2 t = uSwap > .5 ? aBody.zy : aBody.yz;
    vec2 perp = vec2(-t.y, t.x);
    q.x *= iS.w;
    // near the camera it comes alive: lifts off the wall and moves more
    float near = smoothstep(7., 1.2, distance(iC, cameraPosition));
    float ph = uTime * ${A.f.toFixed(2)} * 6.2832 + iS.z;
    float sn = clamp((s - ${A.start.toFixed(2)}) / ${(1 - A.start).toFixed(2)}, 0., 1.);
    float m = uMotion * (.45 + .55 * near);
    float w = pow(sn, 1.4) * sin(ph - s * ${A.k.toFixed(1)});
    q += perp * ${A.side.toFixed(3)} * w * m;
    float up = abs(position.z) * .5 + .006 + ${A.lift.toFixed(3)} * pow(sn, 1.4) * (cos(ph - s * ${A.k.toFixed(1)}) * .5 + .5) * m + .05 * near * m;
    ${A.pulse ? `float bell = 1. - smoothstep(.17, .23, s); float pz = pow(sin(ph * .5) * .5 + .5, 3.); q.y *= 1. - .1 * bell * pz * m; q.x *= 1. - .05 * bell * pz * m;` : ''}
    vec3 p = iC + iA * q.x * iS.x + iB * q.y * iS.y + iN * up * iS.y;
    vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z;
    gl_Position = projectionMatrix * mv;
    vC = toneColor(L, uOrig, uA, uB) * (.75 + .5 * r) * (1. + .25 * near);
    vA = toneAlpha(L, uOrig) * fogOf(vD, uFar);
    gl_PointSize = clamp(1.5 * uSize * uSp * iS.x * uPx / max(vD, .05), 1., 7. * uDpr * max(uSize, .4));
  }`;
const FRAG = /* glsl */ `#version 300 es
  precision highp float; in vec3 vC; in float vA; in float vD; out vec4 o;
  void main() { vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; o = vec4(vC * vA * smoothstep(.25, .02, r), 1.); }`;

const animals = ANIMALS.map(A => {
  const U = { ...common, uSp: { value: 0.01 }, uSwap: { value: 0 } };
  const program = new Program(gl, { vertex: animalVertex(A), fragment: FRAG, uniforms: U, transparent: true, depthTest: false, depthWrite: false });
  program.setBlendFunc(gl.ONE, gl.ONE);
  const it = { A, U, mesh: null, aspect: 1, list: [] };
  drawing(A.base).then(d => {
    const m = Math.max(d.w, d.h);
    const { pos, body, spacing } = sample(d, { N: narrow ? 2600 : 5000, sc: 1 / m, hmax: A.hmax, thick: 0.6 });
    U.uSp.value = spacing; U.uSwap.value = d.h > d.w ? 1 : 0;
    it.aspect = Math.min(d.w, d.h) / m; // short side of the drawing, its long side = 1
    it.mesh = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: pos }, aBody: { size: 4, data: body }, ...instAttrs() }), program, mode: gl.POINTS, frustumCulled: false });
    it.mesh.setParent(scene);
    dirty = true;
  });
  return it;
});

// colour slabs: a stippled panel in one of the site's colours
const PALETTE = ['#5227FF', '#B19EEF', '#FF4F9A', '#FF8A3D', '#2E1A8C', '#7C5CFF'].map(h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255));
const dots = new Float32Array((narrow ? 900 : 1600) * 4);
for (let k = 0; k < dots.length; k += 4) { dots[k] = Math.random() - 0.5; dots[k + 1] = Math.random() - 0.5; dots[k + 2] = Math.random(); dots[k + 3] = Math.random(); }
const CU = { ...common, uPal: { value: PALETTE.flat() } };
const colourProg = new Program(gl, {
  vertex: /* glsl */ `#version 300 es
    in vec4 position; ${INST}
    uniform mat4 viewMatrix, projectionMatrix; uniform float uTime, uDpr, uPx, uSize, uOrig, uFar; uniform vec3 uPal[6];
    out vec3 vC; out float vA; out float vD;
    ${FOG}
    void main() {
      if (iS.x <= 0.) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
      vec3 p = iC + iA * position.x * iS.x * .94 + iB * position.y * iS.y * .94 + iN * .003;
      vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z;
      gl_Position = projectionMatrix * mv;
      vec3 c = uPal[int(iS.z)];
      vC = mix(c, vec3(dot(c, vec3(.3, .59, .11))), uOrig) * (.6 + .6 * position.z);
      vA = (.32 + .2 * sin(uTime * 1.5 + position.w * 30.)) * fogOf(vD, uFar);
      gl_PointSize = clamp(2.2 * uSize * .03 * uPx / max(vD, .05), 1., 6. * uDpr);
    }`,
  fragment: FRAG, uniforms: CU, transparent: true, depthTest: false, depthWrite: false
});
colourProg.setBlendFunc(gl.ONE, gl.ONE);
const colourMesh = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: dots }, ...instAttrs() }), program: colourProg, mode: gl.POINTS, frustumCulled: false });
colourMesh.setParent(scene);

// which slab gets what: the same every time for a segment (a hash of its number and the slot), like the original's mix
const hash = (a, b, c) => { const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return x - Math.floor(x); };
let base = -999, dirty = true;
const populate = () => {
  const counts = animals.map(() => 0);
  let cc = 0;
  const put = (geo, k, slot, z, sLong, sShort, a, b) => {
    const at = geo.attributes;
    at.iC.data.set([slot.c[0], slot.c[1], z], k * 3);
    at.iA.data.set([0, 0, -1], k * 3); at.iB.data.set(slot.b, k * 3); at.iN.data.set(slot.n, k * 3);
    at.iS.data.set([sLong, sShort, a, b], k * 4);
  };
  for (let s = 0; s < NSEG; s++) {
    const seg = base + s;
    if (seg % 2) continue; // every other segment carries slabs
    const z = -seg * SEG - SEG / 2;
    SLOTS.forEach((slot, j) => {
      if (hash(seg, j, 1) > 0.5) return;
      if (hash(seg, j, 2) < S.share) {
        const ai = Math.floor(hash(seg, j, 3) * animals.length) % animals.length, an = animals[ai];
        if (!an.mesh || counts[ai] >= MAXI) return;
        // fit the drawing in the slab (its long side down the tunnel), mirrored at random
        const sc = Math.min(0.92, (slot.short * 0.92) / an.aspect);
        put(an.mesh.geometry, counts[ai]++, slot, z, sc, sc, hash(seg, j, 4) * 6.28, hash(seg, j, 5) > 0.5 ? 1 : -1);
      } else if (cc < MAXI) {
        put(colourMesh.geometry, cc++, slot, z, SEG, slot.short, Math.floor(hash(seg, j, 6) * 6), 0);
      }
    });
  }
  const clear = (geo, from) => { const d = geo.attributes.iS.data; for (let k = from; k < MAXI; k++) d[k * 4] = 0; for (const a of ['iC', 'iA', 'iB', 'iN', 'iS']) geo.attributes[a].needsUpdate = true; };
  animals.forEach((an, i) => { if (an.mesh) clear(an.mesh.geometry, counts[i]); });
  clear(colourMesh.geometry, cc);
};

// ---------- flight: drifting on its own (faster while pressed), the scroll flies it on ----------
const fly = { z: 0 };
const toZ = gsap.quickTo(fly, 'z', { duration: 1.1, ease: 'power3.out' });
let pressed = false;
addEventListener('pointerdown', e => { if (!(e.target.closest && e.target.closest('.lab-panel, .lab-toggle, .gm, .lab-nav, a, button'))) pressed = true; });
addEventListener('pointerup', () => { pressed = false; });
const lean = { x: 0, y: 0 };
const tx = gsap.quickTo(lean, 'x', { duration: 1.2, ease: 'power3.out' }), ty = gsap.quickTo(lean, 'y', { duration: 1.2, ease: 'power3.out' });
addEventListener('pointermove', e => { tx((e.clientX / innerWidth) * 2 - 1); ty((e.clientY / innerHeight) * 2 - 1); }, { passive: true });
const hero = document.querySelector('.lt-hero');
const onScroll = () => {
  toZ((scrollY / innerHeight) * S.flight * SEG);
  // the copy flies past the camera and is gone (as on "Mé práce")
  const c = Math.min(1, scrollY / (innerHeight * 0.6));
  if (hero) { hero.style.opacity = String(1 - c); hero.style.transform = `scale(${1 + c * 0.7})`; hero.style.filter = `blur(${(c * 8).toFixed(1)}px)`; }
};
addEventListener('scroll', onScroll, { passive: true }); onScroll();

const COL = panel(S, { onInput: () => { dirty = true; } });
let drift = 0, time = 0, last = performance.now();
const tick = now => {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const go = reduce ? 0 : dt;
  time += go;
  drift += go * 0.27 * S.speed * (pressed ? 3.3 : 1); // the original's pace: speed 9, boost 30
  const z = -(drift + fly.z);
  camera.position.set(lean.x * 0.18, -lean.y * 0.14, z);
  camera.lookAt([lean.x * 0.05, -lean.y * 0.04, z - 4]);
  const b = Math.floor(-z / SEG) - 1;
  if (b !== base || dirty) { base = b; dirty = false; populate(); }
  lineMesh.position.z = -base * SEG;
  const far = FOG_FAR * S.fog;
  common.uTime.value = time; common.uSize.value = S.size; common.uMotion.value = S.motion; common.uFar.value = far; LU.uFar.value = far;
  common.uPx.value = st.px(); common.uDpr.value = renderer.dpr;
  common.uOrig.value += (COL.orig - common.uOrig.value) * 0.08;
  renderer.render({ scene, camera });
};
requestAnimationFrame(tick);
