/* Grafysta lab: the anglerfish in the deep.
   The deeper the page is scrolled, the darker the sea: at the top the fish is plainly seen, at the bottom only what
   its lure lights. The lure (the star of the drawing, here a glowing star of light) breathes and flickers and lights
   the fish's head and the sinking snow around it. The fish is curious: it swims lazily after the pointer (on a phone
   it wanders), turns round when the pointer goes behind it, and keeps its mouth a little way off; bring the pointer
   right to its mouth and it snaps. The scroll carries it away with the page and it swims back. Its jaw works slowly,
   the fins flutter, the tail sways, the lure bobs on its stalk. */
import { stage, drawing, sample, dust, scrolling, pointer, sections, panel, smooth, reduce, narrow, VIOLET, LILAC, GLSL_TONE, FRAG, Program, Mesh, Geometry, gsap } from './tvor.js';

const S = {
  dark: 0.85, // how dark the sea gets at the bottom of the page
  light: 1, // the lure's light
  curious: 1, // how eagerly it follows the pointer
  motion: 1, // jaw, fins, tail, lure
  scale: 1, // size of the fish
  angle: 16, // sections turning (deg)
  size: 1 // particle size
};
const st = stage();
const { gl, scene, camera, renderer } = st;
const H = 10, DIST = H / 2 / Math.tan((st.fov * Math.PI) / 360);
// the drawing (px, y down): its middle, the jaw's hinge, the tail's base, the lure's stalk base, the star, the mouth
const DW = 682, DH = 606, HMAX = 173.2;
const C = [402.5, 350], HINGE = [420, 463.4], TAILB = [175, 402.5], STALK = [306, 166], STAR = [556.5, 131.6], MOUTH = [560, 392];

const U = {
  uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uPx: { value: 1 }, uSp: { value: 1 }, uSize: { value: 1 }, uOrig: { value: 0 }, uFog: { value: 16 },
  uK: { value: 0.01 }, uJaw: { value: 0 }, uTail: { value: 0 }, uStalk: { value: 0 }, uFin: { value: 1 }, uTilt: { value: 0 }, uYaw: { value: 0 },
  uPos: { value: [0, 0, 0] }, uLight: { value: [0, 0, 0] }, uLure: { value: 1 }, uAmb: { value: 1 }, uA: { value: VIOLET }, uB: { value: LILAC }
};
const MAP = /* glsl */ `
  mat2 rot(float a) { return mat2(cos(a), sin(a), -sin(a), cos(a)); }`;
const program = new Program(gl, {
  vertex: /* glsl */ `#version 300 es
    in vec4 position; in vec4 aBody; in vec2 aImg;
    uniform mat4 viewMatrix, projectionMatrix; uniform vec3 cameraPosition;
    uniform float uTime, uDpr, uPx, uSp, uSize, uOrig, uK, uJaw, uTail, uStalk, uFin, uTilt, uYaw, uLure, uAmb;
    uniform vec3 uPos, uLight, uA, uB;
    out vec3 vC; out float vA; out float vD;
    ${GLSL_TONE}
    ${MAP}
    void main() {
      float r = position.w, s = aBody.x, L = aBody.w;
      vec2 ip = aImg; // the point in the drawing (px, y down)
      // the lower jaw (below the line from the hinge to the tip of the lower lip) turns down round the hinge
      float lip = ${HINGE[1].toFixed(1)} + (ip.x - ${HINGE[0].toFixed(1)}) * -.562;
      float wj = smoothstep(-4., 12., ip.y - lip) * smoothstep(395., 440., ip.x);
      ip = ${'vec2(' + HINGE[0].toFixed(1) + ', ' + HINGE[1].toFixed(1) + ')'} + rot(uJaw * wj) * (ip - vec2(${HINGE[0].toFixed(1)}, ${HINGE[1].toFixed(1)}));
      // the tail sways round its base
      float wt = smoothstep(215., 115., ip.x);
      ip = vec2(${TAILB[0].toFixed(1)}, ${TAILB[1].toFixed(1)}) + rot(uTail * wt) * (ip - vec2(${TAILB[0].toFixed(1)}, ${TAILB[1].toFixed(1)}));
      // the lure's stalk bobs round its base on the forehead
      float wsk = smoothstep(200., 160., ip.y) * smoothstep(250., 300., ip.x);
      ip = vec2(${STALK[0].toFixed(1)}, ${STALK[1].toFixed(1)}) + rot(uStalk * wsk) * (ip - vec2(${STALK[0].toFixed(1)}, ${STALK[1].toFixed(1)}));
      // the thin parts far from the middle (the fins) flutter; the tail waves
      float hn = clamp(abs(position.z) / ${(HMAX * 0.85).toFixed(1)}, 0., 1.);
      float wf = pow(1. - hn, 2.) * smoothstep(.42, .7, s) * smoothstep(420., 380., ip.x);
      float z = position.z + uFin * (wf * 24. * sin(uTime * 5. + s * 14. + ip.y * .03) + wt * 26. * sin(uTime * 2.4 - ip.x * .02));
      // into the world: tilted towards where it swims, turned round (yaw) when it swims to the left
      vec2 q = rot(uTilt) * (vec2(ip.x - ${C[0].toFixed(1)}, ${C[1].toFixed(1)} - ip.y) * uK);
      float zw = z * uK;
      vec3 p = uPos + vec3(q.x * cos(uYaw) + zw * sin(uYaw), q.y, -q.x * sin(uYaw) + zw * cos(uYaw));
      p += .01 * vec3(sin(uTime * 1.3 + r * 40.), sin(uTime * 1.1 + r * 60.), sin(uTime * .9 + r * 80.));
      vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z;
      gl_Position = projectionMatrix * mv;
      // the deep: the sea's own light fades with the page, the lure lights what is near it
      vec3 dl = p - uLight;
      float lit = uAmb + uLure * 1.6 * exp(-dot(dl, dl) / 5.5);
      vC = toneColor(L, uOrig, uA, uB) * (.75 + .5 * r) * lit;
      vA = toneAlpha(L, uOrig) * facingAlpha(sign(position.z), p, cameraPosition, vec3(sin(uYaw), 0., cos(uYaw))) * min(1., .15 + lit);
      gl_PointSize = clamp(1.5 * uSize * uSp * uK * uPx / max(vD, .2), 1., 8. * uDpr * max(uSize, .4));
    }`,
  fragment: FRAG, uniforms: U, transparent: true, depthTest: false, depthWrite: false
});
program.setBlendFunc(gl.ONE, gl.ONE);
drawing('/lab/das/das').then(d => {
  const { pos, body, img, spacing } = sample(d, { N: narrow ? 90000 : 160000, sc: 1, hmax: HMAX, thick: 0.85 });
  U.uSp.value = spacing;
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: pos }, aBody: { size: 4, data: body }, aImg: { size: 2, data: img } }), program, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
});

// ---------- the lure: a star of light (8 rays, the 4 upright ones long) with a soft halo ----------
const starPts = [];
for (let k = 0; k < 8; k++) {
  const a = (k * Math.PI) / 4, len = k % 2 ? 0.48 : 1;
  for (let i = 0; i < 70; i++) {
    const t = Math.random(), w = (1 - t) * 0.09 * (Math.random() - 0.5);
    starPts.push(Math.cos(a) * t * len - Math.sin(a) * w, Math.sin(a) * t * len + Math.cos(a) * w, 0, Math.random());
  }
}
for (let i = 0; i < 700; i++) { // the halo
  const a = Math.random() * Math.PI * 2, rr = Math.abs((Math.random() + Math.random() + Math.random() - 1.5)) * 1.1;
  starPts.push(Math.cos(a) * rr, Math.sin(a) * rr, (Math.random() - 0.5) * 0.4, 2 + Math.random());
}
const SU = { uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uPx: { value: 1 }, uLight: { value: [0, 0, 0] }, uR: { value: 1 }, uLure: { value: 1 }, uOrig: { value: 0 }, uB: { value: LILAC } };
const starProg = new Program(gl, {
  vertex: /* glsl */ `#version 300 es
    in vec4 position; uniform mat4 viewMatrix, projectionMatrix; uniform float uTime, uDpr, uPx, uR, uLure, uOrig; uniform vec3 uLight, uB;
    out vec3 vC; out float vA; out float vD;
    void main() {
      bool halo = position.w >= 2.;
      float a = uTime * .15;
      vec2 q = mat2(cos(a), sin(a), -sin(a), cos(a)) * position.xy;
      vec3 p = uLight + vec3(q * uR * (1. + .06 * sin(uTime * 2.1)), position.z * uR);
      vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z;
      gl_Position = projectionMatrix * mv;
      vec3 c = mix(mix(uB, vec3(1.), .55), vec3(1., .97, .9), uOrig);
      vC = c; vA = (halo ? .1 : .9) * uLure;
      gl_PointSize = (halo ? 3.2 : 1.8) * uDpr * uPx * .035 * uR / max(vD, .2) * (halo ? 1. : 1.);
    }`,
  fragment: FRAG, uniforms: { ...SU, uFog: { value: 30 } }, transparent: true, depthTest: false, depthWrite: false
});
starProg.setBlendFunc(gl.ONE, gl.ONE);
new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: new Float32Array(starPts) } }), program: starProg, mode: gl.POINTS, frustumCulled: false }).setParent(scene);

const dustProg = dust(st, { box: [32, 18, 14], center: [0, 0, -3], sink: 0.12 });
const sc = scrolling({ lag: 1.2 });
const pt = pointer();
const build = sections(() => S.angle);
const COL = panel(S, { ints: ['angle'], onInput: k => { if (k === 'angle') build(); } });

// the same mapping as the shader, for the points the page needs (the star, the mouth): drawing px → world
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const toWorld = (ix, iy, f) => {
  let [qx, qy] = rot((ix - C[0]) * f.K, (C[1] - iy) * f.K, f.tilt);
  return [f.x + qx * Math.cos(f.yaw), f.y + qy, -qx * Math.sin(f.yaw)];
};
const imgRot = (p, c, a) => { const [x, y] = rot(p[0] - c[0], p[1] - c[1], a); return [c[0] + x, c[1] + y]; }; // (the shader's rot, in drawing px)

let VW = H * (innerWidth / innerHeight);
addEventListener('resize', () => { VW = H * (innerWidth / innerHeight); });
const fish = { x: VW * 0.15, y: -1, yaw: 0, yawTo: 0, tilt: 0, K: 0.01, jaw: 0, snap: 0 };
let time = 0, last = performance.now(), lastScroll = scrollY, cool = 0;
const snap = () => {
  cool = 2.2;
  gsap.timeline().to(fish, { snap: 1, duration: 0.12, ease: 'power2.out' }).to(fish, { snap: 0, duration: 0.18, ease: 'power3.in' }).to(fish, { snap: 0.25, duration: 0.25 }).to(fish, { snap: 0, duration: 0.6, ease: 'power2.inOut' });
};
const tick = now => {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const go = reduce ? 0 : dt;
  time += go; cool -= go;
  const fw = Math.max(VW * 0.38, narrow ? 2.9 : 3.6) * S.scale; // the fish's width (world)
  fish.K = fw / DW;
  // where it wants to be: just beside the pointer, facing it (on a phone, or with no pointer, it wanders)
  const tx = pt.active ? ((pt.cx / innerWidth) * 2 - 1) * VW / 2 : Math.sin(time * 0.11) * VW * (narrow ? 0.12 : 0.28);
  const ty = pt.active ? -((pt.cy / innerHeight) * 2 - 1) * H / 2 : Math.sin(time * 0.083 + 1) * H * 0.22;
  if (tx > fish.x + 0.5) fish.yawTo = 0; else if (tx < fish.x - 0.5) fish.yawTo = Math.PI;
  const face = Math.cos(fish.yawTo);
  const wantX = tx - face * (MOUTH[0] - C[0] + 130) * fish.K, wantY = ty + (MOUTH[1] - C[1]) * fish.K;
  // the scroll carries it away with the page; it swims back lazily
  const dy = scrollY - lastScroll; lastScroll = scrollY;
  fish.y += (dy / innerHeight) * H * (reduce ? 0 : 1);
  fish.y = Math.max(wantY - H * 0.8, Math.min(wantY + H * 0.8, fish.y)); // carried just off the screen, no farther
  const k = Math.min(1, go * 0.45 * S.curious);
  fish.x += (wantX - fish.x) * k; fish.y += (wantY - fish.y) * k;
  fish.yaw += (fish.yawTo - fish.yaw) * Math.min(1, go * 1.6);
  fish.tilt += (Math.max(-0.3, Math.min(0.3, (wantY - fish.y) * 0.12)) * face - fish.tilt) * Math.min(1, go * 1.5);
  // its body
  const m = S.motion;
  const jaw = (0.06 + 0.05 * Math.sin(time * 1.3)) * m + fish.snap * 0.55;
  const stalk = Math.sin(time * 1.7) * 0.12 * m;
  const f = { x: fish.x, y: fish.y, yaw: fish.yaw, tilt: fish.tilt, K: fish.K };
  // the star at the end of the stalk, and the mouth (for the snap)
  const star = toWorld(...imgRot(STAR, STALK, stalk), f);
  const mouth = toWorld(...MOUTH, f);
  if (pt.active && cool <= 0 && Math.hypot(mouth[0] - tx, mouth[1] - ty) < fw * 0.12) snap();
  // the deep: darker the lower the page; the lure matters more the deeper it is
  const deep = smooth(0, 1, reduce ? 0.3 : sc.p);
  const amb = 0.8 - (0.8 - (1 - S.dark) * 0.8) * deep;
  const lure = S.light * (0.9 + 0.1 * Math.sin(time * 2.1) + 0.05 * Math.sin(time * 13.7)) * (0.55 + 0.6 * deep);
  U.uPos.value = [fish.x, fish.y, 0]; U.uYaw.value = fish.yaw; U.uTilt.value = fish.tilt; U.uK.value = fish.K;
  U.uJaw.value = jaw; U.uTail.value = Math.sin(time * 2.4) * 0.18 * m; U.uStalk.value = stalk; U.uFin.value = m;
  U.uLight.value = star; U.uLure.value = lure; U.uAmb.value = amb;
  U.uTime.value = time; U.uSize.value = S.size; U.uPx.value = st.px(); U.uDpr.value = renderer.dpr;
  U.uOrig.value += (COL.orig - U.uOrig.value) * 0.08;
  SU.uLight.value = star; SU.uR.value = 115 * fish.K; SU.uLure.value = Math.min(1.4, lure * 1.1); SU.uTime.value = time; SU.uPx.value = st.px(); SU.uDpr.value = renderer.dpr; SU.uOrig.value = U.uOrig.value;
  camera.position.set(pt.x * 1.2, -pt.y * 0.8, DIST); camera.lookAt([0, 0, 0]);
  const du = dustProg.uniforms;
  du.uTime.value = time; du.uSize.value = S.size; du.uOrig.value = U.uOrig.value; du.uLift.value = sc.p * 14;
  du.uLight.value = lure; du.uLamp.value = star;
  du.uA.value = VIOLET.map(c => c * amb * 1.2); du.uB.value = LILAC.map(c => c * amb * 1.2);
  renderer.render({ scene, camera });
};
requestAnimationFrame(tick);
