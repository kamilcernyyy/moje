/* Grafysta lab: two manta rays flying through the page.
   The pair (both rays from the user's drawing) flies a wide figure of eight over the whole screen, one behind the
   other. The scroll moves them along it: scroll down and they fly on, scroll up and they turn round and fly back; when
   the page is still they glide on slowly by themselves. Their wings beat in a wave running out to the tips (faster and
   deeper the faster they fly), they bank into every turn, the tail trails. Seen from above, as in the drawing. */
import { stage, drawing, sample, dust, scrolling, pointer, sections, panel, reduce, narrow, VIOLET, LILAC, GLSL_TONE, FRAG, Program, Mesh, Geometry, gsap } from './tvor.js';

const S = {
  loops: 1.5, // figure-eights per page of scroll
  glide: 1, // how fast they glide on their own
  flap: 1, // wing beat
  bank: 1, // banking into turns
  scale: 1, // size of the rays
  angle: 16, // sections turning (deg)
  size: 1 // particle size
};
const st = stage();
const { gl, scene, camera, renderer } = st;
const H = 10, DIST = H / 2 / Math.tan((st.fov * Math.PI) / 360); // the plane z = 0 fills the screen: 10 units high
camera.position.set(0, 0, DIST); camera.lookAt([0, 0, 0]);

// the two rays: their drawings, the middle of the body and which way the head points (drawing px, y down)
const RAYS = [
  { base: '/lab/manty/manta-a', w: 632, h: 380, hmax: 80.8, c: [247.2, 210], head: [172.8, 322.8], lag: 0, off: [0, 0, 0] },
  { base: '/lab/manty/manta-b', w: 479, h: 391, hmax: 115.6, c: [255, 180], head: [330, 36], lag: 0.75, off: [0.4, -0.5, -1.6] }
];

const vertex = /* glsl */ `#version 300 es
  in vec4 position; in vec4 aBody;
  uniform mat4 viewMatrix, projectionMatrix; uniform vec3 cameraPosition;
  uniform float uTime, uDpr, uPx, uSp, uSize, uOrig, uK, uLmax, uPhase, uFlap, uRoll, uHeading;
  uniform vec2 uC, uHd; uniform vec3 uPos, uA, uB;
  out vec3 vC; out float vA; out float vD;
  ${GLSL_TONE}
  void main() {
    float r = position.w, L = aBody.w;
    // in the ray's own frame (px): f forward along the body, l out along the wings
    vec2 q = position.xy - uC;
    vec2 side = vec2(uHd.y, -uHd.x);
    float f = dot(q, uHd), l = dot(q, side), z = position.z * .35;
    float wing = abs(l) / uLmax;
    // the wing beat: a wave running from the body out to the tips, the tips bending most
    float beat = sin(uPhase - wing * 1.7);
    z += uFlap * uLmax * .3 * pow(wing, 1.6) * beat;
    l *= 1. - .06 * uFlap * pow(wing, 2.) * (beat * .5 + .5);
    // the tail (behind the body, near its middle line) trails in a slow wave
    float tail = smoothstep(-.15, -.4, f / uLmax) * (1. - smoothstep(.06, .14, wing));
    l += tail * uLmax * .06 * sin(uPhase * .5 + f / uLmax * 6.);
    // banking into the turn: roll round the body's axis
    float c = cos(uRoll), s = sin(uRoll);
    float l2 = l * c - z * s, z2 = l * s + z * c;
    // into the world, heading the way it flies
    vec2 hd = vec2(cos(uHeading), sin(uHeading)), sd = vec2(hd.y, -hd.x);
    vec3 p = uPos + vec3((hd * f + sd * l2) * uK, z2 * uK);
    p += .012 * vec3(sin(uTime * 1.3 + r * 40.), sin(uTime * 1.1 + r * 60.), sin(uTime * .9 + r * 80.));
    vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z;
    gl_Position = projectionMatrix * mv;
    vec3 normal = vec3(-sd * s, c);
    vC = toneColor(L, uOrig, uA, uB) * (.75 + .5 * r);
    vA = toneAlpha(L, uOrig) * facingAlpha(sign(position.z), p, cameraPosition, normal);
    gl_PointSize = clamp(1.5 * uSize * uSp * uK * uPx / max(vD, .2), 1., 8. * uDpr * max(uSize, .4));
  }`;

const rays = RAYS.map(R => {
  const hd = [R.head[0] - R.c[0], -(R.head[1] - R.c[1])], n = Math.hypot(hd[0], hd[1]);
  const U = {
    uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uPx: { value: 1 }, uSp: { value: 1 }, uSize: { value: 1 }, uOrig: { value: 0 }, uFog: { value: 14 },
    uK: { value: 0.01 }, uLmax: { value: 300 }, uPhase: { value: 0 }, uFlap: { value: 1 }, uRoll: { value: 0 }, uHeading: { value: 0 },
    uC: { value: [R.c[0] - R.w / 2, R.h / 2 - R.c[1]] }, uHd: { value: [hd[0] / n, hd[1] / n] }, uPos: { value: [0, 0, 0] }, uA: { value: VIOLET }, uB: { value: LILAC }
  };
  const program = new Program(gl, { vertex, fragment: FRAG, uniforms: U, transparent: true, depthTest: false, depthWrite: false });
  program.setBlendFunc(gl.ONE, gl.ONE);
  drawing(R.base).then(d => {
    const { pos, body, spacing } = sample(d, { N: narrow ? 40000 : 80000, sc: 1, hmax: R.hmax, thick: 0.6 });
    // how far the wings reach out from the body's middle line
    const side = [U.uHd.value[1], -U.uHd.value[0]];
    let lmax = 1;
    for (let k = 0; k < pos.length; k += 4) lmax = Math.max(lmax, Math.abs((pos[k] - U.uC.value[0]) * side[0] + (pos[k + 1] - U.uC.value[1]) * side[1]));
    U.uLmax.value = lmax; U.uSp.value = spacing;
    new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: pos }, aBody: { size: 4, data: body } }), program, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
  });
  return { R, U, heading: null, turn: 0, phase: Math.random() * 6, prev: null };
});

const dustProg = dust(st, { box: [30, 16, 14], center: [0, 0, -3], sink: 0.08 });
const sc = scrolling({ lag: 1.6 });
const pt = pointer();
const build = sections(() => S.angle);
const COL = panel(S, { ints: ['angle'], onInput: k => { if (k === 'angle') build(); } });

// the figure of eight over the screen (a little deeper at its far loops)
let VW = H * (innerWidth / innerHeight);
addEventListener('resize', () => { VW = H * (innerWidth / innerHeight); });
const path = u => [Math.sin(u) * VW * (narrow ? 0.36 : 0.33), Math.sin(2 * u) * H * 0.27, -1.2 + Math.cos(u) * 1.4];
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

const travel = { u: 0 };
const toU = gsap.quickTo(travel, 'u', { duration: 1.6, ease: 'power2.out' });
let idle = 0, time = 0, last = performance.now(), lastU = 0;
const tick = now => {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const go = reduce ? 0 : dt;
  time += go;
  idle += go * 0.07 * S.glide;
  toU(sc.p * S.loops * Math.PI * 2 + idle);
  const du = (travel.u - lastU) / Math.max(dt, 1e-3); lastU = travel.u;
  const speed = Math.min(3, Math.abs(du) / 0.07); // 1 = gliding on its own
  const wing = Math.max(1, Math.min(2.6, 0.8 + speed * 0.4));
  const K = (Math.max(VW * 0.4, 3.8) / 632) * S.scale; // world units per drawing px
  for (const ray of rays) {
    const { R, U } = ray;
    const u = travel.u - R.lag;
    const a = path(u), b = path(u + 0.01);
    // heading: the way it flies (back along the path when the scroll goes back), turning smoothly
    const fwd = du >= -1e-4 ? 1 : -1;
    const want = Math.atan2((b[1] - a[1]) * fwd, (b[0] - a[0]) * fwd);
    if (ray.heading === null) ray.heading = want;
    const d = wrap(want - ray.heading);
    const turnNow = Math.max(-2.5, Math.min(2.5, d * 3));
    ray.heading = wrap(ray.heading + turnNow * Math.min(go, 0.05) + (reduce ? d : 0));
    ray.turn += (turnNow - ray.turn) * Math.min(1, go * 3);
    ray.phase += go * Math.PI * 2 * 0.55 * wing;
    U.uPos.value = [a[0] + R.off[0], a[1] + R.off[1], a[2] + R.off[2]];
    U.uHeading.value = ray.heading;
    U.uRoll.value = Math.max(-0.9, Math.min(0.9, -ray.turn * 0.45 * S.bank));
    U.uPhase.value = ray.phase; U.uFlap.value = S.flap * Math.min(1.6, wing * 0.8);
    U.uK.value = K; U.uTime.value = time; U.uSize.value = S.size; U.uPx.value = st.px(); U.uDpr.value = renderer.dpr;
    U.uOrig.value += (COL.orig - U.uOrig.value) * 0.08;
  }
  // the camera leans a little after the pointer
  camera.position.set(pt.x * 1.6, -pt.y * 1.1, DIST); camera.lookAt([0, 0, -1]);
  dustProg.uniforms.uTime.value = time; dustProg.uniforms.uSize.value = S.size; dustProg.uniforms.uOrig.value = rays[0].U.uOrig.value;
  dustProg.uniforms.uLift.value = sc.p * 12;
  renderer.render({ scene, camera });
};
requestAnimationFrame(tick);
