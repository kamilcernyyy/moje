/* Grafysta lab: the jellyfish down the whole page.
   The bell pulses: it squeezes quickly (the rim draws in and up), then slowly opens again, and every squeeze lifts the
   jellyfish a little. Everything below the bell trails behind it like a rope in water: the bell's movement is kept for
   a few seconds, and every point of the arms and tentacles takes the bell's place from a moment ago, the longer ago
   the farther down it is (so a swing of the bell runs down the tentacles). The bell drifts slowly towards the pointer;
   scrolling pushes it down the page and it pulses harder to swim back. The frilled oral arms ripple slowly, the thin
   tentacles curl, all of it spread into depth. The camera travels down it as the page scrolls, swaying round it. */
import { stage, drawing, sample, dust, scrolling, pointer, sections, panel, smooth, reduce, narrow, VIOLET, LILAC, GLSL_TONE, FRAG, Program, Mesh, Geometry } from './tvor.js';

const S = {
  pulse: 1, // how hard the bell pulses
  rate: 1, // pulses per … (speed)
  trail: 1, // how long the tentacles trail behind (s)
  follow: 1, // how much it drifts after the pointer
  push: 1, // how much scrolling pushes it
  spread: 1, // tentacles spread into depth
  orbit: 80, // how far the camera swings round it over the page (deg)
  angle: 16, // sections turning (deg)
  size: 1 // particle size
};
const st = stage();
const { gl, scene, camera, renderer } = st;
const W = 420, H = 1288, SC = 26 / H, HMAX = 140.9; // the drawing: 26 units high
const BELL_RIM = 0.2; // s at the bell's rim
const HN = 90, HDT = 1 / 30; // the bell's last 3 s, every 1/30 s
const hist = new Array(HN * 2).fill(0); // (a plain array: that is how OGL sets a uniform array)

const U = {
  uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uPx: { value: 1 }, uSp: { value: 0.03 }, uSize: { value: S.size }, uOrig: { value: 0 }, uFog: { value: 14 },
  uPulse: { value: 0 }, uSpread: { value: 1 }, uTrail: { value: 1 }, uHist: { value: hist }, uHdt: { value: HDT }, uA: { value: VIOLET }, uB: { value: LILAC }
};
const program = new Program(gl, {
  vertex: /* glsl */ `#version 300 es
    in vec4 position; in vec4 aBody;
    uniform mat4 viewMatrix, projectionMatrix; uniform vec3 cameraPosition;
    uniform float uTime, uDpr, uPx, uSp, uSize, uOrig, uPulse, uSpread, uTrail, uHdt; uniform vec2 uHist[${HN}]; uniform vec3 uA, uB;
    out vec3 vC; out float vA; out float vD;
    ${GLSL_TONE}
    vec2 past(float t) { // where the bell was t seconds ago
      float i = clamp(t / uHdt, 0., ${HN - 1}.); int a = int(floor(i)); int b = min(a + 1, ${HN - 1});
      return mix(uHist[a], uHist[b], fract(i));
    }
    void main() {
      vec3 p = position.xyz; float r = position.w, s = aBody.x, L = aBody.w;
      vec2 perp = vec2(-aBody.z, aBody.y);
      float bell = 1. - smoothstep(${BELL_RIM - 0.03}, ${BELL_RIM + 0.03}, s);
      float below = 1. - bell, sn = clamp((s - ${BELL_RIM}) / ${1 - BELL_RIM}, 0., 1.);
      // the bell squeezes: the rim draws in (more than the top) and lifts, the margin ripples
      float rim = smoothstep(0., ${BELL_RIM}, s) * bell;
      p.xz *= 1. - .17 * uPulse * (.35 + .65 * rim);
      p.y += .45 * uPulse * rim + .05 * sin(p.x * 7. + uTime * 3.) * rim;
      // below the bell: the oral arms ripple slowly, the thin tentacles curl, all of it spreads into depth
      float wave = sin(uTime * 1.2 - s * 16. + p.x * 1.5);
      p.xy += perp * (.12 + .35 * pow(sn, 1.2)) * wave * below;
      p.z += (.2 + .5 * sn) * cos(uTime * 1.05 - s * 14. + p.x) * below;
      p.z += uSpread * below * sn * 4.5 * sin(p.x * 1.4 + .4);
      // the rope: the farther down, the older the bell's place it follows
      p.xy += past(sn * 2.6 * uTrail * below);
      p += .012 * vec3(sin(uTime * 1.3 + r * 40.), sin(uTime * 1.1 + r * 60.), sin(uTime * .9 + r * 80.));
      vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z;
      gl_Position = projectionMatrix * mv;
      vC = toneColor(L, uOrig, uA, uB) * (.75 + .5 * r);
      // a jellyfish is see-through: a little fainter, the bell a little brighter when it squeezes
      vA = toneAlpha(L, uOrig) * .8 * facingAlpha(sign(position.z), p, cameraPosition, vec3(0., 0., 1.)) * (1. + .3 * uPulse * bell);
      gl_PointSize = clamp(1.5 * uSize * uSp * uPx / max(vD, .2), 1., 8. * uDpr * max(uSize, .4));
    }`,
  fragment: FRAG, uniforms: U, transparent: true, depthTest: false, depthWrite: false
});
program.setBlendFunc(gl.ONE, gl.ONE);

const dustProg = dust(st, { box: [26, 40, 26], center: [0, 0, 0], sink: 0.05 });
drawing('/lab/meduza/meduza').then(d => {
  const { pos, body, spacing } = sample(d, { N: narrow ? 90000 : 170000, sc: SC, hmax: HMAX, thick: 0.75 });
  U.uSp.value = spacing;
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 4, data: pos }, aBody: { size: 4, data: body } }), program, mode: gl.POINTS, frustumCulled: false }).setParent(scene);
});

const sc = scrolling({ lag: 1.2 });
const pt = pointer();
const build = sections(() => S.angle);
const COL = panel(S, { ints: ['orbit', 'angle'], onInput: k => { if (k === 'angle') build(); } });

// the bell's own movement: drifting after the pointer, lifted by every pulse, pushed down by the scroll
const bellPos = { x: 0, y: 0, vy: 0 };
let time = 0, last = performance.now(), cycle = 0, acc = 0, lastScroll = scrollY;
const tick = now => {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const go = reduce ? 0 : dt;
  time += go;
  // the pulse: a quick squeeze, a slow release; scrolling makes it swim harder
  cycle += go * (0.38 * S.rate) * (1 + sc.v * 0.8);
  const ph = cycle % 1;
  const squeeze = ph < 0.3 ? Math.sin((ph / 0.3) * Math.PI * 0.5) : Math.cos(((ph - 0.3) / 0.7) * Math.PI * 0.5) ** 2;
  const pulse = squeeze * S.pulse * (1 + sc.v * 0.5);
  // the bell lifts while squeezing, sinks back slowly; the scroll pushes it down (the page carries it)
  const dy = scrollY - lastScroll; lastScroll = scrollY;
  bellPos.vy += (ph < 0.3 ? 1.4 : -0.35) * S.pulse * go - (dy / innerHeight) * 9 * S.push * (reduce ? 0 : 1);
  bellPos.vy *= Math.exp(-go * 2.2);
  bellPos.y += bellPos.vy * go;
  bellPos.y += (0 - bellPos.y) * Math.min(1, go * 0.6); // and drifts back to its place
  const tx = (pt.active ? pt.x * 3.2 : Math.sin(time * 0.21) * 1.2) * S.follow;
  bellPos.x += (tx - bellPos.x) * Math.min(1, go * 0.5);
  // keep the last 3 s of the bell's place (newest first)
  acc += go;
  while (acc >= HDT) { acc -= HDT; hist.copyWithin(2, 0, HN * 2 - 2); hist[0] = bellPos.x; hist[1] = bellPos.y; }
  if (!go) { hist[0] = bellPos.x; hist[1] = bellPos.y; }
  // camera: from the bell down to the ends of the tentacles, swaying round it
  const p = reduce ? 0.15 : sc.p;
  const yaw = ((S.orbit * Math.PI) / 180) * 0.5 * Math.sin(p * Math.PI * 1.5) + pt.x * 0.18;
  const cy = 9.6 - 20 * smooth(0, 1, p);
  const r = narrow ? 16 : 11;
  camera.position.set(Math.sin(yaw) * r, cy + 1 - pt.y * 0.6, Math.cos(yaw) * r);
  camera.lookAt([0, cy, 0]);
  U.uTime.value = time; U.uPulse.value = pulse; U.uSpread.value = S.spread; U.uTrail.value = S.trail; U.uSize.value = S.size;
  U.uPx.value = st.px(); U.uDpr.value = renderer.dpr;
  U.uOrig.value += (COL.orig - U.uOrig.value) * 0.08;
  dustProg.uniforms.uTime.value = time; dustProg.uniforms.uSize.value = S.size; dustProg.uniforms.uOrig.value = U.uOrig.value; dustProg.uniforms.uCY.value = cy;
  renderer.render({ scene, camera });
};
requestAnimationFrame(tick);
