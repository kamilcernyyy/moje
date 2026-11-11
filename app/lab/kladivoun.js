/* Grafysta lab: the hammerhead swimming through the page, seen from above (as in the drawing).
   It swims the way the page goes: scroll down and it turns head-down and swims down through the content, scroll up
   and it turns round and swims up; the faster the scroll, the faster its tail beats. When the page is still it
   patrols in a slow, wide circle. Its whole body waves from the head to the tail (the tail most), and it bends into
   every turn, the hammer leading. */
import { stage, drawing, sample, dust, scrolling, pointer, sections, panel, reduce, narrow, VIOLET, LILAC, GLSL_TONE, FRAG, Program, Mesh, Geometry } from './tvor.js';

const S = {
  speed: 1, // swimming speed
  wave: 1, // body wave
  circle: 1, // size of the circle it patrols when the page is still
  scale: 1, // size of the shark
  angle: 16, // sections turning (deg)
  size: 1 // particle size
};
const st = stage();
const { gl, scene, camera, renderer } = st;
const H = 10, DIST = H / 2 / Math.tan((st.fov * Math.PI) / 360);
const DW = 592, DH = 935, HMAX = 101.7, HEAD = [390, 112.8]; // the drawing (px), the middle of the hammer

const U = {
  uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uPx: { value: 1 }, uSp: { value: 1 }, uSize: { value: 1 }, uOrig: { value: 0 }, uFog: { value: 16 },
  uK: { value: 0.01 }, uPhase: { value: 0 }, uWave: { value: 1 }, uBend: { value: 0 }, uHeading: { value: 0 }, uPos: { value: [0, 0, 0] },
  uHead: { value: [HEAD[0] - DW / 2, DH / 2 - HEAD[1]] }, uA: { value: VIOLET }, uB: { value: LILAC }
};
const program = new Program(gl, {
  vertex: /* glsl */ `#version 300 es
    in vec4 position; in vec4 aBody;
    uniform mat4 viewMatrix, projectionMatrix; uniform vec3 cameraPosition;
    uniform float uTime, uDpr, uPx, uSp, uSize, uOrig, uK, uPhase, uWave, uBend, uHeading; uniform vec2 uHead; uniform vec3 uPos, uA, uB;
    out vec3 vC; out float vA; out float vD;
    ${GLSL_TONE}
    void main() {
      float r = position.w, s = aBody.x, L = aBody.w;
      vec2 perp = vec2(-aBody.z, aBody.y);
      vec2 q = position.xy - uHead; // from the hammer, px, head pointing up (+y)
      // the swimming wave: from the head to the tail, growing towards the tail; the head swings a little the other way
      float sw = sin(uPhase - s * 7.);
      q += perp * uWave * 935. * (.075 * pow(s, 1.5) - .012 * (1. - s)) * sw;
      // bending into the turn: every part turned a little more than the one before it
      float a = uBend * s;
      q = mat2(cos(a), sin(a), -sin(a), cos(a)) * q;
      float z = position.z * .7 + uWave * 18. * pow(s, 2.) * cos(uPhase - s * 7.);
      // into the world: the head points the way it swims
      float h = uHeading - 1.5708;
      q = mat2(cos(h), sin(h), -sin(h), cos(h)) * q;
      vec3 p = uPos + vec3(q * uK, z * uK);
      p += .012 * vec3(sin(uTime * 1.3 + r * 40.), sin(uTime * 1.1 + r * 60.), sin(uTime * .9 + r * 80.));
      vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z;
      gl_Position = projectionMatrix * mv;
      vC = toneColor(L, uOrig, uA, uB) * (.75 + .5 * r);
      vA = toneAlpha(L, uOrig) * facingAlpha(sign(position.z), p, cameraPosition, vec3(0., 0., 1.));
      gl_PointSize = clamp(1.5 * uSize * uSp * uK * uPx / max(vD, .2), 1., 8. * uDpr * max(uSize, .4));
    }`,
  fragment: FRAG, uniforms: U, transparent: true, depthTest: false, depthWrite: false
});
program.setBlendFunc(gl.ONE, gl.ONE);
drawing('/lab/kladivoun/kladivoun').then(d => {
  const { pos, body, spacing } = sample(d, { N: narrow ? 90000 : 150000, sc: 1, hmax: HMAX, thick: 0.8 });
  U.uSp.value = spacing;
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: pos }, aBody: { size: 4, data: body } }), program, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
});

const dustProg = dust(st, { box: [30, 16, 14], center: [0, 0, -3], sink: 0.06 });
const sc = scrolling({ lag: 1.2 });
const pt = pointer();
const build = sections(() => S.angle);
const COL = panel(S, { ints: ['angle'], onInput: k => { if (k === 'angle') build(); } });

let VW = H * (innerWidth / innerHeight);
addEventListener('resize', () => { VW = H * (innerWidth / innerHeight); });
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// the shark: where the middle of its body is, which way it swims, how fast it turns
const sh = { x: 0, y: 0, th: -Math.PI / 2, turn: 0, phase: 0 };
let time = 0, last = performance.now();
const tick = now => {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const go = reduce ? 0 : dt;
  time += go;
  const len = H * 0.8 * S.scale * (narrow ? 0.7 : 1); // the shark's length (world units)
  const v0 = len * 0.12 * S.speed;
  let want, v;
  if (sc.moving || sc.v > 0.05) {
    // with the scroll: head the way the page goes, the body in the middle of the screen
    want = sc.dir >= 0 ? -Math.PI / 2 : Math.PI / 2;
    const d = wrap(want - sh.th);
    want = Math.max(-1.8, Math.min(1.8, d * 2.4));
    v = v0 * (1 + sc.v * 3);
    const ty = (sc.dir >= 0 ? -1 : 1) * len * 0.06;
    sh.x += (0 - sh.x) * Math.min(1, go * 0.8);
    sh.y += (ty - sh.y) * Math.min(1, go * 0.8);
  } else {
    // still page: a slow, wide circle round the middle of the screen
    const R = Math.min(VW, H) * 0.16 * S.circle + 0.3;
    v = v0;
    want = v / R;
    const cx = -sh.x, cy = -sh.y; // a gentle pull back to the middle keeps the circle on screen
    want += (Math.cos(sh.th) * cy - Math.sin(sh.th) * cx) * 0.05;
    sh.x += Math.cos(sh.th) * v * go * 0.6; sh.y += Math.sin(sh.th) * v * go * 0.6;
  }
  sh.turn += (want - sh.turn) * Math.min(1, go * 2.5);
  sh.th = wrap(sh.th + sh.turn * go);
  sh.phase += go * Math.PI * 2 * 0.75 * Math.pow(v / v0, 0.7) * Math.max(0.3, S.speed);
  // the hammer is half a body ahead of the middle
  U.uPos.value = [sh.x + Math.cos(sh.th) * len * 0.5, sh.y + Math.sin(sh.th) * len * 0.5, 0];
  U.uHeading.value = sh.th; U.uBend.value = -sh.turn * 0.28; U.uPhase.value = sh.phase; U.uWave.value = S.wave;
  U.uK.value = len / DH; U.uTime.value = time; U.uSize.value = S.size; U.uPx.value = st.px(); U.uDpr.value = renderer.dpr;
  U.uOrig.value += (COL.orig - U.uOrig.value) * 0.08;
  camera.position.set(pt.x * 1.4, -pt.y * 1, DIST); camera.lookAt([0, 0, 0]);
  dustProg.uniforms.uTime.value = time; dustProg.uniforms.uSize.value = S.size; dustProg.uniforms.uOrig.value = U.uOrig.value;
  dustProg.uniforms.uLift.value = sc.p * 14;
  renderer.render({ scene, camera });
};
requestAnimationFrame(tick);
