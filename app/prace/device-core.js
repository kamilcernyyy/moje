import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// "Zařízení ve studiu" (detail of a web project): a studio-lit 3D phone showing the project's real mobile screens.
// Renders in a Web Worker on an OffscreenCanvas (or on the page as a fallback, self.DeviceCore), like the other scenes.

const raf = typeof self.requestAnimationFrame === 'function' ? cb => self.requestAnimationFrame(cb) : cb => setTimeout(() => cb(performance.now()), 16);

const W = 0.78, H = 1.62, D = 0.085, R = 0.11;           // body, metres-ish
const SW = 0.72, SH = 1.56, SR = 0.085;                   // screen

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function screenGeometry() {
  const g = new THREE.ShapeGeometry(roundedRect(SW, SH, SR), 12);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / SW + 0.5, p.getY(i) / SH + 0.5);
  return g;
}

function createDevice(canvas, o) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(o.dpr || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  camera.position.set(0, 0, 4.4);

  const phone = new THREE.Group();
  scene.add(phone);
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 8, R), new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(o.color || '#1c1b22').lerp(new THREE.Color('#1c1b22'), 0.75), metalness: 0.75, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.18
  }));
  phone.add(body);
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(W - 0.02, H - 0.02, R - 0.01), 12), new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.05, metalness: 0, clearcoat: 1 }));
  glass.position.z = D / 2 + 0.0005;
  phone.add(glass);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const screen = new THREE.Mesh(screenGeometry(), screenMat);
  screen.position.z = D / 2 + 0.0015;
  phone.add(screen);
  const island = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.042, 0.004, 4, 0.021), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  island.position.set(0, SH / 2 - 0.05, D / 2 + 0.003);
  phone.add(island);
  // camera bump on the back
  const bump = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.3, 0.03, 6, 0.06), body.material);
  bump.position.set(-W / 2 + 0.22, H / 2 - 0.22, -D / 2 - 0.012);
  phone.add(bump);

  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xb19eef, 2.2); rim.position.set(3, 1, -2); scene.add(rim);

  // screens
  const textures = [];
  let current = -1, want = 0;
  const load = (url, i) => fetch(url).then(r => r.blob()).then(b => createImageBitmap(b, { imageOrientation: 'flipY' })).then(bmp => {
    const t = new THREE.Texture(bmp);
    t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
    textures[i] = t;
    if (i === want && current !== want) { screenMat.map = t; screenMat.needsUpdate = true; current = want; }
    if (i === 0 && o.onReady) o.onReady();
  }).catch(() => {});
  (o.screens || []).forEach(load);

  // motion: a soft float, the pointer tilts the phone, a screen change spins it once around
  let px = 0, py = 0, tx = 0, ty = 0, spin = 0, spinFrom = 0, spinT = 1, scrollYaw = 0, last = 0, alive = true, visible = true, frameId = 0;
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const loop = now => {
    if (!alive || !visible) { frameId = 0; return; }
    frameId = raf(loop);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    tx += (px - tx) * Math.min(1, dt * 4); ty += (py - ty) * Math.min(1, dt * 4);
    if (spinT < 1) {
      spinT = Math.min(1, spinT + dt / 0.9);
      // swap the screen while the back faces the camera
      if (spinT > 0.5 && current !== want && textures[want]) { screenMat.map = textures[want]; screenMat.needsUpdate = true; current = want; }
    }
    spin = spinFrom + (Math.PI * 2) * ease(spinT);
    const t = now / 1000;
    phone.rotation.set(-0.06 + ty * 0.2 + Math.sin(t * 0.7) * 0.02, -0.22 + scrollYaw + tx * 0.35 + spin, 0.03 + Math.sin(t * 0.5) * 0.015);
    phone.position.y = Math.sin(t * 0.9) * 0.025;
    renderer.render(scene, camera);
  };
  frameId = raf(loop);

  const resize = (w, h, dpr) => {
    if (dpr) renderer.setPixelRatio(Math.min(dpr, 2));
    renderer.setSize(Math.max(1, w), Math.max(1, h), false);
    camera.aspect = Math.max(1, w) / Math.max(1, h);
    camera.position.z = Math.max(5.3, 2.8 / camera.aspect);   // the whole phone fits, with air around it, in any shape of stage
    camera.updateProjectionMatrix();
  };
  resize(o.width, o.height, o.dpr);

  return {
    resize,
    pointer: (x, y) => { px = x; py = y; },
    scroll: v => { scrollYaw = v; },
    show: i => {
      if (i === want) return;
      want = i;
      if (o.reduced || !textures[i]) { if (textures[i]) { screenMat.map = textures[i]; screenMat.needsUpdate = true; current = i; } return; }
      spinFrom = spin % (Math.PI * 2); spinT = 0;
    },
    setVisible: v => { visible = !!v; if (visible && !frameId && alive) { last = 0; frameId = raf(loop); } },
    destroy: () => { alive = false; renderer.dispose(); pmrem.dispose(); textures.forEach(t => t && t.dispose()); }
  };
}

const inWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
if (inWorker) {
  let dev = null;
  self.onmessage = e => {
    const m = e.data;
    if (m.type === 'init') dev = createDevice(m.canvas, { ...m, onReady: () => self.postMessage({ type: 'ready' }) });
    else if (!dev) return;
    else if (m.type === 'resize') dev.resize(m.width, m.height, m.dpr);
    else if (m.type === 'pointer') dev.pointer(m.x, m.y);
    else if (m.type === 'scroll') dev.scroll(m.v);
    else if (m.type === 'show') dev.show(m.i);
    else if (m.type === 'visible') dev.setVisible(m.value);
  };
} else {
  self.DeviceCore = createDevice;
}
