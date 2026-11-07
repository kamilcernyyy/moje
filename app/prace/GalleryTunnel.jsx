import { useEffect, useMemo, useRef } from 'react';

// Gallery Tunnel (Originkit, hero-03 / ui/gallery-tunnel): an endless Three.js tunnel of image and colour slabs.
// Same props, markup and behaviour as the original; the scene itself lives in tunnel-core.js and renders in a
// Web Worker (OffscreenCanvas) so the page's main thread stays free — on the page itself only where workers can't draw.

const CORE_URL = '/assets/js/tunnel-core.js';

const DEFAULTS = {
  background: '#000000',
  lineColor: '#B0B0B0',
  lineOpacity: 50,
  colors: ['#FF6A00', '#AB54F7', '#EA3737', '#0072E3', '#00AA3C', '#FFB200'],
  grid: 4,
  speed: 100,
  boost: 100,
  fade: 100,
  label: true,
  labelText: 'Press to Start',
  labelFill: '#FFFFFF',
  labelColor: '#000000',
  labelFont: { fontFamily: 'Inter', fontSize: 14, fontWeight: 500 }
};

const srcOf = image => (typeof image === 'string' ? image : image?.src ?? '');
const absolute = url => new URL(url, location.href).href;

let coreLoading = null;
const loadCore = () =>
  coreLoading ||
  (coreLoading = new Promise((resolve, reject) => {
    if (window.GalleryTunnelCore) return resolve(window.GalleryTunnelCore);
    const s = document.createElement('script');
    s.src = CORE_URL;
    s.onload = () => resolve(window.GalleryTunnelCore);
    s.onerror = reject;
    document.head.appendChild(s);
  }));

export default function ImageBox(props) {
  const {
    images,
    colors,
    background = DEFAULTS.background,
    lineColor = DEFAULTS.lineColor,
    lineOpacity = DEFAULTS.lineOpacity,
    grid = DEFAULTS.grid,
    speed = DEFAULTS.speed,
    boost = DEFAULTS.boost,
    fade = DEFAULTS.fade,
    label = DEFAULTS.label,
    labelText = DEFAULTS.labelText,
    labelFill = DEFAULTS.labelFill,
    labelColor = DEFAULTS.labelColor,
    labelFont = DEFAULTS.labelFont,
    style
  } = props;

  const frameRef = useRef(null);
  const cursorRef = useRef(null);

  const urls = useMemo(() => {
    const list = (images ?? []).map(srcOf).filter(Boolean);
    return list;
  }, [images]);

  const palette = useMemo(() => {
    const list = (colors ?? []).filter(Boolean);
    return list.length ? list : DEFAULTS.colors;
  }, [colors]);

  const cfgRef = useRef({ speed: 1, boost: 1 });
  cfgRef.current = {
    speed: Math.max(0, speed) / 100,
    boost: Math.max(0, boost) / 10
  };

  // live speed / boost (they change with reduced motion and the breakpoint) reach the scene without a rebuild
  const sendCfg = useRef(null);
  useEffect(() => {
    sendCfg.current?.(cfgRef.current);
  });

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    // a fresh canvas per scene: a canvas handed to a worker can't be taken back
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    frame.prepend(canvas);

    let alive = true;
    let worker = null;
    let tunnel = null;
    const size = () => ({ width: Math.max(1, frame.clientWidth), height: Math.max(1, frame.clientHeight), dpr: window.devicePixelRatio || 1 });
    const init = {
      urls: urls.map(absolute),
      palette,
      background,
      lineColor,
      lineOpacity,
      grid,
      fade,
      ...cfgRef.current,
      ...size()
    };

    // one channel for both renderers
    const post = m => {
      if (worker) worker.postMessage(m);
      else if (tunnel) {
        if (m.type === 'resize') tunnel.resize(m.width, m.height, m.dpr);
        else if (m.type === 'pressed') tunnel.setPressed(m.value);
        else if (m.type === 'config') tunnel.setConfig(m);
        else if (m.type === 'visible') tunnel.setVisible(m.value);
      }
    };
    sendCfg.current = c => post({ type: 'config', speed: c.speed, boost: c.boost });

    if (typeof canvas.transferControlToOffscreen === 'function' && typeof Worker !== 'undefined') {
      try {
        const offscreen = canvas.transferControlToOffscreen();
        worker = new Worker(CORE_URL);
        worker.postMessage({ type: 'init', canvas: offscreen, ...init }, [offscreen]);
      } catch {
        worker = null;
      }
    }
    if (!worker) {
      loadCore()
        .then(create => {
          if (alive && create) tunnel = create(canvas, init);
        })
        .catch(() => {});
    }

    const ro = new ResizeObserver(() => post({ type: 'resize', ...size() }));
    ro.observe(frame);
    const io = new IntersectionObserver(entries => post({ type: 'visible', value: entries.some(e => e.isIntersecting) }));
    io.observe(frame);

    const onMove = e => {
      const el = cursorRef.current;
      if (!el) return;
      const rect = frame.getBoundingClientRect();
      const sx = rect.width > 0 ? frame.clientWidth / rect.width : 1;
      const sy = rect.height > 0 ? frame.clientHeight / rect.height : 1;
      el.style.left = `${(e.clientX - rect.left) * sx}px`;
      el.style.top = `${(e.clientY - rect.top) * sy}px`;
    };
    const onEnter = () => {
      const el = cursorRef.current;
      if (el) el.style.opacity = '1';
    };
    const onLeave = () => {
      post({ type: 'pressed', value: false });
      const el = cursorRef.current;
      if (el) {
        el.style.opacity = '0';
        el.style.transform = 'translate(0%, -100%) scale(1)';
      }
    };
    const onDown = () => {
      post({ type: 'pressed', value: true });
      const el = cursorRef.current;
      if (el) el.style.transform = 'translate(0%, -100%) scale(0.85)';
    };
    const onUp = () => {
      post({ type: 'pressed', value: false });
      const el = cursorRef.current;
      if (el) el.style.transform = 'translate(0%, -100%) scale(1)';
    };

    frame.addEventListener('pointermove', onMove);
    frame.addEventListener('pointerenter', onEnter);
    frame.addEventListener('pointerleave', onLeave);
    frame.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);

    return () => {
      alive = false;
      sendCfg.current = null;
      ro.disconnect();
      io.disconnect();
      frame.removeEventListener('pointermove', onMove);
      frame.removeEventListener('pointerenter', onEnter);
      frame.removeEventListener('pointerleave', onLeave);
      frame.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      if (worker) worker.postMessage({ type: 'destroy' });
      tunnel?.destroy();
      canvas.remove();
    };
  }, [urls, palette, background, lineColor, lineOpacity, grid, fade]);

  return (
    <div
      ref={frameRef}
      style={{
        ...style,
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: label ? 'none' : 'default'
      }}
    >
      {label && (
        <div
          ref={cursorRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: 'translate(0%, -100%) scale(1)',
            pointerEvents: 'none',
            opacity: 0,
            background: labelFill,
            borderRadius: 9999,
            padding: '10px 20px',
            transition: 'transform 0.1s ease, opacity 0.2s ease',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            ...labelFont,
            color: labelColor
          }}
        >
          {labelText}
        </div>
      )}
    </div>
  );
}
