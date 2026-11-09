/* Grafysta headpage particles: the WebGL part. Runs in a Web Worker on an OffscreenCanvas (the page's main thread
   stays free); the same file works on the main thread as a fallback (self.GrafystaParticles). The page (particles.js)
   samples the headline, drives the gathering with GSAP and sends pointer, headline position and state here. */
import { Renderer, Camera, Transform, Program, Mesh, Geometry } from 'ogl';

const VIOLET = [82 / 255, 39 / 255, 1], LILAC = [177 / 255, 158 / 255, 239 / 255];
const raf = typeof self.requestAnimationFrame === 'function' ? cb => self.requestAnimationFrame(cb) : cb => setTimeout(() => cb(performance.now()), 16);
const caf = typeof self.cancelAnimationFrame === 'function' ? id => self.cancelAnimationFrame(id) : id => clearTimeout(id);

function createScene(canvas, o) {
  const renderer = new Renderer({ canvas, dpr: Math.min(o.dpr || 1, 2), alpha: true, premultipliedAlpha: true, antialias: false, depth: false, powerPreference: 'high-performance' });
  const gl = renderer.gl;
  if (!renderer.isWebgl2) return null;
  gl.clearColor(0, 0, 0, 0);
  const camera = new Camera(gl, { fov: 40, near: 1, far: 20000 });
  const scene = new Transform();
  let W = o.W, H = o.H;
  const place = () => {
    renderer.setSize(W, H);
    camera.perspective({ aspect: W / H });
    // one world unit = one CSS pixel on the z = 0 plane (where the headline sits)
    camera.position.set(0, 0, (H / 2) / Math.tan((40 * Math.PI) / 360));
    camera.lookAt([0, 0, 0]);
  };
  place();
  // ---------- 1) the field along the bottom ----------
  const FW = o.narrow ? 120 : 200, FH = o.narrow ? 70 : 100, fdata = new Float32Array(FW * FH * 3);
  for (let j = 0, k = 0; j < FH; j++) for (let i = 0; i < FW; i++, k += 3) {
    fdata[k] = i / (FW - 1) - 0.5 + (Math.random() - 0.5) * 0.002;
    fdata[k + 1] = Math.random();
    fdata[k + 2] = j / (FH - 1) + (Math.random() - 0.5) * 0.002;
  }
  const FIELD = `
    uniform vec2 uView; uniform float uTime;
    vec3 fieldPos(vec3 a){
      // u across, v into the depth; the field lies below the headline and runs off into the dark
      vec3 p = vec3(a.x * uView.x * 2.6, -uView.y * .52, uView.y * .35 - a.z * uView.y * 2.6);
      float t = uTime * .35, s = uView.y * .0026;
      p.y += (sin(p.x * s * .9 + t) * .05 + sin(p.z * s * 1.3 - t * 1.3) * .04 + sin((p.x + p.z) * s * 1.9 + t * .7) * .018) * uView.y;
      return p;
    }`;
  const fieldProg = new Program(gl, {
    vertex: `attribute vec3 position; uniform mat4 viewMatrix, projectionMatrix; uniform float uDpr; uniform vec3 uHit; uniform float uRipple;
      varying float vH, vD; ${FIELD}
      void main(){
        vec3 p = fieldPos(position);
        float d = distance(p.xz, uHit.xz) / uView.y;
        p.y += uRipple * uView.y * .07 * exp(-d * d * 30.) * (.6 + .4 * sin(d * 40. - uTime * 3.));
        vH = (p.y / uView.y + .52) * 8.;
        vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = 3.4 * uDpr * (uView.y * 1.3 / max(vD, 1.));
      }`,
    fragment: `precision highp float; varying float vH, vD; uniform vec3 uA, uB; uniform vec2 uView; uniform float uFade;
      void main(){
        vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
        vec3 col = mix(uA, uB, clamp(vH * .5 + .45, 0., 1.)) * (.55 + .8 * clamp(vH + .5, 0., 1.4));
        float fog = exp(-max(vD / uView.y - 1.2, 0.) * .8);
        gl_FragColor = vec4(col * smoothstep(.25, 0., r) * fog * 1.7 * uFade, 1.);
      }`,
    uniforms: { uView: { value: [W, H] }, uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uHit: { value: [0, 0, -1e5] }, uRipple: { value: 0 }, uA: { value: VIOLET }, uB: { value: LILAC }, uFade: { value: 0 } },
    transparent: true, depthTest: false, depthWrite: false
  });
  fieldProg.setBlendFunc(gl.ONE, gl.ONE);
  new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 3, data: fdata } }), program: fieldProg, mode: gl.POINTS, frustumCulled: false }).setParent(scene);


  // ---------- 2) the headline: points that rise out of the field ----------
  const N = o.N, from = new Float32Array(N * 3), rnd = new Float32Array(N * 4);
  for (let k = 0; k < N; k++) {
    from[k * 3] = Math.random() - 0.5; from[k * 3 + 1] = Math.random(); from[k * 3 + 2] = Math.random() * 0.7;
    for (let q = 0; q < 4; q++) rnd[k * 4 + q] = Math.random();
  }
  const textProg = new Program(gl, {
    vertex: `attribute vec2 aT; attribute vec3 aFrom; attribute vec4 aR;
      uniform mat4 viewMatrix, projectionMatrix; uniform float uDpr, uP; uniform vec2 uOrigin;
      uniform vec3 uRo, uRd; uniform float uPush;
      varying float vA, vD, vM;
      ${FIELD}
      void main(){
        // where it waits: a point of the field; where it goes: its spot in the headline (CSS px → world)
        vec3 a = fieldPos(aFrom);
        vec3 b = vec3(uOrigin.x + aT.x - uView.x * .5, uView.y * .5 - (uOrigin.y + aT.y), 0.);
        float m = clamp(uP * 1.7 - aR.x * .7, 0., 1.);
        float e = 1. - pow(1. - m, 3.);
        vec3 p = mix(a, b, e);
        // a lifting arc on the way, a touch of swirl
        p.y += sin(3.14159 * e) * uView.y * (.12 + .18 * aR.y);
        p.x += sin(3.14159 * e) * (aR.z - .5) * uView.x * .25;
        p.z += sin(3.14159 * e) * (aR.w - .5) * uView.y * .6;
        // breathing once in place
        p += vec3(sin(uTime * 1.3 + aR.x * 6.28), sin(uTime * 1.1 + aR.y * 6.28), 0.) * .7 * e;
        // the pointer blows the letters apart (distance to the pointer ray)
        vec3 rel = p - uRo; vec3 off = rel - uRd * dot(rel, uRd); float d = length(off);
        p += normalize(off + 1e-4) * uPush * exp(-d * d / 2400.) * (.6 + .7 * aR.y);
        vM = e; vA = .55 + .45 * aR.z;
        vec4 mv = viewMatrix * vec4(p, 1.); vD = -mv.z;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = mix(2.2, 2.0, e) * uDpr * (uView.y * 1.3 / max(vD, 1.));
      }`,
    fragment: `precision highp float; varying float vA, vD, vM; uniform vec3 uA, uB; uniform float uFade;
      void main(){
        vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard;
        // violet while flying, a bright lilac-white once in the letters
        vec3 col = mix(mix(uA, uB, vA) * .9, mix(uB, vec3(1.), .55) * (.75 + .5 * vA), vM);
        gl_FragColor = vec4(col * smoothstep(.25, 0., r) * mix(.8, 1., vM) * uFade, 1.);
      }`,
    uniforms: { uView: { value: [W, H] }, uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uP: { value: 0 }, uOrigin: { value: [o.x || 0, o.y || 0] },
      uRo: { value: [0, 0, 1] }, uRd: { value: [0, 0, -1] }, uPush: { value: 0 }, uA: { value: VIOLET }, uB: { value: LILAC }, uFade: { value: 0 } },
    transparent: true, depthTest: false, depthWrite: false
  });
  textProg.setBlendFunc(gl.ONE, gl.ONE);
  const textGeo = new Geometry(gl, { aT: { size: 2, data: o.tgt }, aFrom: { size: 3, data: from }, aR: { size: 4, data: rnd } });
  new Mesh(gl, { geometry: textGeo, program: textProg, mode: gl.POINTS, frustumCulled: false }).setParent(scene);

  // ---------- state from the page ----------
  const S = { p: 0, fade: 0, push: 0, ripple: 0, px: -1e4, py: -1e4, x: o.x || 0, y: o.y || 0, vis: 1 };
  const ro = [0, 0, 0], rd = [0, 0, -1];
  let id = 0, time = 0, last = performance.now(), visible = true;
  const tick = now => {
    id = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    time += dt * (o.reduce ? 0.2 : 1);
    const tu = textProg.uniforms, fu = fieldProg.uniforms;
    tu.uOrigin.value = [S.x, S.y];
    tu.uTime.value = fu.uTime.value = time;
    tu.uP.value = S.p;
    tu.uFade.value = S.fade * S.vis;
    fu.uFade.value = S.fade;
    // pointer ray from the camera through the cursor
    const tn = Math.tan((40 * Math.PI) / 360);
    const nx = (S.px / W) * 2 - 1, ny = -((S.py / H) * 2 - 1);
    const cz = camera.position.z;
    ro[2] = cz;
    const dx = nx * tn * (W / H), dy = ny * tn, l = Math.hypot(dx, dy, 1);
    rd[0] = dx / l; rd[1] = dy / l; rd[2] = -1 / l;
    tu.uRo.value = ro; tu.uRd.value = rd; tu.uPush.value = S.push;
    // where the pointer ray meets the field plane (y = -0.52 H)
    const fy = -H * 0.52;
    if (rd[1] < -0.01) { const k = fy / rd[1]; fu.uHit.value = [rd[0] * k, fy, cz + rd[2] * k]; } else fu.uHit.value = [0, 0, -1e5];
    fu.uRipple.value = S.ripple;
    renderer.render({ scene, camera });
    if (visible) id = raf(tick);
  };
  const wake = () => { if (!id && visible) { last = performance.now(); id = raf(tick); } };
  wake();
  return {
    set(v) { Object.assign(S, v); },
    resize(v) {
      W = v.W; H = v.H; renderer.dpr = Math.min(v.dpr || 1, 2); place();
      textProg.uniforms.uView.value = fieldProg.uniforms.uView.value = [W, H];
      textProg.uniforms.uDpr.value = fieldProg.uniforms.uDpr.value = renderer.dpr;
      if (v.tgt) { textGeo.attributes.aT.data = v.tgt; textGeo.attributes.aT.needsUpdate = true; }
    },
    visible(on) { visible = on; if (on) wake(); else if (id) { caf(id); id = 0; } }
  };
}

const inWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
if (inWorker) {
  let s = null;
  self.onmessage = e => {
    const d = e.data;
    if (d.type === 'init') {
      try { s = createScene(d.canvas, d); } catch (err) { s = null; }
      self.postMessage({ type: s ? 'ready' : 'fail' });
    } else if (s && typeof s[d.type] === 'function') s[d.type](d.v);
  };
} else self.GrafystaParticles = createScene;
