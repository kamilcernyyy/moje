import { forwardRef, useEffect, useImperativeHandle, useRef, useSyncExternalStore } from 'react';
import {
  Color,
  CustomBlending,
  DataTexture,
  CanvasTexture,
  Float32BufferAttribute,
  FloatType,
  GLSL3,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  BufferGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NearestFilter,
  NoColorSpace,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PerspectiveCamera,
  RedFormat,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer
} from 'three';
import './WaveLettering.css';

// Wave Lettering (React Bits Pro, wave-lettering-tw): a sea of text lines rolling in soft swells, in and out of focus.
// Same engine, shaders and defaults as the original; the Tailwind classes are written out in WaveLettering.css.

const STEP = 1 / 240;
const subscribeReduced = cb => {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const getReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

let probe = null;
const parseColor = (value, fallback) => {
  if (!probe) probe = document.createElement('canvas').getContext('2d');
  if (!probe) return fallback;
  probe.fillStyle = '#010203';
  probe.fillStyle = value;
  const out = String(probe.fillStyle);
  if (out === '#010203' && value.trim().toLowerCase() !== '#010203') return fallback;
  if (out.startsWith('#')) {
    const h = out.slice(1);
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  const n = out.match(/[\d.]+/g);
  return !n || n.length < 3 ? fallback : [Number(n[0]) / 255, Number(n[1]) / 255, Number(n[2]) / 255];
};
const toLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toOklab = ([r, g, b]) => {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ];
};

const COMMON = `
uniform float uTime;
uniform float uAmp;
uniform float uK;
uniform float uSharp;
uniform vec2 uDir;
uniform float uEnvelope;
uniform float uHalf;
uniform sampler2D uStrings;
uniform float uRowZ[64];
uniform float uRowHalf[64];

float crest(float p) {
  float s = 0.5 + 0.5 * sin(p);
  return pow(s, uSharp) * 2.0 - 1.0;
}

float swellAt(vec2 q) {
  vec2 d2 = vec2(uDir.x * 0.8 - uDir.y * 0.6, uDir.x * 0.6 + uDir.y * 0.8);
  vec2 d3 = vec2(uDir.x * 0.9 + uDir.y * 0.44, -uDir.x * 0.44 + uDir.y * 0.9);
  vec2 d4 = vec2(uDir.y, -uDir.x);
  float w = sqrt(uK * 9.8) * 0.42;
  float t = uTime;
  float h = crest(dot(q, uDir) * uK - t * w) * 0.56;
  h += crest(dot(q, d2) * uK * 1.71 + 1.3 - t * w * 1.31) * 0.27;
  h += sin(dot(q, d3) * uK * 2.93 + 2.1 - t * w * 1.71) * 0.13;
  float group = 0.7 + 0.3 * sin(dot(q, d4) * uK * 0.37 + t * 0.21) * sin(dot(q, uDir) * uK * 0.19 - t * 0.13 + 1.7);
  float env = mix(1.0, 0.16 + 1.3 * exp(-pow(q.x / (uHalf * 0.6), 2.0)), uEnvelope);
  return uAmp * h * group * env;
}

float stringAt(float x, int row) {
  float u = clamp((x / uRowHalf[row] * 0.5 + 0.5) * 159.0, 0.0, 159.0);
  float i = floor(u);
  float a = texelFetch(uStrings, ivec2(int(i), row), 0).r;
  float b = texelFetch(uStrings, ivec2(int(min(i + 1.0, 159.0)), row), 0).r;
  return mix(a, b, u - i);
}

float lineAt(float x, float z, int row) {
  return swellAt(vec2(x, z)) + stringAt(x, row);
}
`;

const WATER_VERT = `
precision highp float;
${COMMON}
in float aRow;
in float aX;
in float aBottom;

void main() {
  int row = int(aRow);
  float z = uRowZ[row];
  float h = lineAt(aX, z, row);
  vec3 p = vec3(aX, aBottom > 0.5 ? h - 60.0 : h, z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const WATER_FRAG = `
precision highp float;
uniform vec3 uBackground;
out vec4 fragColor;

void main() {
  fragColor = vec4(uBackground, 1.0);
}
`;

const GLYPH_VERT = `
precision highp float;
${COMMON}
in float aRow;
in float aX;
in vec4 aRect;
in float aWidth;
uniform float uRowLength[64];
uniform float uRowShift[64];
uniform float uRowCount;
uniform float uGlyph;
uniform float uLean;
uniform float uGap;
uniform float uFocus;
uniform float uDof;
uniform float uRange;
uniform float uPad;
out vec2 vUv;
out float vLift;
out float vNear;
out float vRing;
out float vBlur;

void main() {
  int row = int(aRow);
  float z = uRowZ[row];
  float span = uRowLength[row];
  float x = mod(aX + uRowShift[row] + span * 0.5, span) - span * 0.5;
  float swell = swellAt(vec2(x, z));
  float ring = stringAt(x, row);
  float h = swell + ring;
  float e = uGlyph * 0.45;
  float slope = (lineAt(x + e, z, row) - lineAt(x - e, z, row)) / (2.0 * e);
  vec4 view = modelViewMatrix * vec4(x, h, z, 1.0);
  vec2 corner = position.xy;
  vec2 local = vec2(corner.x * aWidth, mix(-0.32 - uPad, 0.98 + uPad, corner.y + 0.5) * uGlyph);
  float angle = atan(slope) * uLean;
  float c = cos(angle);
  float s = sin(angle);
  view.xy += vec2(c * local.x - s * local.y, s * local.x + c * local.y);
  view.z += uGlyph * 0.02;
  gl_Position = projectionMatrix * view;
  vUv = vec2(aRect.x + (corner.x + 0.5) * aRect.z, aRect.y + (0.5 - corner.y) * aRect.w);
  vLift = clamp(swell / max(uAmp, 1e-4) * 0.5 + 0.5, 0.0, 1.0);
  vNear = 1.0 - aRow / max(uRowCount - 1.0, 1.0);
  vRing = clamp(abs(ring) / max(uGap, 1e-4), 0.0, 1.0);
  float off = abs((1.0 - vNear) - uFocus);
  vBlur = uDof * smoothstep(uRange * 0.5, uRange * 0.5 + 0.42, off);
}
`;

const GLYPH_FRAG = `
precision highp float;
uniform sampler2D uAtlas;
uniform vec3 uLabHigh;
uniform vec3 uLabLow;
uniform float uInk;
uniform float uFog;
uniform vec2 uAtlasSize;
in vec2 vUv;
in float vLift;
in float vNear;
in float vRing;
in float vBlur;
out vec4 fragColor;

vec3 labToLinear(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return max(vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  ), 0.0);
}

vec3 encode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void main() {
  float radius = vBlur * 26.0;
  float coverage;
  if (radius < 0.6) {
    coverage = texture(uAtlas, vUv).r;
  } else {
    float lod = log2(max(radius * 0.55, 1.0));
    vec2 step_ = radius * 0.62 / uAtlasSize;
    coverage = textureLod(uAtlas, vUv, lod).r * 0.28;
    coverage += textureLod(uAtlas, vUv + vec2(step_.x, 0.0), lod).r * 0.12;
    coverage += textureLod(uAtlas, vUv - vec2(step_.x, 0.0), lod).r * 0.12;
    coverage += textureLod(uAtlas, vUv + vec2(0.0, step_.y), lod).r * 0.12;
    coverage += textureLod(uAtlas, vUv - vec2(0.0, step_.y), lod).r * 0.12;
    coverage += textureLod(uAtlas, vUv + step_ * 0.7071, lod).r * 0.06;
    coverage += textureLod(uAtlas, vUv - step_ * 0.7071, lod).r * 0.06;
    coverage += textureLod(uAtlas, vUv + vec2(step_.x, -step_.y) * 0.7071, lod).r * 0.06;
    coverage += textureLod(uAtlas, vUv + vec2(-step_.x, step_.y) * 0.7071, lod).r * 0.06;
    coverage *= 1.0 + vBlur * 0.35;
  }
  if (coverage < 0.004) discard;
  float ring = smoothstep(0.02, 0.6, vRing);
  float t = clamp(0.2 + 0.5 * smoothstep(0.25, 0.95, vLift) + 0.42 * vNear * vNear, 0.0, 1.0);
  t = max(t, 0.55 + 0.45 * ring);
  vec3 lab = mix(uLabLow, uLabHigh, t);
  if (uInk < 0.5) lab = mix(lab, vec3(min(uLabHigh.x * 1.04 + 0.04, 0.99), uLabHigh.yz * 0.25), smoothstep(0.84, 1.0, t) * 0.55);
  vec3 color = encode(labToLinear(lab));
  float fog = exp(-(1.0 - vNear) * uFog * 2.4);
  float strength = (0.34 + 0.66 * smoothstep(0.0, 0.85, t)) * mix(fog, 1.0, ring * 0.6) * (1.0 - vBlur * 0.3);
  float alpha = coverage * clamp(strength, 0.0, 1.0);
  fragColor = vec4(color * alpha, alpha);
}
`;

function createEngine(host, propsRef) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.pointerEvents = 'none';
  host.prepend(canvas);

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: false, antialias: true, powerPreference: 'high-performance' });
  } catch {
    canvas.remove();
    return null;
  }
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    canvas.remove();
    return null;
  }

  const camera = new PerspectiveCamera(30, 1, 0.1, 400);
  const scene = new Scene();
  const rowZ = new Float32Array(64);
  const rowHalf = new Float32Array(64).fill(1);
  const rowLength = new Float32Array(64).fill(1);
  const rowShift = new Float32Array(64);
  const rowOffset = new Float64Array(64);
  const strings = new Float32Array(10240);
  const stringVel = new Float32Array(10240);
  const stringTex = new DataTexture(strings, 160, 64, RedFormat, FloatType);
  stringTex.minFilter = NearestFilter;
  stringTex.magFilter = NearestFilter;
  stringTex.needsUpdate = true;

  const shared = {
    uTime: { value: 0 },
    uAmp: { value: 0.3 },
    uK: { value: 2 },
    uSharp: { value: 1.6 },
    uDir: { value: new Vector2(0, -1) },
    uEnvelope: { value: 0 },
    uHalf: { value: 4 },
    uStrings: { value: stringTex },
    uRowZ: { value: rowZ },
    uRowHalf: { value: rowHalf }
  };
  const waterMat = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms: { ...shared, uBackground: { value: new Vector3() } },
    depthTest: true,
    depthWrite: true
  });
  const glyphMat = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: GLYPH_VERT,
    fragmentShader: GLYPH_FRAG,
    uniforms: {
      ...shared,
      uRowLength: { value: rowLength },
      uRowShift: { value: rowShift },
      uRowCount: { value: 2 },
      uGlyph: { value: 0.1 },
      uLean: { value: 0.6 },
      uGap: { value: 0.3 },
      uFocus: { value: 0.3 },
      uDof: { value: 0.6 },
      uRange: { value: 0.12 },
      uPad: { value: 0.3888888888888889 },
      uAtlasSize: { value: new Vector2(1, 1) },
      uAtlas: { value: null },
      uLabHigh: { value: new Vector3() },
      uLabLow: { value: new Vector3() },
      uInk: { value: 0 },
      uFog: { value: 0.5 }
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    premultipliedAlpha: true,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor
  });
  let waterGeo = new BufferGeometry();
  let glyphGeo = new InstancedBufferGeometry();
  const water = new Mesh(waterGeo, waterMat);
  const glyphs = new Mesh(glyphGeo, glyphMat);
  water.frustumCulled = false;
  glyphs.frustumCulled = false;
  water.renderOrder = 0;
  glyphs.renderOrder = 1;
  scene.add(water);
  scene.add(glyphs);

  let atlas = null;
  let atlasKey = '';
  let layoutKey = '';
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let rowCount = 2;
  let glyph = 0.1;
  let half = 4;
  let time = 0;
  let simAcc = 0;
  let raf = 0;
  let last = 0;
  let frameNo = 0;
  let sized = false;
  let visible = true;
  let destroyed = false;
  const pointer = { x: 0, y: 0, inside: false };
  const focus = { value: clamp(propsRef.current.focusDepth, 0, 1), velocity: 0 };
  const pending = [];
  const plucks = [];
  const tmp = new Vector3();
  const view = { k: 0.3, aspect: 1, depthNear: 8 };

  const depthOf = z => {
    const tilt = (clamp(propsRef.current.tilt, 4, 85) * Math.PI) / 180;
    return camera.position.y * Math.sin(tilt) + (camera.position.z - z) * Math.cos(tilt);
  };

  const placeCamera = () => {
    const p = propsRef.current;
    const aspect = width / height;
    const fov = 3 + 57 * clamp(p.perspective, 0, 1);
    const k = Math.tan((fov * Math.PI) / 360);
    const tilt = (clamp(p.tilt, 4, 85) * Math.PI) / 180;
    const limit = (0.92 * Math.tan(tilt)) / k;
    const top = Math.min(1 - 2 * clamp(p.horizon, 0.02, 0.9), limit, 0.96);
    const slope = v => (Math.sin(tilt) - v * k * Math.cos(tilt)) / (Math.cos(tilt) + v * k * Math.sin(tilt));
    const sBottom = slope(-1.18);
    const sTop = slope(top);
    const camZ = (10 * sTop) / Math.max(sBottom - sTop, 1e-4);
    const camY = camZ * sBottom;
    camera.fov = fov;
    camera.aspect = aspect;
    camera.position.set(0, camY, camZ);
    camera.lookAt(0, camY - Math.sin(tilt), camZ - Math.cos(tilt));
    camera.near = Math.max(0.01, 0.05 * Math.min(camZ, camY));
    camera.far = (camZ + camY + 10) * 4 + 50;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    view.k = k;
    view.aspect = aspect;
    view.depthNear = depthOf(0);
    half = view.depthNear * k * aspect;
    const pxPerUnit = height / 2 / (view.depthNear * k);
    glyph = Math.min(clamp(p.glyphSize, 4, 120) / pxPerUnit, view.depthNear * k * 0.25);
  };

  const crestJs = (v, sharp) => 2 * Math.pow(0.5 + 0.5 * Math.sin(v), sharp) - 1;
  const swellAt = (x, z) => {
    const a = shared.uDir.value.x;
    const l = shared.uDir.value.y;
    const k = shared.uK.value;
    const sharp = shared.uSharp.value;
    const t = shared.uTime.value;
    const w = 0.42 * Math.sqrt(9.8 * k);
    const u = x * a + z * l;
    let h = 0.56 * crestJs(u * k - t * w, sharp);
    h +=
      0.27 * crestJs((x * (0.8 * a - 0.6 * l) + z * (0.6 * a + 0.8 * l)) * k * 1.71 + 1.3 - t * w * 1.31, sharp) +
      0.13 * Math.sin((x * (0.9 * a + 0.44 * l) + z * (-(0.44 * a) + 0.9 * l)) * k * 2.93 + 2.1 - t * w * 1.71);
    const group = 0.7 + 0.3 * Math.sin((x * l - z * a) * k * 0.37 + 0.21 * t) * Math.sin(u * k * 0.19 - 0.13 * t + 1.7);
    const env = 1 + (0.16 + 1.3 * Math.exp(-Math.pow(x / (0.6 * shared.uHalf.value), 2)) - 1) * shared.uEnvelope.value;
    return shared.uAmp.value * h * group * env;
  };

  const rebuild = () => {
    const p = propsRef.current;
    placeCamera();
    const family = p.fontFamily || getComputedStyle(host).fontFamily;
    const font = `${clamp(p.fontWeight, 100, 900)} 72px ${family}`;
    const phrase = p.text.trim() ? p.text.trim() : '·';
    const src = `${phrase} `;
    const chars =
      typeof Intl === 'undefined' || Intl.Segmenter === undefined
        ? Array.from(src)
        : Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(src), s => s.segment);
    const key = `${font}|${chars.join('')}`;
    if (key !== atlasKey || !atlas) {
      atlasKey = key;
      atlas?.texture.dispose();
      const unique = Array.from(new Set(chars.filter(c => c.trim())));
      const ctx = document.createElement('canvas').getContext('2d');
      const measure = c => (ctx ? ((ctx.font = font), ctx.measureText(c).width) : 36);
      const widths = unique.map(measure);
      const cell = Math.ceil(149.60000000000002);
      let cx = 0;
      let cy = 0;
      const slots = [];
      widths.forEach(w => {
        const sw = Math.ceil(w) + 56;
        if (cx + sw > 2048) {
          cx = 0;
          cy += cell;
        }
        slots.push({ x: cx, y: cy, w: sw });
        cx += sw;
      });
      const texH = Math.max(cell, Math.pow(2, Math.ceil(Math.log2(cy + cell))));
      const atlasCanvas = document.createElement('canvas');
      atlasCanvas.width = 2048;
      atlasCanvas.height = texH;
      const actx = atlasCanvas.getContext('2d');
      const map = new Map();
      if (actx) {
        actx.fillStyle = '#000';
        actx.fillRect(0, 0, 2048, texH);
        actx.fillStyle = '#fff';
        actx.font = font;
        actx.textBaseline = 'alphabetic';
        actx.textAlign = 'left';
        unique.forEach((c, i) => {
          const s = slots[i];
          actx.fillText(c, s.x + 28, s.y + 28 + 70.56);
          map.set(c, { u: s.x / 2048, v: s.y / texH, w: s.w / 2048, h: cell / texH, advance: widths[i] / 72, width: s.w / 72 });
        });
      }
      const space = measure(' ') / 72;
      map.set(' ', { u: 0, v: 0, w: 0, h: 0, advance: space, width: 0 });
      const tex = new CanvasTexture(atlasCanvas);
      tex.flipY = false;
      tex.minFilter = LinearMipmapLinearFilter;
      tex.magFilter = LinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = 4;
      tex.colorSpace = NoColorSpace;
      tex.needsUpdate = true;
      atlas = { texture: tex, glyphs: map, size: [2048, texH] };
      glyphMat.uniforms.uAtlas.value = atlas.texture;
      glyphMat.uniforms.uAtlasSize.value.set(atlas.size[0], atlas.size[1]);
    }

    rowCount = Math.round(clamp(p.rows, 2, 64));
    const spacing = clamp(p.letterSpacing, -0.1, 1);
    const advance = c => ((atlas?.glyphs.get(c)?.advance ?? 0.3) + spacing) * glyph;
    const phraseLen = chars.reduce((s, c) => s + advance(c), 0);
    const gRow = [], gX = [], gRect = [], gWidth = [];
    const wRow = [], wX = [], wBottom = [], wIndex = [];
    for (let r = 0; r < rowCount; r++) {
      const z = -((r / Math.max(rowCount - 1, 1)) * 10);
      rowZ[r] = z;
      const halfW = depthOf(z) * view.k * view.aspect * 1.1 + 3 * glyph;
      rowHalf[r] = halfW;
      const reps = Math.max(1, Math.ceil((2 * halfW) / Math.max(phraseLen, 1e-4)) + 1);
      const len = reps * phraseLen;
      rowLength[r] = len;
      rowOffset[r] > 0 || (rowOffset[r] = Math.random() * len);
      let x = -len / 2;
      for (let n = 0; n < reps; n++) {
        for (const c of chars) {
          const a = advance(c);
          const g = atlas?.glyphs.get(c);
          if (g && g.width > 0) {
            gRow.push(r);
            gX.push(x + a / 2 - (spacing * glyph) / 2);
            gRect.push(g.u, g.v, g.w, g.h);
            gWidth.push(g.width * glyph);
          }
          x += a;
        }
      }
      const base = wRow.length;
      for (let t = 0; t <= 260; t++) {
        const wx = -halfW + (2 * halfW * t) / 260;
        wRow.push(r, r);
        wX.push(wx, wx);
        wBottom.push(0, 1);
        if (t < 260) {
          const v = base + 2 * t;
          wIndex.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
        }
      }
    }
    const wg = new BufferGeometry();
    wg.setAttribute('position', new Float32BufferAttribute(new Float32Array(3 * wRow.length), 3));
    wg.setAttribute('aRow', new Float32BufferAttribute(wRow, 1));
    wg.setAttribute('aX', new Float32BufferAttribute(wX, 1));
    wg.setAttribute('aBottom', new Float32BufferAttribute(wBottom, 1));
    wg.setIndex(wIndex);
    waterGeo.dispose();
    waterGeo = wg;
    water.geometry = wg;
    const gg = new InstancedBufferGeometry();
    gg.setAttribute('position', new Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    gg.setAttribute('aRow', new InstancedBufferAttribute(new Float32Array(gRow), 1));
    gg.setAttribute('aX', new InstancedBufferAttribute(new Float32Array(gX), 1));
    gg.setAttribute('aRect', new InstancedBufferAttribute(new Float32Array(gRect), 4));
    gg.setAttribute('aWidth', new InstancedBufferAttribute(new Float32Array(gWidth), 1));
    gg.instanceCount = gRow.length;
    glyphGeo.dispose();
    glyphGeo = gg;
    glyphs.geometry = gg;
    strings.fill(0);
    stringVel.fill(0);
  };

  const applyUniforms = () => {
    const p = propsRef.current;
    const bg = parseColor(p.backgroundColor, [0.04, 0.04, 0.04]);
    const lum = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2];
    const ink = p.mode === 'ink' || (p.mode === 'auto' && lum > 0.5);
    const high = toOklab(parseColor(p.colors[0], [1, 1, 1]));
    const low = toOklab(parseColor(p.colors[1], [0.49, 0.36, 1]));
    const gap = 10 / Math.max(rowCount - 1, 1);
    const dir = (clamp(p.direction, -180, 180) * Math.PI) / 180;
    shared.uTime.value = time;
    shared.uAmp.value = clamp(p.amplitude, 0, 8) * gap;
    shared.uK.value = (2 * Math.PI) / Math.max(clamp(p.wavelength, 0.05, 4) * half * 2, 0.001);
    shared.uSharp.value = 1 + 2.4 * clamp(p.sharpness, 0, 1);
    shared.uDir.value.set(Math.sin(dir), -Math.cos(dir));
    shared.uEnvelope.value = clamp(p.envelope, 0, 1);
    shared.uHalf.value = half;
    const u = glyphMat.uniforms;
    u.uRowCount.value = rowCount;
    u.uGlyph.value = glyph;
    u.uFocus.value = p.reduced ? clamp(p.focusDepth, 0, 1) : focus.value;
    u.uDof.value = clamp(p.depthOfField, 0, 1);
    u.uRange.value = clamp(p.focusRange, 0, 1);
    u.uGap.value = gap;
    u.uLabHigh.value.set(high[0], high[1], high[2]);
    u.uLabLow.value.set(low[0], low[1], low[2]);
    u.uInk.value = +!!ink;
    u.uFog.value = clamp(p.fog, 0, 3);
    waterMat.uniforms.uBackground.value.set(bg[0], bg[1], bg[2]);
    renderer.setClearColor(new Color().setRGB(bg[0], bg[1], bg[2], SRGBColorSpace), 1);
    for (let r = 0; r < rowCount; r++) {
      const len = rowLength[r];
      rowShift[r] = ((rowOffset[r] % len) + len) % len;
    }
  };

  const update = () => {
    const p = propsRef.current;
    const key = [p.text, p.fontFamily, p.fontWeight, p.letterSpacing, p.glyphSize, p.rows, p.perspective, p.tilt, p.horizon,
      Math.round(width), Math.round(height), getComputedStyle(host).fontFamily].join('|');
    if (key !== layoutKey) {
      layoutKey = key;
      rebuild();
    } else placeCamera();
    applyUniforms();
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  };

  const pluck = (row, x, amount) => {
    const halfW = rowHalf[row];
    const center = 159 * clamp((x / halfW) * 0.5 + 0.5, 0, 1);
    const spread = Math.max(3, ((7 * glyph) / (2 * halfW)) * 159);
    plucks.push({ row, center, spread, amount, left: 0.09 });
  };
  const drivePlucks = dt => {
    for (let i = plucks.length - 1; i >= 0; i--) {
      const pk = plucks[i];
      const share = Math.min(dt, pk.left) / 0.09;
      pk.left -= dt;
      const from = Math.max(1, Math.floor(pk.center - 3 * pk.spread));
      const to = Math.min(158, Math.ceil(pk.center + 3 * pk.spread));
      const base = 160 * pk.row;
      for (let j = from; j <= to; j++) {
        const t = (j - pk.center) / pk.spread;
        strings[base + j] += pk.amount * share * Math.exp(-t * t);
      }
      if (pk.left <= 0) plucks.splice(i, 1);
    }
  };
  const screenAt = (row, px) => {
    const ndc = (px / width) * 2 - 1;
    const z = rowZ[row];
    const x = ndc * depthOf(z) * view.k * view.aspect;
    const y = swellAt(x, z);
    tmp.set(x, y, z).project(camera);
    return [x, (1 - tmp.y) * 0.5 * height];
  };

  const frame = now => {
    raf = 0;
    if (destroyed) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const p = propsRef.current;
    const live = !p.paused && !p.reduced;
    if (++frameNo % 30 === 0 && (Math.abs(host.clientWidth - width) > 1 || Math.abs(host.clientHeight - height) > 1)) resize();
    if (!sized) {
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
      return;
    }
    if (live) {
      time += dt * clamp(p.speed, 0, 4);
      const flow = clamp(p.flow, -20, 20) * glyph;
      for (let r = 0; r < rowCount; r++) {
        const sign = p.alternate && r % 2 === 1 ? -1 : 1;
        rowOffset[r] += flow * sign * dt;
      }
      for (let i = pending.length - 1; i >= 0; i--) {
        const s = pending[i];
        if (s.at > time) continue;
        if (s.row < rowCount) pluck(s.row, s.x, s.amount);
        pending.splice(i, 1);
      }
      let target = clamp(p.focusDepth, 0, 1);
      if (pointer.inside && p.interactive && p.hoverFocus) {
        target = ((px, py) => {
          let prev = screenAt(0, px)[1];
          if (py >= prev) return 0;
          for (let r = 1; r < rowCount; r++) {
            const y = screenAt(r, px)[1];
            if (py >= y) {
              const span = prev - y;
              return (r - 1 + clamp(span > 0.001 ? (prev - py) / span : 0, 0, 1)) / Math.max(rowCount - 1, 1);
            }
            prev = y;
          }
          return 1;
        })(pointer.x, pointer.y);
      }
      focus.velocity += (42.25 * (target - focus.value) - 13 * focus.velocity) * dt;
      focus.value += focus.velocity * dt;
      // strings: a damped wave equation per row, stepped at a fixed rate
      {
        const tension = Math.min(0.95, 62 * clamp(p.tension, 0.1, 3) * STEP) ** 2 / (STEP * STEP);
        const damping = 1 / clamp(p.sustain, 0.2, 10);
        simAcc += dt;
        let steps = 0;
        while (simAcc >= STEP && steps < 16) {
          simAcc -= STEP;
          steps++;
          drivePlucks(STEP);
          for (let r = 0; r < rowCount; r++) {
            const base = 160 * r;
            for (let j = 1; j < 159; j++) {
              const a = base + j;
              const lap = strings[a - 1] + strings[a + 1] - 2 * strings[a];
              const edge = Math.min(j, 159 - j);
              const absorb = edge < 14 ? (14 - edge) * 1.6 : 0;
              stringVel[a] += (tension * lap - (damping + absorb) * stringVel[a]) * STEP;
            }
            for (let j = 1; j < 159; j++) strings[base + j] += stringVel[base + j] * STEP;
          }
        }
        if (steps === 16) simAcc = 0;
        stringTex.needsUpdate = true;
      }
    }
    update();
    if (visible && !document.hidden && live) raf = requestAnimationFrame(frame);
  };

  function kick() {
    if (destroyed || raf || !visible) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  const resize = () => {
    const rect = host.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      sized = false;
      kick();
      return;
    }
    sized = true;
    width = rect.width;
    height = rect.height;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2) * clamp(propsRef.current.quality, 0.25, 1);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    layoutKey = '';
    update();
    kick();
  };

  const local = e => {
    const rect = host.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };
  const onMove = e => {
    if (e.pointerType === 'touch') return;
    const [x, y] = local(e);
    pointer.x = x;
    pointer.y = y;
    pointer.inside = true;
    kick();
  };
  const onLeave = () => {
    pointer.inside = false;
  };
  const strum = (px, py) => {
    const p = propsRef.current;
    if (p.reduced || p.paused) return;
    const gap = 10 / Math.max(rowCount - 1, 1);
    let hit = 0;
    let best = Infinity;
    for (let r = 0; r < rowCount; r++) {
      const [, y] = screenAt(r, px);
      const d = Math.abs(y - py);
      if (d < best) {
        best = d;
        hit = r;
      }
    }
    const amount = 0.75 * gap * clamp(p.strumStrength, 0, 3);
    for (let r = 0; r < rowCount; r++) {
      const [x] = screenAt(r, px);
      const d = Math.abs(r - hit);
      pending.push({ row: r, x, at: time + 0.045 * d, amount: amount * Math.exp(-d / 12) });
    }
    kick();
  };
  const onClick = e => {
    const p = propsRef.current;
    if (!p.interactive || !p.clickStrum) return;
    const [x, y] = local(e);
    strum(x, y);
  };

  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerleave', onLeave);
  host.addEventListener('click', onClick);
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(
    entries => {
      visible = entries.some(e => e.isIntersecting);
      if (visible) kick();
    },
    { rootMargin: '80px' }
  );
  io.observe(host);
  const onVisibility = () => {
    if (!document.hidden) kick();
  };
  document.addEventListener('visibilitychange', onVisibility);
  document.fonts?.ready &&
    document.fonts.ready
      .then(() => {
        if (destroyed) return;
        atlasKey = '';
        layoutKey = '';
        if (sized) update();
      })
      .catch(() => {});
  const onLost = e => e.preventDefault();
  canvas.addEventListener('webglcontextlost', onLost);
  resize();

  return {
    sync: () => {
      const pr = Math.min(window.devicePixelRatio || 1, 2) * clamp(propsRef.current.quality, 0.25, 1);
      if (!sized || Math.abs(pr - pixelRatio) > 0.001) resize();
      else update();
      kick();
    },
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('click', onClick);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      ro.disconnect();
      io.disconnect();
      atlas?.texture.dispose();
      stringTex.dispose();
      waterGeo.dispose();
      glyphGeo.dispose();
      waterMat.dispose();
      glyphMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
    strum: (x, y) => strum(clamp(x, 0, 1) * width, clamp(y, 0, 1) * height)
  };
}

const WaveLettering = forwardRef(function WaveLettering(
  {
    text = 'FORM FOLLOWS FEELING ·',
    colors = ['#FFFFFF', '#7C5CFF'],
    backgroundColor = '#0A0A0A',
    mode = 'auto',
    fontFamily = '',
    fontWeight = 500,
    letterSpacing = 0.08,
    glyphSize = 13,
    rows = 30,
    perspective = 0.55,
    tilt = 24,
    horizon = 0.36,
    amplitude = 1.6,
    wavelength = 0.7,
    speed = 1,
    direction = 0,
    sharpness = 0.5,
    envelope = 0,
    flow = 0.8,
    alternate = false,
    fog = 0.6,
    interactive = true,
    hoverFocus = true,
    focusDepth = 0.3,
    depthOfField = 0.7,
    focusRange = 0.14,
    clickStrum = true,
    strumStrength = 1,
    tension = 1,
    sustain = 1.6,
    paused = false,
    quality = 1,
    className,
    style,
    children
  },
  ref
) {
  const hostRef = useRef(null);
  const engineRef = useRef(null);
  const reduced = useSyncExternalStore(subscribeReduced, getReduced, () => false);
  const props = {
    text, colors, backgroundColor, mode, fontFamily, fontWeight, letterSpacing, glyphSize, rows, perspective, tilt, horizon,
    amplitude, wavelength, speed, direction, sharpness, envelope, flow, alternate, fog, interactive, hoverFocus, focusDepth,
    depthOfField, focusRange, clickStrum, strumStrength, tension, sustain, paused, quality, reduced
  };
  const propsRef = useRef(props);

  useEffect(() => {
    propsRef.current = props;
    engineRef.current?.sync();
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const engine = createEngine(host, propsRef);
    engineRef.current = engine;
    return () => {
      engine?.destroy();
      engineRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({ strum: (x = 0.5, y = 0.6) => engineRef.current?.strum(x, y) }), []);

  return (
    <div ref={hostRef} role="img" aria-label={text} className={['wl-root', className].filter(Boolean).join(' ')} style={{ backgroundColor, ...style }}>
      {children && <div className="wl-content">{children}</div>}
    </div>
  );
});

WaveLettering.displayName = 'WaveLettering';
export default WaveLettering;
