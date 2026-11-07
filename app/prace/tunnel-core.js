import * as THREE from 'three';

// Gallery Tunnel scene (Originkit hero-03, ui/gallery-tunnel) — the same scene, constants and motion as the original,
// moved into its own script so it can render in a Web Worker (OffscreenCanvas) and keep the page's main thread free.
// The same file runs on the main thread as a fallback (self.GalleryTunnelCore).

const TUNNEL_WIDTH = 2;
const TUNNEL_HEIGHT = 1.8;
const SEGMENT_DEPTH = 1;
const NUM_SEGMENTS = 15;
const LINE_RADIUS = 0.003;
const SCROLL_TO_Z = 0.05;
const CAMERA_CHASE = 0.1;
const FADE_IN = 1;

const FOG_FAR = NUM_SEGMENTS * SEGMENT_DEPTH * 0.95;

const raf = typeof self.requestAnimationFrame === 'function' ? cb => self.requestAnimationFrame(cb) : cb => setTimeout(() => cb(performance.now()), 16);
const caf = typeof self.cancelAnimationFrame === 'function' ? id => self.cancelAnimationFrame(id) : id => clearTimeout(id);

function createTunnel(canvas, o) {
  const { urls, palette, background, lineColor, lineOpacity, grid, fade } = o;
  const cfg = { speed: o.speed, boost: o.boost };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  const fogNear = Math.min(FOG_FAR * (1 - Math.min(100, Math.max(0, fade)) / 100), FOG_FAR - 0.01);
  scene.fog = new THREE.Fog(new THREE.Color(background), fogNear, FOG_FAR);

  const camera = new THREE.PerspectiveCamera(45, 1, 1, 1000);
  camera.position.set(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(o.dpr || 1, 2));

  const lineMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(lineColor),
    transparent: true,
    opacity: Math.min(100, Math.max(0, lineOpacity)) / 100
  });

  const fading = [];

  let imageIndex = 0;
  let colorIndex = 0;
  let populateIndex = 0;
  let scrollPos = 0;
  let frameId = 0;
  let last = 0;
  let pressed = false;
  let alive = true;
  let visible = true;

  const hw = TUNNEL_WIDTH / 2;
  const hh = TUNNEL_HEIGHT / 2;

  const cols = Math.max(1, Math.round(grid));
  const rows = Math.max(1, Math.round(grid));
  const colW = TUNNEL_WIDTH / cols;
  const rowH = TUNNEL_HEIGHT / rows;

  const geoFloor = new THREE.PlaneGeometry(colW, SEGMENT_DEPTH);
  const geoWall = new THREE.PlaneGeometry(SEGMENT_DEPTH, rowH);

  const geoTubeZ = new THREE.TubeGeometry(
    new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -SEGMENT_DEPTH)),
    1,
    LINE_RADIUS,
    8
  );
  const geoTubeX = new THREE.TubeGeometry(
    new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(TUNNEL_WIDTH, 0, 0)),
    1,
    LINE_RADIUS,
    8
  );
  const geoTubeY = new THREE.TubeGeometry(
    new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, TUNNEL_HEIGHT, 0)),
    1,
    LINE_RADIUS,
    8
  );

  const colorMats = palette.map(
    hex =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(hex),
        side: THREE.DoubleSide
      })
  );

  // textures: fetch + createImageBitmap works both in a worker and on the page (TextureLoader needs the DOM)
  const imageMats = urls.map(url => {
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });
    fetch(url)
      .then(r => r.blob())
      .then(b => createImageBitmap(b, { imageOrientation: 'flipY' }))
      .then(bitmap => {
        if (!alive) {
          bitmap.close?.();
          return;
        }
        const tex = new THREE.Texture(bitmap);
        tex.flipY = false;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        mat.map = tex;
        mat.needsUpdate = true;
        fading.push(mat);
      })
      .catch(() => {
        // A dead URL should cost a blank slab, not a broken tunnel.
      });
    return mat;
  });

  const tube = (geo, x, y, z = 0) => {
    const m = new THREE.Mesh(geo, lineMaterial);
    m.position.set(x, y, z);
    return m;
  };

  const SLOTS = [];
  {
    const z = -SEGMENT_DEPTH / 2;
    for (let i = 0; i < cols; i++) {
      const x = -hw + i * colW + colW / 2;
      SLOTS.push({ geo: geoFloor, pos: new THREE.Vector3(x, -hh, z), rot: new THREE.Euler(-Math.PI / 2, 0, 0) });
      SLOTS.push({ geo: geoFloor, pos: new THREE.Vector3(x, hh, z), rot: new THREE.Euler(Math.PI / 2, 0, 0) });
    }
    for (let i = 0; i < rows; i++) {
      const y = -hh + i * rowH + rowH / 2;
      SLOTS.push({ geo: geoWall, pos: new THREE.Vector3(-hw, y, z), rot: new THREE.Euler(0, Math.PI / 2, 0) });
      SLOTS.push({ geo: geoWall, pos: new THREE.Vector3(hw, y, z), rot: new THREE.Euler(0, -Math.PI / 2, 0) });
    }
  }

  function populate(group) {
    const takesSlabs = populateIndex % 2 === 0;
    populateIndex++;
    const slabs = group.userData.slabs;

    for (const slab of slabs) {
      if (!takesSlabs || Math.random() > 0.5) {
        slab.visible = false;
        continue;
      }
      slab.visible = true;
      if (Math.random() > 0.5) {
        slab.material = colorMats[(5 * colorIndex) % colorMats.length];
        colorIndex++;
      } else {
        slab.material = imageMats[(3 * imageIndex) % imageMats.length];
        imageIndex++;
      }
    }
  }

  function createSegment(z) {
    const group = new THREE.Group();
    group.position.z = z;

    for (let i = 0; i <= cols; i++) {
      const x = -hw + i * colW;
      group.add(tube(geoTubeZ, x, -hh));
      group.add(tube(geoTubeZ, x, hh));
    }
    for (let i = 1; i < rows; i++) {
      const y = -hh + i * rowH;
      group.add(tube(geoTubeZ, -hw, y));
      group.add(tube(geoTubeZ, hw, y));
    }
    group.add(tube(geoTubeX, -hw, -hh));
    group.add(tube(geoTubeX, -hw, hh));
    group.add(tube(geoTubeY, -hw, -hh));
    group.add(tube(geoTubeY, hw, -hh));

    const slabs = SLOTS.map(slot => {
      const m = new THREE.Mesh(slot.geo, colorMats[0]);
      m.position.copy(slot.pos);
      m.rotation.copy(slot.rot);
      m.visible = false;
      group.add(m);
      return m;
    });
    group.userData.slabs = slabs;

    populate(group);
    return group;
  }

  const segments = [];
  for (let i = 0; i < NUM_SEGMENTS; i++) {
    const g = createSegment(-i * SEGMENT_DEPTH);
    scene.add(g);
    segments.push(g);
  }

  const resize = (w, h, dpr) => {
    w = Math.max(1, w);
    h = Math.max(1, h);
    if (dpr) renderer.setPixelRatio(Math.min(dpr, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  resize(o.width, o.height);

  const animate = now => {
    if (!alive || !visible) {
      frameId = 0;
      return;
    }
    frameId = raf(animate);
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;

    scrollPos += pressed ? cfg.boost : cfg.speed;

    const want = -SCROLL_TO_Z * scrollPos;
    camera.position.z += CAMERA_CHASE * (want - camera.position.z);

    const span = NUM_SEGMENTS * SEGMENT_DEPTH;
    const z = camera.position.z;
    for (const seg of segments) {
      if (seg.position.z > z + SEGMENT_DEPTH) {
        let min = 0;
        for (const s of segments) min = Math.min(min, s.position.z);
        seg.position.z = min - SEGMENT_DEPTH;
        populate(seg);
      } else if (seg.position.z < z - span - SEGMENT_DEPTH) {
        let max = -999999;
        for (const s of segments) max = Math.max(max, s.position.z);
        seg.position.z = max + SEGMENT_DEPTH;
        populate(seg);
      }
    }

    for (let i = fading.length - 1; i >= 0; i--) {
      const m = fading[i];
      m.opacity = Math.min(1, m.opacity + dt / FADE_IN);
      if (m.opacity >= 1) fading.splice(i, 1);
    }

    renderer.render(scene, camera);
  };
  frameId = raf(animate);

  return {
    resize,
    setPressed: v => {
      pressed = !!v;
    },
    setConfig: c => {
      cfg.speed = c.speed;
      cfg.boost = c.boost;
    },
    // off screen: stop drawing (the page keeps scrolling past the hero to the gallery)
    setVisible: v => {
      visible = !!v;
      if (visible && alive && !frameId) {
        last = 0;
        frameId = raf(animate);
      }
    },
    destroy: () => {
      alive = false;
      caf(frameId);
      geoFloor.dispose();
      geoWall.dispose();
      geoTubeZ.dispose();
      geoTubeX.dispose();
      geoTubeY.dispose();
      for (const m of colorMats) m.dispose();
      for (const m of imageMats) {
        m.map?.dispose();
        m.dispose();
      }
      lineMaterial.dispose();
      renderer.dispose();
    }
  };
}

const inWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
if (inWorker) {
  let tunnel = null;
  self.onmessage = e => {
    const m = e.data;
    if (m.type === 'init') tunnel = createTunnel(m.canvas, m);
    else if (!tunnel) return;
    else if (m.type === 'resize') tunnel.resize(m.width, m.height, m.dpr);
    else if (m.type === 'pressed') tunnel.setPressed(m.value);
    else if (m.type === 'config') tunnel.setConfig(m);
    else if (m.type === 'visible') tunnel.setVisible(m.value);
    else if (m.type === 'destroy') {
      tunnel.destroy();
      tunnel = null;
      self.close();
    }
  };
} else {
  self.GalleryTunnelCore = createTunnel;
}
