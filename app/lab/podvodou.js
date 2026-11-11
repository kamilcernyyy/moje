/* Grafysta lab: a glass tunnel under water, our animals all round it.
   The tunnel of "Mé práce" (2 × 1.8, segments 1 deep, a 4 × 4 grid), but glazed all over: the grid is the frame, every
   cell a pane of glass (faint, brighter at a glancing angle, a soft sheen sliding over it, light rippling over the
   floor panes as under a water surface). Outside is the sea: deep water that swallows what is far, light falling in
   shafts from above, snow sinking, a sandy floor below. In it our animals, in 3D, each doing what it does: sharks
   cruising along the tunnel, mantas and the hammerhead passing overhead (seen from below), jellyfish pulsing upwards,
   octopuses on the sea floor, the anglerfish low in the dark with its lure alight. The camera drifts down the tunnel
   (faster while pressed), the scroll flies it on, the pointer turns the head to look round; the world goes on
   for ever (whatever falls behind turns up again ahead). */
import { Program, Mesh, Geometry, Triangle } from 'ogl';
import { stage, drawing, sample, panel, reduce, narrow, gsap, VIOLET, LILAC, GLSL_TONE } from './tvor.js';

const S = {
  flight: 6, // tunnel segments flown per screen of scroll
  speed: 1, // drifting speed when the page is still
  animals: 1, // how many animals
  glass: 1, // how much the glass shows
  light: 1, // light shafts and ripples from above
  size: 0.8 // particle size
};
const st = stage({ fov: 50 });
const { gl, scene, camera, renderer } = st;
camera.near = 0.02; camera.far = 120; camera.perspective({});
const WATER = { web: [0.035, 0.03, 0.09], orig: [0.03, 0.06, 0.08] };
const FOGGLSL = /* glsl */ `float water(float d) { return exp(-d * .045); }`;

// ---------- the sea behind everything: deep water, lighter towards the surface ----------
const BU = { uTop: { value: [0.09, 0.07, 0.2] }, uDeep: { value: WATER.web }, uPitch: { value: 0 } };
const bgProg = new Program(gl, {
  vertex: `attribute vec2 position; varying vec2 vP; void main(){ vP = position; gl_Position = vec4(position, 0., 1.); }`,
  fragment: `precision highp float; uniform vec3 uTop, uDeep; uniform float uPitch; varying vec2 vP;
    void main(){ float t = smoothstep(-1.2, 1.4, vP.y * .55 + uPitch); gl_FragColor = vec4(mix(uDeep * .7, uTop, t * t), 1.); }`,
  uniforms: BU, depthTest: false, depthWrite: false
});
const bg = new Mesh(gl, { geometry: new Triangle(gl), program: bgProg, frustumCulled: false });
bg.renderOrder = -10; bg.setParent(scene);

// ---------- the glass tunnel ----------
const TW = 2, TH = 1.8, SEG = 1, NSEG = 24, GRID = 4, hw = TW / 2, hh = TH / 2, colW = TW / GRID, rowH = TH / GRID;
const panes = { position: [], uv: [], normal: [], size: [] };
const frame = [];
for (let s = 0; s <= NSEG; s++) {
  const z0 = -s * SEG, z1 = z0 - SEG;
  const quad = (a, b, c, d, n, w, h) => {
    for (const [p, uv] of [[a, [0, 0]], [b, [1, 0]], [c, [1, 1]], [a, [0, 0]], [c, [1, 1]], [d, [0, 1]]]) {
      panes.position.push(...p); panes.uv.push(...uv); panes.normal.push(...n); panes.size.push(w, h);
    }
  };
  for (let i = 0; i < GRID; i++) {
    const x0 = -hw + i * colW, x1 = x0 + colW;
    quad([x0, -hh, z0], [x1, -hh, z0], [x1, -hh, z1], [x0, -hh, z1], [0, 1, 0], colW, SEG);
    quad([x0, hh, z0], [x1, hh, z0], [x1, hh, z1], [x0, hh, z1], [0, -1, 0], colW, SEG);
    const y0 = -hh + i * rowH, y1 = y0 + rowH;
    quad([-hw, y0, z0], [-hw, y1, z0], [-hw, y1, z1], [-hw, y0, z1], [1, 0, 0], rowH, SEG);
    quad([hw, y0, z0], [hw, y1, z0], [hw, y1, z1], [hw, y0, z1], [-1, 0, 0], rowH, SEG);
  }
  const L = (a, b) => frame.push(...a, ...b);
  for (let i = 0; i <= GRID; i++) { const x = -hw + i * colW; L([x, -hh, z0], [x, -hh, z1]); L([x, hh, z0], [x, hh, z1]); }
  for (let i = 1; i < GRID; i++) { const y = -hh + i * rowH; L([-hw, y, z0], [-hw, y, z1]); L([hw, y, z0], [hw, y, z1]); }
  L([-hw, -hh, z0], [hw, -hh, z0]); L([-hw, hh, z0], [hw, hh, z0]); L([-hw, -hh, z0], [-hw, hh, z0]); L([hw, -hh, z0], [hw, hh, z0]);
}
const GU = { uTime: { value: 0 }, uGlass: { value: 1 }, uLight: { value: 1 }, uTint: { value: LILAC }, uShift: { value: 0 } };
const glassProg = new Program(gl, {
  vertex: `attribute vec3 position, normal; attribute vec2 uv, size; uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
    varying vec3 vW, vN; varying vec2 vUv, vSize; varying float vD;
    void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normal; vUv = uv; vSize = size;
      vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragment: `precision highp float; uniform vec3 cameraPosition, uTint; uniform float uTime, uGlass, uLight;
    varying vec3 vW, vN; varying vec2 vUv, vSize; varying float vD;
    float wave(vec2 p, float t){ return sin(p.x * 2.1 + t) * sin(p.y * 1.7 - t * .8) + sin((p.x + p.y) * 3.3 + t * 1.3) * .5 + sin((p.x - p.y) * 4.1 - t * 1.1) * .35; }
    void main(){
      vec3 V = normalize(cameraPosition - vW);
      float fres = pow(1. - abs(dot(vN, V)), 3.);
      // the pane's edge, against its frame (in world units)
      vec2 e = min(vUv, 1. - vUv) * vSize;
      float edge = 1. - smoothstep(0., .035, min(e.x, e.y));
      // a soft sheen sliding over the glass
      float band = fract((vW.x * .6 + vW.y * .9 - vW.z * .35) * .32 + uTime * .02);
      float sheen = smoothstep(.0, .08, band) * smoothstep(.2, .08, band);
      // light rippling over the floor panes, as under a water surface
      float floorPane = step(.5, vN.y);
      float c = wave(vW.xz * 2.2, uTime * 1.2);
      float caustic = floorPane * pow(max(0., 1. - abs(c) * 1.6), 6.) * uLight;
      float a = (.012 + fres * .13 + edge * .05 + sheen * .035) * uGlass;
      vec3 col = uTint * a + vec3(.75, .8, 1.) * caustic * .14;
      gl_FragColor = vec4(col * exp(-vD * .12) * smoothstep(19., 12., vD), 1.);
    }`,
  uniforms: GU, transparent: true, depthTest: false, depthWrite: false, cullFace: null
});
glassProg.setBlendFunc(gl.ONE, gl.ONE);
const glass = new Mesh(gl, {
  geometry: new Geometry(gl, { position: { size: 3, data: new Float32Array(panes.position) }, uv: { size: 2, data: new Float32Array(panes.uv) }, normal: { size: 3, data: new Float32Array(panes.normal) }, size: { size: 2, data: new Float32Array(panes.size) } }),
  program: glassProg, frustumCulled: false
});
glass.setParent(scene);
const frameProg = new Program(gl, {
  vertex: `attribute vec3 position; uniform mat4 modelViewMatrix, projectionMatrix; varying float vD; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragment: `precision highp float; uniform vec3 uTint; uniform float uGlass; varying float vD; void main(){ gl_FragColor = vec4(uTint * .16 * uGlass * exp(-vD * .12) * smoothstep(19., 12., vD), 1.); }`,
  uniforms: GU, transparent: true, depthTest: false, depthWrite: false
});
frameProg.setBlendFunc(gl.ONE, gl.ONE);
const frameMesh = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: new Float32Array(frame) } }), program: frameProg, mode: gl.LINES, frustumCulled: false });
frameMesh.setParent(scene);

// ---------- the sea: light shafts from above, sinking snow, the sandy floor ----------
const WU = { uTime: { value: 0 }, uCam: { value: [0, 0, 0] }, uDpr: { value: renderer.dpr }, uSize: { value: 1 }, uLight: { value: 1 }, uTint: { value: LILAC }, uOrig: { value: 0 } };
// shafts: tall soft planes turned to the camera, swaying
const shafts = [];
for (let i = 0; i < 9; i++) {
  const x = (Math.random() < 0.5 ? -1 : 1) * (2.2 + Math.random() * 7), z = -Math.random() * 30, w = 0.8 + Math.random() * 1.8;
  for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) shafts.push(x, z, w, u, v, Math.random());
}
const shaftProg = new Program(gl, {
  vertex: `attribute vec3 position; attribute vec3 aUv; uniform mat4 viewMatrix, projectionMatrix; uniform vec3 uCam; uniform float uTime;
    varying vec2 vUv; varying float vD, vR;
    void main(){
      vUv = aUv.xy; vR = aUv.z;
      float z = uCam.z - 32. + mod(position.y - uCam.z + 32., 34.);
      vec3 c = vec3(position.x + sin(uTime * .1 + aUv.z * 6.) * .6, 1., z);
      vec3 toCam = normalize(vec3(uCam.x - c.x, 0., uCam.z - c.z)); vec3 side = vec3(toCam.z, 0., -toCam.x);
      vec3 p = c + side * (aUv.x - .5) * position.z + vec3(0., (aUv.y - .5) * 14. + 2., 0.) + side * (aUv.y - .5) * 1.5;
      vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragment: `precision highp float; uniform vec3 uTint; uniform float uLight, uTime; varying vec2 vUv; varying float vD, vR;
    void main(){ float x = 1. - abs(vUv.x * 2. - 1.); float a = x * x * smoothstep(0., .9, vUv.y) * (.6 + .4 * sin(uTime * .5 + vR * 9.));
      gl_FragColor = vec4(mix(uTint, vec3(1.), .4) * a * .05 * uLight * exp(-vD * .05), 1.); }`,
  uniforms: WU, transparent: true, depthTest: false, depthWrite: false, cullFace: null
});
shaftProg.setBlendFunc(gl.ONE, gl.ONE);
{
  const n = shafts.length / 6, pos = new Float32Array(n * 3), uv = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos.set([shafts[i * 6], shafts[i * 6 + 1], shafts[i * 6 + 2]], i * 3); uv.set([shafts[i * 6 + 3], shafts[i * 6 + 4], shafts[i * 6 + 5]], i * 3); }
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: pos }, aUv: { size: 3, data: uv } }), program: shaftProg, frustumCulled: false }).setParent(scene);
}
// snow (in a box that travels with the camera) and the sand (a field below that does too)
const snowN = narrow ? 2500 : 5000, sandN = narrow ? 9000 : 18000;
const snow = new Float32Array(snowN * 4), sand = new Float32Array(sandN * 4);
for (let k = 0; k < snowN; k++) snow.set([(Math.random() - 0.5) * 24, Math.random() * 12 - 4, Math.random() * 34, Math.random()], k * 4);
for (let k = 0; k < sandN; k++) sand.set([(Math.random() - 0.5) * 30, -3.1, Math.random() * 34, Math.random()], k * 4);
const seaProg = sink => new Program(gl, {
  vertex: `attribute vec4 position; uniform mat4 viewMatrix, projectionMatrix; uniform vec3 uCam, uTint; uniform float uTime, uDpr, uSize, uOrig;
    varying vec3 vC; varying float vA;
    void main(){ vec3 p = position.xyz;
      p.z = uCam.z - 32. + mod(p.z - uCam.z + 32., 34.);
      ${sink ? `p.y = -4. + mod(p.y + 4. - uTime * .08 * (.5 + position.w), 12.); p.x += sin(uTime * .3 + position.w * 20.) * .2;`
             : `p.y += sin(p.x * 1.3 + p.z * .9) * .12 + sin(p.x * .4 - p.z * .7) * .2;`}
      if (abs(p.x) < 1.05 && abs(p.y) < .95) p.y += 30.; // nothing inside the tunnel
      vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z; gl_Position = projectionMatrix * mv;
      vC = mix(uTint, vec3(.8, .8, .75), uOrig) * ${sink ? '.5' : '.32'} * (.5 + position.w);
      vA = exp(-d * .1);
      gl_PointSize = ${sink ? '2.2' : '2.6'} * uDpr * uSize * (4. / max(d, .4)); }`,
  fragment: `precision highp float; varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; gl_FragColor = vec4(vC * vA * smoothstep(.25, 0., r), 1.); }`,
  uniforms: WU, transparent: true, depthTest: false, depthWrite: false
});
for (const [data, sink] of [[snow, 1], [sand, 0]]) {
  const p = seaProg(sink); p.setBlendFunc(gl.ONE, gl.ONE);
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data } }), program: p, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
}

// ---------- the animals ----------
// each kind: its drawing, how it is laid in the water ("side": drawn from the side, upright, swimming along its
// drawing; "top": drawn from above, lying flat, seen from below; "front": drawn from the front, turned to the camera),
// where its head points in the drawing, and how it moves
const KINDS = {
  zralok: { base: '/lab/tunel/zralok', hmax: 80.9, lay: 'side', head: [1, 0], move: 'tail', n: 4500 },
  kladivoun: { base: '/lab/kladivoun/kladivoun', hmax: 101.7, lay: 'top', head: [0, 1], move: 'tailTop', n: 7000 },
  mantaA: { base: '/lab/manty/manta-a', hmax: 80.8, lay: 'top', head: [-74.4, -112.8], c: [247.2, 210], move: 'flap', n: 6000 },
  mantaB: { base: '/lab/manty/manta-b', hmax: 115.6, lay: 'top', head: [75, 144], c: [255, 180], move: 'flap', n: 6000 },
  meduza: { base: '/lab/meduza/meduza', hmax: 140.9, lay: 'front', head: [0, 1], move: 'pulse', n: 9000 },
  chobotnice: { base: '/lab/chobotnice/chobotnice', hmax: 120, lay: 'front', head: [0, 1], move: 'arms', n: 9000 },
  das: { base: '/lab/das/das', hmax: 173.2, lay: 'side', head: [1, 0], move: 'fins', n: 8000 }
};
const MOVES = {
  tail: `float sw = pow(s, 1.5) * sin(ph - s * 7.); z += .09 * sw; q.y += .01 * sw;`,
  tailTop: `q += perp * .07 * pow(s, 1.5) * sin(ph - s * 7.); z += .02 * pow(s, 2.) * cos(ph - s * 7.);`,
  flap: `float wg = abs(q.y) / max(uLmax, .1); z += .3 * uLmax * pow(wg, 1.6) * sin(ph - wg * 1.7); q.y *= 1. - .05 * pow(wg, 2.);`,
  pulse: `float bell = 1. - smoothstep(.17, .23, s); float pz = pow(sin(ph * .5) * .5 + .5, 3.); q.x *= 1. - .14 * bell * pz; z *= 1. - .14 * bell * pz; q.y += .02 * bell * pz;
    float sn = clamp((s - .2) / .8, 0., 1.); q.x += .025 * sn * sin(ph * .6 - s * 14.); z += .04 * sn * cos(ph * .55 - s * 12. + q.x * 9.);`,
  arms: `float sn = clamp((s - .24) / .76, 0., 1.); float w = pow(sn, 1.3); q += perp * .035 * w * sin(ph * .6 - s * 17.); z += .06 * w * cos(ph * .55 - s * 15. + q.x * 6.);`,
  fins: `float hn = clamp(abs(z) / .15, 0., 1.); z += .015 * pow(1. - hn, 2.) * smoothstep(.42, .7, s) * sin(ph * 4. + s * 14.); q.y += .008 * sin(ph);`
};
const AU = { uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uPx: { value: 1 }, uSize: { value: 1 }, uOrig: { value: 0 }, uWater: { value: WATER.web }, uA: { value: VIOLET }, uB: { value: LILAC } };
const MAXA = 8;
const kinds = {};
for (const [name, K] of Object.entries(KINDS)) {
  const U = { ...AU, uSp: { value: 0.01 }, uLmax: { value: 0.4 }, uRot: { value: [1, 0, 0, 1] }, uC: { value: [0, 0] } };
  const program = new Program(gl, {
    vertex: /* glsl */ `#version 300 es
      in vec4 position; in vec4 aBody; in vec3 iP; in vec3 iE1; in vec3 iE2; in vec3 iE3; in vec4 iS; // iS: size, phase, opacity, -
      uniform mat4 viewMatrix, projectionMatrix; uniform vec3 cameraPosition, uWater, uA, uB;
      uniform float uTime, uDpr, uPx, uSize, uOrig, uSp, uLmax; uniform mat2 uRot; uniform vec2 uC;
      out vec3 vC; out float vA; out float vD;
      ${GLSL_TONE}
      ${FOGGLSL}
      void main() {
        if (iS.x <= 0.) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
        float r = position.w, s = aBody.x, L = aBody.w;
        // the drawing turned so that its head points along +x (its own frame: x forward, y up or aside, z its thickness)
        vec2 q = uRot * (position.xy - uC);
        vec2 t = uRot * aBody.yz; vec2 perp = vec2(-t.y, t.x);
        float z = position.z, ph = iS.y;
        ${MOVES[K.move]}
        vec3 p = iP + (iE1 * q.x + iE2 * q.y + iE3 * z) * iS.x;
        p += .01 * iS.x * vec3(sin(uTime * 1.3 + r * 40.), sin(uTime * 1.1 + r * 60.), sin(uTime * .9 + r * 80.));
        vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z;
        gl_Position = projectionMatrix * mv;
        // the farther, the more the water takes it: its colour sinks into the water's, then it is gone
        float wv = water(vD);
        vC = mix(uWater * 2.5, toneColor(L, uOrig, uA, uB), wv) * (.7 + .5 * r);
        vA = toneAlpha(L, uOrig) * .78 * iS.z * facingAlpha(sign(position.z), p, cameraPosition, iE3) * (.25 + .75 * wv) * smoothstep(40., 26., vD);
        gl_PointSize = clamp(1.4 * uSize * uSp * iS.x * uPx / max(vD, .1), 1., 6. * uDpr * max(uSize, .4));
      }`,
    fragment: /* glsl */ `#version 300 es
      precision highp float; in vec3 vC; in float vA; in float vD; out vec4 o;
      void main() { vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; o = vec4(vC * vA * smoothstep(.25, .0, r), 1.); }`,
    uniforms: U, transparent: true, depthTest: false, depthWrite: false
  });
  program.setBlendFunc(gl.ONE, gl.ONE);
  const kind = { K, U, mesh: null, attrs: null };
  kinds[name] = kind;
  drawing(K.base).then(d => {
    const m = Math.max(d.w, d.h);
    const { pos, body, spacing } = sample(d, { N: Math.round(K.n * (narrow ? 0.55 : 1)), sc: 1 / m, hmax: K.hmax, thick: 0.6 });
    // the head along +x (head directions are given with y up; drawings seen from the front stay as they are)
    const rotA = K.lay === 'front' ? 0 : -Math.atan2(K.head[1], K.head[0]);
    U.uRot.value = [Math.cos(rotA), Math.sin(rotA), -Math.sin(rotA), Math.cos(rotA)];
    if (K.c) U.uC.value = [(K.c[0] - d.w / 2) / m, (d.h / 2 - K.c[1]) / m];
    // how far the wings reach out from the body's line (for the mantas)
    let lmax = 0.1;
    for (let k = 0; k < pos.length; k += 4) {
      const x = pos[k] - U.uC.value[0], y = pos[k + 1] - U.uC.value[1];
      lmax = Math.max(lmax, Math.abs(Math.sin(rotA) * x + Math.cos(rotA) * y));
    }
    U.uLmax.value = lmax; U.uSp.value = spacing;
    const inst = n => ({ instanced: 1, size: n, data: new Float32Array(MAXA * n) });
    kind.attrs = { iP: inst(3), iE1: inst(3), iE2: inst(3), iE3: inst(3), iS: inst(4) };
    kind.mesh = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: pos }, aBody: { size: 4, data: body }, ...kind.attrs }), program, mode: gl.POINTS, frustumCulled: false });
    kind.mesh.setParent(scene);
  });
}

// the lure of the anglerfish: a small star of light with a halo
const lurePts = [];
for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, len = k % 2 ? 0.48 : 1; for (let i = 0; i < 40; i++) { const t = Math.random(); lurePts.push(Math.cos(a) * t * len, Math.sin(a) * t * len, 0, Math.random()); } }
for (let i = 0; i < 400; i++) { const a = Math.random() * 6.283, rr = Math.abs(Math.random() + Math.random() + Math.random() - 1.5) * 1.2; lurePts.push(Math.cos(a) * rr, Math.sin(a) * rr, 0, 2 + Math.random()); }
const LU = { uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uPx: { value: 1 }, uPos: { value: [0, -50, 0] }, uR: { value: 0.2 }, uTint: { value: LILAC }, uOrig: { value: 0 } };
const lureProg = new Program(gl, {
  vertex: `attribute vec4 position; uniform mat4 viewMatrix, projectionMatrix; uniform vec3 uPos, uTint; uniform float uTime, uDpr, uPx, uR, uOrig;
    varying vec3 vC; varying float vA;
    void main(){ bool halo = position.w >= 2.; float a = uTime * .2;
      vec2 q = mat2(cos(a), sin(a), -sin(a), cos(a)) * position.xy;
      vec4 mv = viewMatrix * vec4(uPos + vec3(q * uR * (1. + .08 * sin(uTime * 2.3)), 0.), 1.);
      gl_Position = projectionMatrix * mv; float d = -mv.z;
      vC = mix(mix(uTint, vec3(1.), .55), vec3(1., .97, .9), uOrig); vA = (halo ? .12 : .9) * exp(-d * .05);
      gl_PointSize = (halo ? 3.2 : 1.8) * uDpr * uPx * .04 * uR / max(d, .2); }`,
  fragment: `precision highp float; varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; gl_FragColor = vec4(vC * vA * smoothstep(.25, 0., r), 1.); }`,
  uniforms: LU, transparent: true, depthTest: false, depthWrite: false
});
lureProg.setBlendFunc(gl.ONE, gl.ONE);
new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: new Float32Array(lurePts) } }), program: lureProg, mode: gl.POINTS, frustumCulled: false }).setParent(scene);

// ---------- the animals' lives ----------
const R = (a, b) => a + Math.random() * (b - a);
const side = () => (Math.random() < 0.5 ? -1 : 1);
// how many of each, and where each kind lives (relative to the tunnel)
const HOW = { zralok: 6, kladivoun: 2, mantaA: 2, mantaB: 2, meduza: 6, chobotnice: 2, das: 1 };
const place = (a, z) => {
  a.z = z;
  switch (a.kind) {
    case 'zralok': a.size = R(1.3, 2.3); a.x = side() * R(1.7, 4.5); a.y = R(-2, 2.4); a.th = Math.random() < 0.5 ? 0 : Math.PI; a.v = R(0.45, 0.9); break;
    case 'kladivoun': a.size = R(2.4, 3.4); a.x = R(-4, 4); a.y = R(2.4, 3.8); a.th = R(0, 6.28); a.v = R(0.35, 0.55); break;
    case 'mantaA': case 'mantaB': a.size = R(2.2, 3.4); a.x = R(-5, 5); a.y = R(2.1, 4.2); a.th = R(0, 6.28); a.v = R(0.4, 0.6); break;
    case 'meduza': a.size = R(1.4, 2.6); a.x = side() * R(1.8, 4.5); a.y = R(-2, 3.5); a.v = 0; break;
    case 'chobotnice': a.size = R(1.6, 2.4); a.x = side() * R(1.8, 5); a.y = -3.1 + a.size * 0.42; a.th = R(0, 6.28); a.v = R(0.03, 0.08); break;
    case 'das': a.size = R(1.1, 1.5); a.x = side() * R(2.2, 5); a.y = R(-2.4, -1.9); a.th = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2; a.v = R(0.08, 0.16); break;
  }
  a.turn = 0; a.turnTo = 0; a.turnT = R(2, 5); a.phase = R(0, 6.28); a.bank = 0;
};
const agents = [];
for (const [kind, n] of Object.entries(HOW)) for (let i = 0; i < n; i++) { const a = { kind, i }; place(a, -R(0, 30)); agents.push(a); }

const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const live = (a, go, t, cam) => {
  // the world goes on for ever: what falls behind the camera turns up again ahead (and the other way round)
  if (a.z > cam[2] + 5) place(a, cam[2] - R(24, 32));
  else if (a.z < cam[2] - 36) place(a, cam[2] + R(2, 4));
  a.turnT -= go;
  if (a.turnT <= 0) { a.turnT = R(2, 6); a.turnTo = R(-0.25, 0.25); }
  a.turn += (a.turnTo - a.turn) * Math.min(1, go * 0.8);
  let fwd, e1, e2, e3;
  const up = [0, 1, 0];
  if (a.kind === 'meduza') {
    // pulses upwards: each squeeze lifts it, then it sinks back a little; gone above, it comes again from below
    a.phase += go * 2.4;
    const pz = Math.pow(Math.sin(a.phase * 0.5) * 0.5 + 0.5, 3);
    a.y += go * (pz * 0.35 - 0.05); a.x += Math.sin(t * 0.1 + a.i) * go * 0.05;
    if (a.y > 5) a.y = -3.5;
  } else if (a.kind === 'chobotnice') {
    a.phase += go * 3; a.th += a.turn * go * 0.3;
    a.x += Math.sin(a.th) * a.v * go; a.z -= Math.cos(a.th) * a.v * go;
    if (Math.abs(a.x) < 1.7) a.x = Math.sign(a.x || 1) * 1.7;
  } else {
    // swimming: a slowly changing turn, sharks keep along the tunnel; the anglerfish just hangs and drifts
    a.th += a.turn * go * (a.kind === 'zralok' ? 0.4 : 1);
    if (a.kind === 'zralok') { const want = Math.cos(a.th) > 0 ? 0 : Math.PI; a.th += Math.atan2(Math.sin(want - a.th), Math.cos(want - a.th)) * go * 0.3; }
    const v = a.v;
    a.x += Math.sin(a.th) * v * go; a.z -= Math.cos(a.th) * v * go;
    if (a.kind === 'zralok') { a.y += Math.sin(t * 0.3 + a.i * 2) * go * 0.08; if (Math.abs(a.x) < 1.7) a.x = Math.sign(a.x) * 1.7; }
    a.phase += go * 6.283 * (a.kind === 'zralok' ? 0.9 : a.kind === 'kladivoun' ? 0.7 : a.kind === 'das' ? 0.4 : 0.5);
    a.bank += (-a.turn * 1.5 - a.bank) * Math.min(1, go * 2);
  }
  if (a.kind === 'meduza' || a.kind === 'chobotnice') {
    // turned to the camera
    e2 = up; e3 = norm([cam[0] - a.x, 0, cam[2] - a.z]); e1 = cross(e2, e3);
  } else {
    fwd = [Math.sin(a.th), 0, -Math.cos(a.th)];
    if (KINDS[a.kind].lay === 'side') { e1 = fwd; e2 = up; e3 = cross(e1, e2); }
    else {
      // lying flat, banking into its turns
      const sd = cross(up, fwd), c = Math.cos(a.bank), s = Math.sin(a.bank);
      e1 = fwd; e2 = [sd[0] * c + up[0] * s, sd[1] * c + up[1] * s, sd[2] * c + up[2] * s]; e3 = cross(e1, e2);
    }
  }
  return { e1, e2, e3 };
};

// ---------- flight and looking round ----------
const fly = { z: 0 };
const toZ = gsap.quickTo(fly, 'z', { duration: 1.1, ease: 'power3.out' });
let pressed = false;
addEventListener('pointerdown', e => { if (!(e.target.closest && e.target.closest('.lab-panel, .lab-toggle, .gm, .lab-nav, a, button'))) pressed = true; });
addEventListener('pointerup', () => { pressed = false; });
const look = { x: 0, y: 0 };
const tx = gsap.quickTo(look, 'x', { duration: 1.4, ease: 'power3.out' }), ty = gsap.quickTo(look, 'y', { duration: 1.4, ease: 'power3.out' });
addEventListener('pointermove', e => { tx((e.clientX / innerWidth) * 2 - 1); ty((e.clientY / innerHeight) * 2 - 1); }, { passive: true });
const hero = document.querySelector('.lt-hero');
const onScroll = () => {
  toZ((scrollY / innerHeight) * S.flight * SEG);
  const c = Math.min(1, scrollY / (innerHeight * 0.6));
  if (hero) { hero.style.opacity = String(1 - c); hero.style.transform = `scale(${1 + c * 0.7})`; hero.style.filter = `blur(${(c * 8).toFixed(1)}px)`; }
};
addEventListener('scroll', onScroll, { passive: true }); onScroll();

const COL = panel(S, {});
let drift = 0, time = 0, last = performance.now();
const tick = now => {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const go = reduce ? 0 : dt;
  time += go;
  drift += go * 0.27 * S.speed * (pressed ? 3.3 : 1);
  const z = -(drift + fly.z);
  // looking round: the head turns after the pointer, as if walking through the tunnel
  const yaw = look.x * 0.38, pitch = -look.y * 0.24;
  camera.position.set(0, -0.15, z);
  camera.lookAt([Math.sin(yaw) * 4, -0.15 + Math.sin(pitch) * 4, z - Math.cos(yaw) * 4]);
  const cam = [0, -0.15, z];
  // the tunnel moves on with the camera one segment at a time
  const base = Math.floor(-z / SEG) - 2;
  glass.position.z = -base * SEG; frameMesh.position.z = -base * SEG;
  // the animals
  const counts = {};
  for (const a of agents) {
    const share = HOW[a.kind] * S.animals;
    if (a.i >= Math.round(share)) continue;
    const kind = kinds[a.kind];
    const { e1, e2, e3 } = live(a, go, time, cam);
    if (!kind.attrs) continue;
    const k = (counts[a.kind] = (counts[a.kind] || 0) + 1) - 1;
    if (k >= MAXA) continue;
    kind.attrs.iP.data.set([a.x, a.y, a.z], k * 3);
    kind.attrs.iE1.data.set(e1, k * 3); kind.attrs.iE2.data.set(e2, k * 3); kind.attrs.iE3.data.set(e3, k * 3);
    kind.attrs.iS.data.set([a.size, a.phase, 1, 0], k * 4);
    if (a.kind === 'das') {
      // the lure: at the star of the drawing (in the fish's own frame), lit
      const lx = 0.316 * a.size, ly = 0.251 * a.size;
      LU.uPos.value = [a.x + e1[0] * lx + e2[0] * ly, a.y + e1[1] * lx + e2[1] * ly, a.z + e1[2] * lx + e2[2] * ly];
      LU.uR.value = 0.17 * a.size;
    }
  }
  for (const [name, kind] of Object.entries(kinds)) {
    if (!kind.attrs) continue;
    const used = counts[name] || 0;
    for (let k = used; k < MAXA; k++) kind.attrs.iS.data[k * 4] = 0;
    for (const at of Object.values(kind.attrs)) at.needsUpdate = true;
  }
  if (!counts.das) LU.uPos.value = [0, -80, 0];
  // colours, light
  const o = (common => { common.uOrig.value += (COL.orig - common.uOrig.value) * 0.08; return common.uOrig.value; })(AU);
  const water = WATER.web.map((c, i) => c + (WATER.orig[i] - c) * o);
  AU.uWater.value = water; BU.uDeep.value = water; BU.uTop.value = [0.09 - 0.04 * o, 0.07 + 0.03 * o, 0.2 - 0.06 * o]; BU.uPitch.value = pitch * 0.8;
  AU.uTime.value = time; AU.uSize.value = S.size; AU.uPx.value = st.px(); AU.uDpr.value = renderer.dpr;
  GU.uTime.value = time; GU.uGlass.value = S.glass; GU.uLight.value = S.light; GU.uTint.value = LILAC.map((c, i) => c + ([0.75, 0.85, 0.95][i] - c) * o);
  WU.uTime.value = time; WU.uCam.value = cam; WU.uSize.value = S.size; WU.uLight.value = S.light; WU.uOrig.value = o; WU.uDpr.value = renderer.dpr;
  LU.uTime.value = time; LU.uPx.value = st.px(); LU.uDpr.value = renderer.dpr; LU.uOrig.value = o;
  renderer.render({ scene, camera });
};
requestAnimationFrame(tick);
