/* Grafysta lab: the glass tunnel through a flooded rainforest, our animals living all round it.
   The forest is the user's picture read into depth (an estimated depth map, edge-refined): a forward view turned into a
   3D chunk of forest (floor near at the bottom, trunks and ferns at the sides, haze far in the middle). Chunks follow
   one another down the tunnel, every other one mirrored, so the forest goes on and keeps changing as we walk; nothing
   of it is inside the tunnel. Three ways to build it (switch in the panel):
     částice   – all of it points (opaque, depth-tested), swaying in the current;
     vrstvy    – the picture cut into four depth layers, each a textured plane, passing at its own pace;
     kombinace – the far layer as a soft photo, everything nearer as points.
   The water: its colour swallows what is far, light falls in shafts, snow sinks.
   The animals, two ways at once (both can be switched off):
     ekosystém – they live on their own and really travel: each has a lane (some close to the glass, some far out),
                 steers for waypoints, banks into turns; sharks cruise, mantas glide over, the hammerhead crosses under
                 the floor or over the roof, jellyfish drift up pulse by pulse, octopuses crawl the floor and jet off,
                 the anglerfish lurks low with its lure alight;
     scény     – one staged moment per stretch of the page, scrubbed by the scroll: a giant manta skims the roof, a shark
                 passes along the glass at arm's length, a bloom of jellyfish rises round us, an octopus lands on the
                 glass and jets away, a hammerhead crosses under the floor, the anglerfish comes out of the dark (the
                 forest goes dark round it). The camera turns a little to look at them.
   The camera drifts down the tunnel (faster while pressed), the scroll flies it on, the pointer turns the head. */
import { Renderer, Camera, Transform, Program, Mesh, Geometry, Texture, Plane } from 'ogl';
import { drawing, sample, reduce, narrow, gsap, VIOLET, LILAC, GLSL_TONE } from './tvor.js';

const S = {
  flight: 6, // tunnel segments flown per screen of scroll
  speed: 1, // drifting speed when the page is still
  animals: 1, // how many animals live round the tunnel
  glass: 1, // how much the glass shows
  light: 1, // light shafts from above
  sway: 1, // the forest swaying in the current
  clear: 3.4, // half the width of the open water round the tunnel
  size: 1 // particle size
};
const VIEW = { pozadi: 'castice', barvy: 'puvodni', sceny: true, ekosystem: true };

// ---------- stage (with a depth buffer: the forest and the animals hide one another) ----------
const FOV = 50;
const renderer = new Renderer({ dpr: Math.min(devicePixelRatio || 1, 1.5), alpha: false, antialias: false, depth: true, webgl: 2 });
const gl = renderer.gl;
document.getElementById('bg').appendChild(gl.canvas);
const camera = new Camera(gl, { fov: FOV, near: 0.02, far: 120 });
const scene = new Transform();
const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.perspective({ aspect: innerWidth / innerHeight }); };
addEventListener('resize', resize); resize();
const PX = () => (innerHeight * renderer.dpr) / (2 * Math.tan((FOV * Math.PI) / 360));

// colours of the water: original (green-teal flooded forest) and the site's (deep violet)
const WATER = { orig: [0.11, 0.17, 0.13], web: [0.075, 0.06, 0.16] }; // the colour the far water fades to (sunlit haze)
// shared uniforms of the world
const W = {
  uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uPx: { value: 1 }, uSize: { value: 1 }, uWater: { value: WATER.orig },
  uWeb: { value: 0 }, uDark: { value: 0 }, uClear: { value: 3.4 }, uSway: { value: 1 }, uLight: { value: 1 }, uA: { value: VIOLET }, uB: { value: LILAC }, uCam: { value: [0, 0, 0] }
};
const GLSL_WORLD = /* glsl */ `
  float water(float d) { return exp(-d * .06); }
  // the forest's colour: original, or the site's (its brightness on violet → lilac → white)
  vec3 forest(vec3 c, float web) {
    float l = dot(c, vec3(.3, .59, .11));
    vec3 w = mix(mix(uA * .22, uA * .9, smoothstep(.05, .35, l)), mix(uB, vec3(1.), .5), smoothstep(.35, .85, l));
    return mix(c, w, web);
  }
  bool inTunnel(vec3 p) { return abs(p.x) < 1.3 && p.y > -1.15 && p.y < 1.2; }
  // the forest makes way for a channel of open water round the tunnel (the animals swim in it): everything is
  // pushed aside, out of an ellipse round the tunnel (wider and narrower as it goes), the floor and the canopy close
  // it below and above; nothing is cut, so the picture stays whole
  float channel(float y, float z, float hw) {
    float e = (y - 1.) / (3.6 + .4 * sin(z * .13));
    return (hw + .5 * sin(z * .21)) * sqrt(max(0., 1. - e * e));
  }
  vec3 makeWay(vec3 p, float side, float hw) { p.x += side * channel(p.y, p.z, hw); return p; }`;

// ---------- the forest ----------
// a chunk: the picture seen from an eye at (0, EYE, 0) looking down -z; a pixel u, v (0 … 1) at depth Z lies at
// x = (u - .5) · 2 · TX · Z, y = EYE + (.5 - v) · 2 · TY · Z, z = -Z
const TX = 1.15, TY = TX * (516 / 1536), EYE = -0.6, ZN = 4, ZF = 26, PERIOD = 12, NCH = 7;
const F = { uTX: { value: TX }, uTY: { value: TY }, uEye: { value: EYE }, uZn: { value: ZN }, uZf: { value: ZF }, uMinNear: { value: 0 }, uFoot: { value: 0.004 } };
const CHUNK = /* glsl */ `
  vec3 chunkPos(vec2 uv, float n, vec4 ch) { // ch: z of the chunk, mirror, seed, -
    float Z = mix(uZf, uZn, pow(n, .9));
    return vec3((uv.x - .5) * 2. * uTX * Z * ch.y, uEye + (.5 - uv.y) * 2. * uTY * Z, ch.x - Z);
  }`;
const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const chunkData = { iCh: { instanced: 1, size: 4, data: new Float32Array(NCH * 4) } };

// (1) points
const forestProg = new Program(gl, {
  vertex: /* glsl */ `#version 300 es
    in vec4 position; in vec3 aColor; in vec4 iCh; // position: u, v, near, random
    uniform mat4 viewMatrix, projectionMatrix;
    uniform float uTime, uDpr, uPx, uSize, uWeb, uDark, uSway, uTX, uTY, uEye, uZn, uZf, uMinNear, uFoot, uClear; uniform vec3 uWater, uA, uB;
    out vec3 vC;
    ${GLSL_WORLD}
    ${CHUNK}
    void main() {
      float n = position.z, r = position.w;
      vec3 p = chunkPos(position.xy, n, iCh);
      p = makeWay(p, p.x < 0. ? -1. : 1., uClear);
      if (n < uMinNear || inTunnel(p) || iCh.y == 0.) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
      // the current: leaves and fronds sway, the higher the more
      float sw = uSway * (.04 + .05 * smoothstep(-2., 6., p.y));
      p.x += sw * sin(uTime * .55 + p.y * .7 + p.z * .25 + iCh.z * 6.);
      p.y += sw * .4 * sin(uTime * .45 + p.x * .6 + iCh.z * 3.);
      vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z;
      gl_Position = projectionMatrix * mv;
      // light ripples over it from the surface, the water swallows what is far
      float ripple = .5 + .5 * sin(p.x * 2.3 + uTime * 1.1) * sin(p.z * 1.9 - uTime * .8);
      vec3 c = forest(aColor, uWeb) * (.82 + .3 * ripple * smoothstep(-1., 4., p.y)) * (.9 + .2 * fract(iCh.z * 7.13));
      vC = mix(uWater, c * (1. - .75 * uDark), water(d) * (1. - .55 * uDark));
      float Z = mix(uZf, uZn, pow(n, .9));
      gl_PointSize = clamp(1.2 * uSize * uFoot * Z * uPx / max(d, .1), 1., 12. * uDpr);
    }`,
  fragment: /* glsl */ `#version 300 es
    precision highp float; in vec3 vC; out vec4 o;
    void main() { vec2 c = gl_PointCoord - .5; if (dot(c, c) > .25) discard; o = vec4(vC, 1.); }`,
  uniforms: { ...W, ...F }, depthTest: true, depthWrite: true
});
let forestPts = null;
Promise.all([load('/lab/prales/prales.webp'), load('/lab/prales/prales-hloubka.png')]).then(([ci, di]) => {
  const w = ci.naturalWidth, h = ci.naturalHeight;
  const read = img => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h); return x.getImageData(0, 0, w, h).data; };
  const C = read(ci), D = read(di);
  const N = narrow ? 60000 : 160000;
  const pos = new Float32Array(N * 4), col = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    const x = Math.random() * w, y = Math.random() * h, i = ((y | 0) * w + (x | 0)) * 4;
    pos.set([x / w, y / h, D[i] / 255, Math.random()], k * 4);
    col.set([(C[i] / 255) ** 1.1, (C[i + 1] / 255) ** 1.1, (C[i + 2] / 255) ** 1.1], k * 3);
  }
  F.uFoot.value = 2 * TX * (Math.sqrt((w * h) / N) / w);
  forestPts = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: pos }, aColor: { size: 3, data: col }, ...chunkData }), program: forestProg, mode: gl.POINTS, frustumCulled: false });
  forestPts.setParent(scene);
});

// (2) layers: four planes per chunk (the back one the whole picture with the nearer things painted out)
const LAYER_Z = [22, 13, 7.5, 4.2];
const LAYER_SRC = {
  vertex: /* glsl */ `#version 300 es
    in vec3 position; in vec2 uv; in float aSide; uniform mat4 modelMatrix, viewMatrix, projectionMatrix; uniform float uClear; out vec2 vUv; out vec3 vW; out float vD;
    float channel(float y, float z, float hw) { float e = (y - 1.) / (3.6 + .4 * sin(z * .13)); return (hw + .5 * sin(z * .21)) * sqrt(max(0., 1. - e * e)); }
    void main() {
      vUv = uv; vec4 w = modelMatrix * vec4(position, 1.);
      w.x += aSide * sign(modelMatrix[0][0]) * channel(w.y, w.z, uClear);
      vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragment: /* glsl */ `#version 300 es
    precision highp float; uniform sampler2D tMap; uniform float uWeb, uDark, uBlur, uFade, uTime, uSway, uClear; uniform vec3 uWater, uA, uB;
    in vec2 vUv; in vec3 vW; in float vD; out vec4 o;
    ${GLSL_WORLD}
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv + vec2(uSway * .004 * sin(uTime * .5 + vUv.y * 9.), 0.);
      vec4 t = texture(tMap, uv);
      vec2 eg = min(vUv, 1. - vUv); float edgeFade = smoothstep(0., .1, eg.x) * smoothstep(0., .14, eg.y);
      if (uBlur > 0.) { vec4 s = vec4(0.); for (int i = 0; i < 8; i++) { float a = float(i) * .785; s += texture(tMap, uv + vec2(cos(a), sin(a)) * uBlur); } t = mix(t, s / 8., .8); }
      // fades out (dithered) as the camera comes close, and nothing of it inside the tunnel
      if (t.a * uFade * edgeFade < hash(gl_FragCoord.xy) * .9 + .05 || inTunnel(vW)) discard;
      vec3 c = forest(pow(t.rgb, vec3(1.1)), uWeb);
      o = vec4(mix(uWater, c * (1. - .75 * uDark), water(vD) * (1. - .55 * uDark)), 1.);
    }`,
};
const layerTex = [0, 1, 2, 3].map(i => {
  const t = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE });
  load(`/lab/prales/vrstva-${i}.webp`).then(img => { t.image = img; });
  return t;
});
const plane = new Plane(gl, { width: 1, height: 1 });
const halves = (() => {
  const nx = 24, ny = 20, pos = [], uv = [], side = [], idx = [];
  for (const sd of [-1, 1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const u = sd < 0 ? (i / nx) * 0.5 : 0.5 + (i / nx) * 0.5, v = j / ny;
      pos.push(u - 0.5, v - 0.5, 0); uv.push(u, v); side.push(sd);
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = base + j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, b, d, a, d, c); }
  }
  return new Geometry(gl, { position: { size: 3, data: new Float32Array(pos) }, uv: { size: 2, data: new Float32Array(uv) }, aSide: { size: 1, data: new Float32Array(side) }, index: { data: new Uint16Array(idx) } });
})();
// the far distance: the whole picture, soft, always ahead at the end of the corridor (the forest's misty light)
const farProg = new Program(gl, {
  vertex: /* glsl */ `#version 300 es
    in vec3 position; in vec2 uv; uniform mat4 modelViewMatrix, projectionMatrix; out vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragment: /* glsl */ `#version 300 es
    precision highp float; uniform sampler2D tMap; uniform float uWeb, uDark, uTime; uniform vec3 uWater, uA, uB; in vec2 vUv; out vec4 o;
    ${GLSL_WORLD}
    void main() {
      vec4 s = vec4(0.); for (int i = 0; i < 12; i++) { float a = float(i) * .5236; s += texture(tMap, vUv + vec2(cos(a), sin(a) * 2.9) * .012); }
      vec3 c = forest(pow(s.rgb / 12., vec3(1.15)), uWeb);
      o = vec4(mix(uWater, c * (1. - .8 * uDark), .45 * (1. - .6 * uDark)), 1.);
    }`,
  uniforms: { ...W, tMap: { value: layerTex[0] } }, depthTest: false, depthWrite: false, cullFace: null
});
const farMesh = new Mesh(gl, { geometry: plane, program: farProg, frustumCulled: false });
farMesh.renderOrder = -10;
farMesh.setParent(scene);
// one program per layer, shared by the chunks; each mesh sets its own fade just before it is drawn
const layerProgs = layerTex.map(t => new Program(gl, { vertex: LAYER_SRC.vertex, fragment: LAYER_SRC.fragment, uniforms: { ...W, tMap: { value: t }, uBlur: { value: 0 }, uFade: { value: 1 } }, depthTest: true, depthWrite: true, cullFace: null }));
const layerSlots = [];
for (let c = 0; c < NCH; c++) {
  const meshes = LAYER_Z.map((Z, i) => {
    const m = new Mesh(gl, { geometry: halves, program: layerProgs[i], frustumCulled: false });
    m.scale.set(Z * 2 * TX, Z * 2 * TY, 1);
    m.fade = 1; m.blur = 0;
    m.onBeforeRender(({ mesh }) => { mesh.program.uniforms.uFade.value = mesh.fade; mesh.program.uniforms.uBlur.value = mesh.blur; });
    m.setParent(scene); m.visible = false;
    return m;
  });
  layerSlots.push(meshes);
}

// ---------- the glass tunnel (as in "Tunel pod vodou") ----------
const TW = 2, TH = 1.8, SEG = 1, NSEG = 24, GRID = 4, hw = TW / 2, hh = TH / 2, colW = TW / GRID, rowH = TH / GRID;
const panes = { position: [], uv: [], normal: [], size: [] };
const frame = [];
for (let s = 0; s <= NSEG; s++) {
  const z0 = -s * SEG, z1 = z0 - SEG;
  const quad = (a, b, c, d, n, w, h) => { for (const [p, uv] of [[a, [0, 0]], [b, [1, 0]], [c, [1, 1]], [a, [0, 0]], [c, [1, 1]], [d, [0, 1]]]) { panes.position.push(...p); panes.uv.push(...uv); panes.normal.push(...n); panes.size.push(w, h); } };
  for (let i = 0; i < GRID; i++) {
    const x0 = -hw + i * colW, x1 = x0 + colW, y0 = -hh + i * rowH, y1 = y0 + rowH;
    quad([x0, -hh, z0], [x1, -hh, z0], [x1, -hh, z1], [x0, -hh, z1], [0, 1, 0], colW, SEG);
    quad([x0, hh, z0], [x1, hh, z0], [x1, hh, z1], [x0, hh, z1], [0, -1, 0], colW, SEG);
    quad([-hw, y0, z0], [-hw, y1, z0], [-hw, y1, z1], [-hw, y0, z1], [1, 0, 0], rowH, SEG);
    quad([hw, y0, z0], [hw, y1, z0], [hw, y1, z1], [hw, y0, z1], [-1, 0, 0], rowH, SEG);
  }
  const L = (a, b) => frame.push(...a, ...b);
  for (let i = 0; i <= GRID; i++) { const x = -hw + i * colW; L([x, -hh, z0], [x, -hh, z1]); L([x, hh, z0], [x, hh, z1]); }
  for (let i = 1; i < GRID; i++) { const y = -hh + i * rowH; L([-hw, y, z0], [-hw, y, z1]); L([hw, y, z0], [hw, y, z1]); }
  L([-hw, -hh, z0], [hw, -hh, z0]); L([-hw, hh, z0], [hw, hh, z0]); L([-hw, -hh, z0], [-hw, hh, z0]); L([hw, -hh, z0], [hw, hh, z0]);
}
const GU = { uTime: { value: 0 }, uGlass: { value: 1 }, uLight: { value: 1 }, uTint: { value: [0.8, 0.92, 0.88] } };
const glassProg = new Program(gl, {
  vertex: `attribute vec3 position, normal; attribute vec2 uv, size; uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
    varying vec3 vW, vN; varying vec2 vUv, vSize; varying float vD;
    void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normal; vUv = uv; vSize = size; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragment: `precision highp float; uniform vec3 cameraPosition, uTint; uniform float uTime, uGlass, uLight;
    varying vec3 vW, vN; varying vec2 vUv, vSize; varying float vD;
    float wave(vec2 p, float t){ return sin(p.x * 2.1 + t) * sin(p.y * 1.7 - t * .8) + sin((p.x + p.y) * 3.3 + t * 1.3) * .5 + sin((p.x - p.y) * 4.1 - t * 1.1) * .35; }
    void main(){
      vec3 V = normalize(cameraPosition - vW);
      float fres = pow(1. - abs(dot(vN, V)), 3.);
      vec2 e = min(vUv, 1. - vUv) * vSize; float edge = 1. - smoothstep(0., .035, min(e.x, e.y));
      float band = fract((vW.x * .6 + vW.y * .9 - vW.z * .35) * .32 + uTime * .02); float sheen = smoothstep(.0, .08, band) * smoothstep(.2, .08, band);
      float caustic = step(.5, vN.y) * pow(max(0., 1. - abs(wave(vW.xz * 2.2, uTime * 1.2)) * 1.6), 6.) * uLight;
      float a = (.012 + fres * .13 + edge * .05 + sheen * .035) * uGlass;
      gl_FragColor = vec4((uTint * a + vec3(.8, .9, .85) * caustic * .12) * exp(-vD * .12) * smoothstep(19., 12., vD), 1.);
    }`,
  uniforms: GU, transparent: true, depthTest: true, depthWrite: false, cullFace: null
});
glassProg.setBlendFunc(gl.ONE, gl.ONE);
const glass = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: new Float32Array(panes.position) }, uv: { size: 2, data: new Float32Array(panes.uv) }, normal: { size: 3, data: new Float32Array(panes.normal) }, size: { size: 2, data: new Float32Array(panes.size) } }), program: glassProg, frustumCulled: false });
glass.setParent(scene);
const frameProg = new Program(gl, {
  vertex: `attribute vec3 position; uniform mat4 modelViewMatrix, projectionMatrix; varying float vD; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragment: `precision highp float; uniform vec3 uTint; uniform float uGlass; varying float vD; void main(){ gl_FragColor = vec4(uTint * .16 * uGlass * exp(-vD * .12) * smoothstep(19., 12., vD), 1.); }`,
  uniforms: GU, transparent: true, depthTest: true, depthWrite: false
});
frameProg.setBlendFunc(gl.ONE, gl.ONE);
const frameMesh = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: new Float32Array(frame) } }), program: frameProg, mode: gl.LINES, frustumCulled: false });
frameMesh.setParent(scene);

// ---------- light shafts and sinking snow ----------
const shafts = [];
for (let i = 0; i < 10; i++) {
  const x = (Math.random() < 0.5 ? -1 : 1) * (1.8 + Math.random() * 8), z = -Math.random() * 30, w = 0.8 + Math.random() * 2;
  for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) shafts.push(x, z, w, u, v, Math.random());
}
const shaftProg = new Program(gl, {
  vertex: `attribute vec3 position; attribute vec3 aUv; uniform mat4 viewMatrix, projectionMatrix; uniform vec3 uCam; uniform float uTime;
    varying vec2 vUv; varying float vD, vR;
    void main(){ vUv = aUv.xy; vR = aUv.z;
      float z = uCam.z - 32. + mod(position.y - uCam.z + 32., 34.);
      vec3 c = vec3(position.x + sin(uTime * .1 + aUv.z * 6.) * .6, 1.5, z);
      vec3 toCam = normalize(vec3(uCam.x - c.x, 0., uCam.z - c.z)); vec3 side = vec3(toCam.z, 0., -toCam.x);
      vec3 p = c + side * (aUv.x - .5) * position.z + vec3(0., (aUv.y - .5) * 14. + 2., 0.) + side * (aUv.y - .5) * 2.;
      vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragment: `precision highp float; uniform float uLight, uTime, uWeb, uDark; uniform vec3 uB; varying vec2 vUv; varying float vD, vR;
    void main(){ float x = 1. - abs(vUv.x * 2. - 1.); float a = x * x * smoothstep(0., .9, vUv.y) * (.6 + .4 * sin(uTime * .5 + vR * 9.));
      vec3 c = mix(vec3(1., .95, .7), mix(uB, vec3(1.), .4), uWeb);
      gl_FragColor = vec4(c * a * .07 * uLight * (1. - uDark) * exp(-vD * .045), 1.); }`,
  uniforms: W, transparent: true, depthTest: true, depthWrite: false, cullFace: null
});
shaftProg.setBlendFunc(gl.ONE, gl.ONE);
{
  const n = shafts.length / 6, pos = new Float32Array(n * 3), uv = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos.set(shafts.slice(i * 6, i * 6 + 3), i * 3); uv.set(shafts.slice(i * 6 + 3, i * 6 + 6), i * 3); }
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: pos }, aUv: { size: 3, data: uv } }), program: shaftProg, frustumCulled: false }).setParent(scene);
}
const snowN = narrow ? 2500 : 5000, snow = new Float32Array(snowN * 4);
for (let k = 0; k < snowN; k++) snow.set([(Math.random() - 0.5) * 24, Math.random() * 12 - 4, Math.random() * 34, Math.random()], k * 4);
const snowProg = new Program(gl, {
  vertex: `attribute vec4 position; uniform mat4 viewMatrix, projectionMatrix; uniform vec3 uCam, uB; uniform float uTime, uDpr, uSize, uWeb, uDark;
    varying vec3 vC; varying float vA;
    void main(){ vec3 p = position.xyz;
      p.z = uCam.z - 32. + mod(p.z - uCam.z + 32., 34.);
      p.y = -4. + mod(p.y + 4. - uTime * .08 * (.5 + position.w), 12.); p.x += sin(uTime * .3 + position.w * 20.) * .2;
      if (abs(p.x) < 1.05 && abs(p.y) < .95) p.y += 30.;
      vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z; gl_Position = projectionMatrix * mv;
      vC = mix(vec3(.85, .9, .8), uB, uWeb) * .5 * (.5 + position.w) * (1. - .6 * uDark); vA = exp(-d * .1);
      gl_PointSize = 2.2 * uDpr * uSize * (4. / max(d, .4)); }`,
  fragment: `precision highp float; varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; gl_FragColor = vec4(vC * vA * smoothstep(.25, 0., r), 1.); }`,
  uniforms: W, transparent: true, depthTest: true, depthWrite: false
});
snowProg.setBlendFunc(gl.ONE, gl.ONE);
new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: snow } }), program: snowProg, mode: gl.POINTS, frustumCulled: false }).setParent(scene);

// ---------- the animals: drawings made of points, posed by a frame per animal ----------
// lay: how the drawing sees it ("side": from the side, "top": from above, "front": from the front, head up)
const KINDS = {
  zralok: { base: '/lab/tunel/zralok', hmax: 80.9, lay: 'side', head: [1, 0], move: 'tail', n: 16000 },
  kladivoun: { base: '/lab/kladivoun/kladivoun', hmax: 101.7, lay: 'top', head: [0, 1], move: 'tailTop', n: 18000 },
  mantaA: { base: '/lab/manty/manta-a', hmax: 80.8, lay: 'top', head: [-74.4, -112.8], c: [247.2, 210], move: 'flap', n: 18000 },
  mantaB: { base: '/lab/manty/manta-b', hmax: 115.6, lay: 'top', head: [75, 144], c: [255, 180], move: 'flap', n: 15000 },
  meduza: { base: '/lab/meduza/meduza', hmax: 140.9, lay: 'front', head: [0, 1], move: 'pulse', n: 12000 },
  chobotnice: { base: '/lab/chobotnice/chobotnice', hmax: 120, lay: 'front', head: [0, 1], move: 'arms', n: 18000 },
  das: { base: '/lab/das/das', hmax: 173.2, lay: 'side', head: [1, 0], move: 'fins', n: 14000 }
};
const MOVES = {
  tail: `float sw = pow(s, 1.5) * sin(ph - s * 7.); z += .09 * sw; q.y += .01 * sw;`,
  tailTop: `q += perp * .07 * pow(s, 1.5) * sin(ph - s * 7.); z += .02 * pow(s, 2.) * cos(ph - s * 7.);`,
  flap: `float wg = abs(q.y) / max(uLmax, .1); z += .3 * uLmax * pow(wg, 1.6) * sin(ph - wg * 1.7); q.y *= 1. - .05 * pow(wg, 2.);`,
  pulse: `float bell = 1. - smoothstep(.17, .23, s); float pz = pow(sin(ph * .5) * .5 + .5, 3.); q.x *= 1. - .14 * bell * pz; z *= 1. - .14 * bell * pz; q.y += .02 * bell * pz;
    float sn = clamp((s - .2) / .8, 0., 1.); q.x += .025 * sn * sin(ph * .6 - s * 14.); z += .04 * sn * cos(ph * .55 - s * 12. + q.x * 9.);`,
  // the arms wave; when it jets (iS.w) they draw together behind the mantle
  arms: `float sn = clamp((s - .24) / .76, 0., 1.); float w = pow(sn, 1.3); q += perp * .035 * w * sin(ph * .6 - s * 17.) * (1. - .6 * iS.w); z += .06 * w * cos(ph * .55 - s * 15. + q.x * 6.) * (1. - .6 * iS.w);
    q.x *= 1. - .55 * iS.w * sn; z *= 1. - .5 * iS.w * sn;`,
  fins: `float hn = clamp(abs(z) / .15, 0., 1.); z += .015 * pow(1. - hn, 2.) * smoothstep(.42, .7, s) * sin(ph * 4. + s * 14.); q.y += .008 * sin(ph);`
};
const AU = { uOrig: { value: 1 } };
const MAXA = 20;
const kinds = {};
for (const [name, K] of Object.entries(KINDS)) {
  const U = { ...W, ...AU, uSp: { value: 0.01 }, uLmax: { value: 0.4 }, uRot: { value: [1, 0, 0, 1] }, uC: { value: [0, 0] } };
  const program = new Program(gl, {
    vertex: /* glsl */ `#version 300 es
      in vec4 position; in vec4 aBody; in vec3 iP; in vec3 iE1; in vec3 iE2; in vec3 iE3; in vec4 iS; // iS: size, phase, opacity, squeeze
      uniform mat4 viewMatrix, projectionMatrix; uniform vec3 cameraPosition, uWater, uA, uB;
      uniform float uTime, uDpr, uPx, uSize, uOrig, uSp, uLmax, uDark; uniform mat2 uRot; uniform vec2 uC;
      out vec3 vC; out float vA;
      ${GLSL_TONE}
      float water(float d) { return exp(-d * .06); }
      void main() {
        if (iS.x <= 0. || iS.z <= .003) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
        float r = position.w, s = aBody.x, L = aBody.w;
        vec2 q = uRot * (position.xy - uC);
        vec2 t = uRot * aBody.yz; vec2 perp = vec2(-t.y, t.x);
        float z = position.z, ph = iS.y;
        ${MOVES[K.move]}
        vec3 p = iP + (iE1 * q.x + iE2 * q.y + iE3 * z) * iS.x;
        p += .008 * iS.x * vec3(sin(uTime * 1.3 + r * 40.), sin(uTime * 1.1 + r * 60.), sin(uTime * .9 + r * 80.));
        vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z;
        gl_Position = projectionMatrix * mv;
        float wv = water(d);
        vC = mix(uWater, toneColor(L, uOrig, uA, uB) * (1. - .6 * uDark), wv) * (.8 + .35 * r);
        float a = toneAlpha(L, uOrig) * facingAlpha(sign(position.z), p, cameraPosition, iE3);
        vA = clamp(a * 1.25, 0., 1.) * iS.z * (.35 + .65 * wv) * smoothstep(46., 34., d);
        gl_PointSize = clamp(1.8 * uSize * uSp * iS.x * uPx / max(d, .1), 1., 18. * uDpr);
      }`,
    fragment: /* glsl */ `#version 300 es
      precision highp float; in vec3 vC; in float vA; out vec4 o;
      void main() { vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; float a = vA * smoothstep(.25, .1, r); o = vec4(vC * a, a); }`,
    uniforms: U, transparent: true, depthTest: true, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // solid bodies (premultiplied), not glow
  const kind = { K, U, mesh: null, attrs: null, rotA: 0 };
  kinds[name] = kind;
  drawing(K.base).then(d => {
    const m = Math.max(d.w, d.h);
    const { pos, body, spacing } = sample(d, { N: Math.round(K.n * (narrow ? 0.5 : 1)), sc: 1 / m, hmax: K.hmax, thick: 0.6 });
    const rotA = K.lay === 'front' ? 0 : -Math.atan2(K.head[1], K.head[0]);
    kind.rotA = rotA;
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
// the anglerfish's lure: a star of light with a halo (one for the staged fish, one for the wild one)
const lurePts = [];
for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, len = k % 2 ? 0.48 : 1; for (let i = 0; i < 40; i++) { const t = Math.random(); lurePts.push(Math.cos(a) * t * len, Math.sin(a) * t * len, 0, Math.random()); } }
for (let i = 0; i < 500; i++) { const a = Math.random() * 6.283, rr = Math.abs(Math.random() + Math.random() + Math.random() - 1.5) * 1.3; lurePts.push(Math.cos(a) * rr, Math.sin(a) * rr, 0, 2 + Math.random()); }
const lures = [0, 1].map(() => {
  const U = { uTime: W.uTime, uDpr: W.uDpr, uPx: W.uPx, uWeb: W.uWeb, uB: W.uB, uPos: { value: [0, -80, 0] }, uR: { value: 0.2 }, uOn: { value: 0 } };
  const p = new Program(gl, {
    vertex: `attribute vec4 position; uniform mat4 viewMatrix, projectionMatrix; uniform vec3 uPos, uB; uniform float uTime, uDpr, uPx, uR, uWeb, uOn;
      varying vec3 vC; varying float vA;
      void main(){ bool halo = position.w >= 2.; float a = uTime * .2; vec2 q = mat2(cos(a), sin(a), -sin(a), cos(a)) * position.xy;
        vec4 mv = viewMatrix * vec4(uPos + vec3(q * uR * (1. + .08 * sin(uTime * 2.3)), 0.), 1.); gl_Position = projectionMatrix * mv; float d = -mv.z;
        vC = mix(vec3(1., .96, .82), mix(uB, vec3(1.), .55), uWeb); vA = (halo ? .14 : 1.) * exp(-d * .04) * uOn;
        gl_PointSize = (halo ? 3.4 : 1.9) * uDpr * uPx * .04 * uR / max(d, .2); }`,
    fragment: `precision highp float; varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; gl_FragColor = vec4(vC * vA * smoothstep(.25, 0., r), 1.); }`,
    uniforms: U, transparent: true, depthTest: true, depthWrite: false
  });
  p.setBlendFunc(gl.ONE, gl.ONE);
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
const UP = [0, 1, 0];
const R = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// the frame an animal is drawn in: e1 along the drawing's head, e2 the drawing's up (or aside), e3 its thickness
const frameOf = (kind, fwd, bank, cam, pos) => {
  const lay = KINDS[kind].lay;
  if (lay === 'front') {
    // the head leads (fwd), the drawing turned to the camera
    const e2 = norm(fwd);
    let e3 = sub(cam, pos); e3 = norm(sub(e3, mul(e2, dot(e3, e2))));
    return [cross(e2, e3), e2, e3];
  }
  const e1 = norm(fwd);
  let side = cross(UP, e1); if (len(side) < 1e-3) side = [1, 0, 0]; side = norm(side);
  const upo = cross(e1, side);
  const c = Math.cos(bank), s = Math.sin(bank);
  if (lay === 'side') { const e2 = add(mul(upo, c), mul(side, -s)); return [e1, e2, cross(e1, e2)]; }
  const e2 = add(mul(side, c), mul(upo, s));
  return [e1, e2, cross(e1, e2)];
};

// ---------- the ecosystem: animals that live and travel round the tunnel ----------
// lanes: how far from the tunnel's axis an animal keeps (near = right at the glass, big)
const LIFE = {
  zralok: { n: 5, size: [1.6, 2.6], speed: [0.7, 1.1], turn: 0.45, zone: 'sides', tail: 0.9 },
  kladivoun: { n: 2, size: [2.6, 3.6], speed: [0.55, 0.8], turn: 0.35, zone: 'overunder', tail: 0.7 },
  mantaA: { n: 2, size: [3, 4.6], speed: [0.5, 0.75], turn: 0.25, zone: 'above', tail: 0.45 },
  mantaB: { n: 1, size: [2.6, 4], speed: [0.5, 0.75], turn: 0.25, zone: 'above', tail: 0.45 },
  meduza: { n: 7, size: [0.55, 1.4], speed: [0.1, 0.2], turn: 0.2, zone: 'any', tail: 0.35 },
  chobotnice: { n: 2, size: [1.1, 1.7], speed: [0.15, 0.25], turn: 0.5, zone: 'floor', tail: 0.5 },
  das: { n: 1, size: [0.8, 1.1], speed: [0.08, 0.14], turn: 0.3, zone: 'low', tail: 0.4 }
};
const laneOf = () => { const r = Math.random(); return r < 0.35 ? R(1.7, 2.5) : r < 0.8 ? R(2.7, 4.2) : R(5, 9); };
const spot = (a, z) => {
  // a point in the animal's zone, at its lane's distance from the axis, outside the tunnel
  const d = a.lane + R(-0.5, 0.5);
  let phi;
  switch (LIFE[a.kind].zone) {
    case 'sides': phi = (Math.random() < 0.5 ? 0 : Math.PI) + R(-0.7, 0.7); break;
    case 'above': phi = R(0.25, 0.75) * Math.PI; break;
    case 'overunder': phi = Math.random() < 0.5 ? R(0.3, 0.7) * Math.PI : R(1.3, 1.7) * Math.PI; break;
    case 'low': phi = (Math.random() < 0.5 ? R(1.05, 1.35) : R(1.65, 1.95)) * Math.PI; break;
    default: phi = R(0, Math.PI * 2);
  }
  let x = Math.cos(phi) * d, y = clamp(Math.sin(phi) * d * 0.7, -2.4, 6);
  if (LIFE[a.kind].zone === 'floor') y = -2.2 + a.size * 0.3;
  if (Math.abs(x) < 1.6 && y > -1.5 && y < 1.5) x = Math.sign(x || 1) * R(1.7, 2.2);
  return [x, y, z];
};
const agents = [];
for (const [kind, L] of Object.entries(LIFE)) for (let i = 0; i < L.n * 2; i++) agents.push({ kind, i, born: false });
const respawn = (a, cam, ahead = true) => {
  const L = LIFE[a.kind];
  a.size = R(...L.size); a.v0 = R(...L.speed); a.lane = laneOf();
  a.pos = spot(a, ahead ? cam[2] - R(26, 40) : cam[2] - R(2, 34));
  a.wp = spot(a, a.pos[2] + R(-14, 10));
  a.fwd = norm(sub(a.wp, a.pos)); a.bank = 0; a.yawRate = 0; a.phase = R(0, 6.28); a.state = 'swim'; a.t = R(2, 6); a.squeeze = 0; a.boost = 0;
  if (a.kind === 'meduza') a.fwd = norm([R(-0.3, 0.3), 1, R(-0.3, 0.3)]);
  if (a.kind === 'chobotnice') { a.state = 'crawl'; a.fwd = UP; }
  a.born = true;
};
const steer = (a, desired, omega, dt) => {
  const d = norm(desired), c = clamp(dot(a.fwd, d), -1, 1), ang = Math.acos(c);
  if (ang < 1e-4) return;
  a.fwd = norm(mix3(a.fwd, d, Math.min(1, (omega * dt) / ang)));
};
const keepOut = (p, f) => {
  // the glass: an animal heading into the tunnel turns off it
  const nx = p[0] + f[0] * 1.2, ny = p[1] + f[1] * 1.2;
  if (Math.abs(nx) < 1.6 && ny > -1.5 && ny < 1.5) return [Math.sign(p[0] || 1) * 1.5, Math.sign(p[1] || 1) * 0.6, 0];
  return [0, 0, 0];
};
const liveAgent = (a, dt, cam) => {
  const L = LIFE[a.kind];
  if (!a.born || a.pos[2] > cam[2] + 8 || a.pos[2] < cam[2] - 48) respawn(a, cam, a.born);
  a.t -= dt;
  if (a.kind === 'meduza') {
    // pulse by pulse up through the water, drifting with the current; gone above, it comes again from below
    a.phase += dt * 2.3;
    const pz = Math.pow(Math.sin(a.phase * 0.5) * 0.5 + 0.5, 3);
    if (a.t <= 0) { a.t = R(3, 7); a.tilt = norm([R(-0.35, 0.35), 1, R(-0.35, 0.35)]); }
    if (a.tilt) steer(a, a.tilt, 0.15, dt);
    a.pos = add(a.pos, add(mul(a.fwd, (0.05 + pz * 0.45) * a.size * dt), [Math.sin(W.uTime.value * 0.1 + a.i) * 0.04 * dt, 0, 0.03 * dt]));
    if (a.pos[1] > 7.5) { a.pos[1] = -3; }
    return;
  }
  if (a.kind === 'chobotnice') {
    a.phase += dt * 3;
    if (a.state === 'crawl') {
      // crawls the floor towards a spot on it, then takes off
      const tgt = [a.wp[0], -2.2 + a.size * 0.3, a.wp[2]];
      const to = sub(tgt, a.pos); to[1] = 0;
      a.pos = add(a.pos, mul(norm(to), a.v0 * dt));
      a.pos[1] += (tgt[1] - a.pos[1]) * Math.min(1, dt * 2);
      a.fwd = norm(mix3(a.fwd, UP, Math.min(1, dt * 2)));
      a.squeeze += (0 - a.squeeze) * Math.min(1, dt * 2);
      if (len(to) < 0.6 || a.t <= 0) { a.state = 'jet'; a.t = R(4, 7); a.jets = 0; a.wp = spot({ ...a, kind: 'meduza' }, a.pos[2] + R(-8, 4)); }
    } else {
      // jets: a squeeze, a thrust head first, a glide with the arms trailing; then sinks back to the floor
      const cyc = (a.phase / 3.5) % 1;
      const thrust = cyc < 0.25 ? Math.sin((cyc / 0.25) * Math.PI) : 0;
      a.squeeze += ((cyc < 0.45 ? 1 : 0.35) - a.squeeze) * Math.min(1, dt * 4);
      steer(a, sub(a.wp, a.pos), 0.8, dt);
      a.boost = a.boost * Math.exp(-dt * 1.5) + thrust * dt * 5;
      a.pos = add(a.pos, mul(a.fwd, (0.15 + a.boost) * a.size * dt));
      a.pos = add(a.pos, add(keepOut(a.pos, a.fwd), [0, 0, 0]).map(v => v * dt));
      if (a.t <= 0 || len(sub(a.wp, a.pos)) < 1) { a.state = 'crawl'; a.t = R(6, 12); a.wp = spot(a, a.pos[2] + R(-6, 6)); }
    }
    return;
  }
  // fish and rays: steer for a waypoint, bank into the turn
  if (a.t <= 0 || len(sub(a.wp, a.pos)) < 1.5) { a.t = R(5, 10); a.wp = spot(a, clamp(a.pos[2] + R(-16, 12), cam[2] - 40, cam[2] + 3)); }
  const before = Math.atan2(a.fwd[0], -a.fwd[2]);
  const want = add(norm(sub(a.wp, a.pos)), keepOut(a.pos, a.fwd));
  steer(a, want, L.turn, dt);
  a.fwd[1] = clamp(a.fwd[1], -0.45, 0.45); a.fwd = norm(a.fwd);
  let dyaw = Math.atan2(a.fwd[0], -a.fwd[2]) - before; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
  a.yawRate += (dyaw / Math.max(dt, 1e-3) - a.yawRate) * Math.min(1, dt * 2);
  a.bank += (clamp(-a.yawRate * 1.4, -0.8, 0.8) - a.bank) * Math.min(1, dt * 1.5);
  a.pos = add(a.pos, mul(a.fwd, a.v0 * a.size * 0.45 * dt));
  a.phase += dt * 6.283 * L.tail;
};

// ---------- the staged scenes: one per stretch of the page, scrubbed by the scroll ----------
// each: where on the page (a … b), who, and its path relative to the camera (x, y, dz) for c = 0 … 1 and time t
const SCENES = [
  { a: 0.05, b: 0.2, kind: 'mantaA', size: 5.5, tail: 0.35, path: (c, t) => [-5 + 9 * c + Math.sin(t * 0.3) * 0.2, 1.75 + 2.2 * (1 - 4 * c * (1 - c)), -12 + 14.5 * c] },
  { a: 0.2, b: 0.34, kind: 'zralok', size: 2.6, tail: 1, path: (c, t) => [1.8 + Math.sin(t * 0.4) * 0.12, 0.05 + Math.sin(c * 6 + t * 0.3) * 0.22, -15 + 19 * c] },
  ...[[-1.7, -3.2, 1.1], [-2.6, -5.6, 1.5], [1.75, -4.1, 0.9], [2.7, -6.6, 1.3], [-3.8, -8.2, 1.6], [3.4, -2.9, 0.75], [0.3, -5.5, 1.2]].map(([x, z, s], j) => (
    { a: 0.34, b: 0.48, kind: 'meduza', size: s, tail: 0.4, jelly: true, path: (c, t) => [x + Math.sin(t * 0.2 + j) * 0.15, -3.6 + 8.5 * clamp(c * 1.25 - j * 0.04, 0, 1) + (j === 6 ? 2.3 : 0), z] })),
  { a: 0.48, b: 0.62, kind: 'chobotnice', size: 1.9, tail: 0.5, octo: true,
    path: (c, t) => c < 0.35 ? mix3([-6.5, 1.8, -9], [-1.55, 0.15, -3.4], sstep(0, 0.35, c))
      : c < 0.75 ? [-1.55 + Math.sin(t * 0.7) * 0.03, 0.15 + Math.sin(t * 0.5) * 0.05, -3.4]
      : mix3([-1.55, 0.15, -3.4], [-6, 5.5, -7], sstep(0.75, 1, c)) },
  { a: 0.62, b: 0.76, kind: 'kladivoun', size: 3.2, tail: 0.75, path: (c, t) => [-7 + 14 * c, -1.6 + Math.sin(t * 0.4) * 0.05, -3.8 + Math.sin(c * 3) * 0.6] },
  { a: 0.76, b: 0.93, kind: 'das', size: 1.6, tail: 0.4, dark: true, face: [-0.84, 0, -0.55], path: (c, t) => mix3([6.5, -1.2, -11], [1.95, -0.45 + Math.sin(t * 0.6) * 0.06, -3], sstep(0, 0.7, c)) }
];
const play = { p: 0 };
const toPlay = gsap.quickTo(play, 'p', { duration: 1.4, ease: 'power3.out' });

// ---------- flight, looking round, the copy ----------
const fly = { z: 0 };
const toZ = gsap.quickTo(fly, 'z', { duration: 1.1, ease: 'power3.out' });
let pressed = false;
const ui = e => e.target.closest && e.target.closest('.lab-panel, .lab-toggle, .gm, .lab-nav, a, button');
addEventListener('pointerdown', e => { if (!ui(e)) pressed = true; });
addEventListener('pointerup', () => { pressed = false; });
const look = { x: 0, y: 0, sx: 0, sy: 0 };
const tx = gsap.quickTo(look, 'x', { duration: 1.4, ease: 'power3.out' }), ty = gsap.quickTo(look, 'y', { duration: 1.4, ease: 'power3.out' });
addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || ui(e)) return; tx((e.clientX / innerWidth) * 2 - 1); ty((e.clientY / innerHeight) * 2 - 1); }, { passive: true });
const hero = document.querySelector('.lt-hero');
const pageP = () => Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
const onScroll = () => {
  toZ((scrollY / innerHeight) * S.flight * SEG);
  toPlay(pageP());
  const c = Math.min(1, scrollY / (innerHeight * 0.6));
  if (hero) { hero.style.opacity = String(1 - c); hero.style.transform = `scale(${1 + c * 0.7})`; hero.style.filter = `blur(${(c * 8).toFixed(1)}px)`; }
};
addEventListener('scroll', onScroll, { passive: true }); onScroll();

// ---------- panel ----------
document.querySelectorAll('[data-set]').forEach(inp => {
  const key = inp.dataset.set, out = inp.parentElement.querySelector('output');
  inp.value = S[key];
  const show = () => { if (out) out.textContent = Number(inp.value).toFixed(2); };
  show();
  inp.addEventListener('input', () => { S[key] = Number(inp.value); show(); });
});
const group = (attr, key) => {
  const btns = document.querySelectorAll(`[${attr}]`);
  const set = v => { VIEW[key] = v; btns.forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === v))); };
  btns.forEach(b => b.addEventListener('click', () => set(b.getAttribute(attr))));
  set(VIEW[key]);
};
group('data-pozadi', 'pozadi');
group('data-barva', 'barvy');
for (const key of ['sceny', 'ekosystem']) {
  const b = document.getElementById(key);
  b.setAttribute('aria-pressed', String(VIEW[key]));
  b.addEventListener('click', () => { VIEW[key] = !VIEW[key]; b.setAttribute('aria-pressed', String(VIEW[key])); });
}
document.getElementById('panel-toggle').addEventListener('click', () => document.body.classList.add('panel-closed'));
document.querySelector('.lab-toggle').addEventListener('click', () => document.body.classList.remove('panel-closed'));
const copy = document.getElementById('copy');
copy.addEventListener('click', () => {
  const txt = JSON.stringify({ ...S, ...VIEW });
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { copy.textContent = 'Zkopírováno ✓'; }, () => { prompt('Nastavení:', txt); });
  setTimeout(() => { copy.textContent = 'Zkopírovat nastavení'; }, 1800);
});

// ---------- every frame ----------
let drift = 0, time = 0, last = performance.now();
const col = { web: 0, orig: 1 };
const tick = now => {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const go = reduce ? 0 : dt;
  time += go;
  drift += go * 0.27 * S.speed * (pressed ? 3.3 : 1);
  const cz = -(drift + fly.z);
  const cam = [0, -0.15, cz];

  // the animals: what each kind shows this frame
  const shown = {}; for (const k in kinds) shown[k] = 0;
  const put = (kind, pos, e, size, phase, opacity, squeeze) => {
    const K = kinds[kind]; if (!K.attrs || shown[kind] >= MAXA) return;
    const k = shown[kind]++;
    K.attrs.iP.data.set(pos, k * 3); K.attrs.iE1.data.set(e[0], k * 3); K.attrs.iE2.data.set(e[1], k * 3); K.attrs.iE3.data.set(e[2], k * 3);
    K.attrs.iS.data.set([size, phase, opacity, squeeze], k * 4);
  };
  const lurePos = (pos, e, size) => add(pos, add(mul(e[0], 0.316 * size), mul(e[1], 0.251 * size)));
  let dark = 0, focus = null, focusW = 0, staged = 0;
  lures[0].uOn.value = 0; lures[1].uOn.value = 0;
  // staged scenes
  if (VIEW.sceny) {
    for (const sc of SCENES) {
      const c = (play.p - sc.a) / (sc.b - sc.a);
      if (c <= -0.02 || c >= 1.02) continue;
      const cc = clamp(c, 0, 1), env = sstep(0, 0.08, c) * sstep(1, 0.92, c);
      const p0 = sc.path(cc, time), p1 = sc.path(Math.min(1, cc + 0.01), time + 0.05);
      const pos = [p0[0], cam[1] + p0[1], cz + p0[2]];
      let fwd = norm(sub(p1, p0)); if (!isFinite(fwd[0]) || len(sub(p1, p0)) < 1e-5) fwd = sc.fwd || [1, 0, 0];
      sc.fwd = fwd;
      sc.phase = (sc.phase || 0) + go * 6.283 * sc.tail * (sc.jelly ? 0.37 : 1);
      let squeeze = 0;
      if (sc.jelly) fwd = [0, 1, 0];
      if (sc.face) fwd = norm(mix3(fwd, sc.face, sstep(0.45, 0.75, cc))); // turns side-on to us when it stops
      if (sc.octo) { const sitting = cc > 0.35 && cc < 0.75; squeeze = sitting ? 0 : 1; fwd = sitting ? [0, 1, 0] : fwd; }
      sc.bank = (sc.bank || 0) + ((sc.kind === 'mantaA' ? -0.35 + 0.7 * cc : 0) - (sc.bank || 0)) * Math.min(1, go * 2);
      const e = sc.octo && cc > 0.35 && cc < 0.75 ? (() => { const e3 = [1, 0, 0]; return [cross(UP, e3), UP, e3]; })() : frameOf(sc.kind, fwd, sc.bank, cam, pos);
      put(sc.kind, pos, e, sc.size, sc.phase, env, squeeze);
      staged = Math.max(staged, env);
      if (sc.dark) { dark = Math.max(dark, env * 0.8); lures[0].uPos.value = lurePos(pos, e, sc.size); lures[0].uR.value = 0.17 * sc.size; lures[0].uOn.value = env; }
      if (!sc.jelly || !focus) { focus = pos; focusW = env; }
    }
  }
  // the ecosystem (thinner while a scene plays)
  if (VIEW.ekosystem) {
    for (const a of agents) {
      const n = Math.round(LIFE[a.kind].n * S.animals * (1 - 0.4 * staged));
      if (a.i >= n) { a.born = false; continue; }
      liveAgent(a, go, cam);
      const e = frameOf(a.kind, a.fwd, a.bank || 0, cam, a.pos);
      // a fade in from the far water and out right behind us
      const op = sstep(cz - 44, cz - 36, a.pos[2]) * sstep(cz + 7, cz + 4, a.pos[2]);
      put(a.kind, a.pos, e, a.size, a.phase, op, a.squeeze || 0);
      if (a.kind === 'das') { lures[1].uPos.value = lurePos(a.pos, e, a.size); lures[1].uR.value = 0.17 * a.size; lures[1].uOn.value = op; }
    }
  }
  for (const [name, K] of Object.entries(kinds)) {
    if (!K.attrs) continue;
    // only the animals shown are drawn
    K.mesh.visible = shown[name] > 0;
    K.mesh.geometry.setInstancedCount(Math.max(1, shown[name]));
    for (const at of Object.values(K.attrs)) at.needsUpdate = true;
  }

  // camera: looks where the pointer says, turned a little towards the staged animal
  let fy = 0, fp = 0;
  if (focus && focusW > 0.01) {
    const d = sub(focus, cam);
    fy = Math.atan2(d[0], -d[2]); fp = Math.atan2(d[1], Math.hypot(d[0], d[2]));
    // (a narrow phone screen sees little to the sides: it turns more)
    const k = innerWidth < innerHeight ? 0.85 : 0.35;
    fy = clamp(fy, -0.9, 0.9) * k * focusW; fp = clamp(fp, -0.6, 0.6) * 0.3 * focusW;
  }
  look.sx += (fy - look.sx) * Math.min(1, dt * 1.2); look.sy += (fp - look.sy) * Math.min(1, dt * 1.2);
  const yaw = look.x * 0.4 + look.sx, pitch = -look.y * 0.26 + look.sy;
  camera.position.set(...cam);
  camera.lookAt([Math.sin(yaw) * 4, cam[1] + Math.sin(pitch) * 4, cz - Math.cos(yaw) * 4]);

  // the forest: which chunks are round us
  const k0 = Math.floor((-cz - 30) / PERIOD);
  const chunks = [];
  for (let i = 0; i < NCH; i++) {
    const k = k0 + i + 1, zk = -k * PERIOD;
    chunks.push([zk, k % 2 ? -1 : 1, ((Math.sin(k * 12.9898) * 43758.5453) % 1 + 1) % 1]);
  }
  const mode = VIEW.pozadi;
  if (forestPts) {
    forestPts.visible = mode !== 'vrstvy';
    F.uMinNear.value = mode === 'kombinace' ? 0.55 : 0;
    const d = chunkData.iCh.data;
    chunks.forEach((c, i) => d.set([c[0], c[1], c[2], 0], i * 4));
    forestPts.geometry.attributes.iCh.needsUpdate = true;
  }
  layerSlots.forEach((meshes, i) => {
    const [zk, mir, seed] = chunks[i];
    meshes.forEach((m, j) => {
      // the back layer is the shared far distance; per chunk only the cut-out layers (in the combination the middle one)
      const on = j > 0 && (mode === 'vrstvy' || (mode === 'kombinace' && j === 1));
      m.visible = on && !!layerTex[j].image;
      if (!m.visible) return;
      const Z = LAYER_Z[j];
      m.position.set(0, EYE, zk - Z);
      m.scale.x = Math.abs(m.scale.x) * mir;
      // a layer fades as the camera comes close to it (the back one too, so the next chunk shows behind it)
      const dz = cz - (zk - Z);
      m.fade = sstep(j === 0 ? 1 : 0.2, j === 0 ? 7 : 2.5, dz);
      m.blur = mode === 'kombinace' ? 0.002 : 0;
      void seed;
    });
  });
  // the far distance rides along at the end of the corridor, slowly breathing
  farMesh.visible = !!layerTex[0].image;
  const fd = 46, fk = 1.05 + 0.03 * Math.sin(time * 0.05);
  farMesh.position.set(0, EYE + 7, cz - fd);
  farMesh.scale.set(fd * 2 * TX * fk * 1.15 * (Math.floor(-cz / 60) % 2 ? -1 : 1), fd * 2 * TY * fk * 1.9, 1);
  glass.position.z = frameMesh.position.z = -(Math.floor(-cz / SEG) - 2) * SEG;

  // colours: original, the site's, or the forest original and the animals violet
  const web = VIEW.barvy === 'web' ? 1 : 0, animalsOrig = VIEW.barvy === 'puvodni' ? 1 : 0;
  col.web += (web - col.web) * Math.min(1, dt * 3); col.orig += (animalsOrig - col.orig) * Math.min(1, dt * 3);
  W.uWeb.value = col.web; AU.uOrig.value = col.orig;
  const water = mix3(WATER.orig, WATER.web, col.web).map(v => v * (1 - 0.55 * dark));
  W.uWater.value = water; gl.clearColor(water[0], water[1], water[2], 1);
  W.uDark.value += (dark - W.uDark.value) * Math.min(1, dt * 2);
  W.uTime.value = time; W.uSize.value = S.size; W.uSway.value = S.sway; W.uClear.value = S.clear; W.uLight.value = S.light; W.uPx.value = PX(); W.uDpr.value = renderer.dpr; W.uCam.value = cam;
  GU.uTime.value = time; GU.uGlass.value = S.glass; GU.uLight.value = S.light * (1 - W.uDark.value);
  GU.uTint.value = mix3([0.8, 0.92, 0.88], LILAC, col.web);
  for (const K of Object.values(kinds)) K.U.uOrig.value = col.orig;
  renderer.render({ scene, camera });
};
requestAnimationFrame(tick);
