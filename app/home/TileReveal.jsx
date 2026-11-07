import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './TileReveal.css';

// Tile Reveal (React Bits Pro, tile-reveal-tw): image tiles fly in on scroll to reveal a headline.
// Same logic and markup as the original; the Tailwind utility classes are written out in TileReveal.css.

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
const easeInOut = (t, p) => (t < 0.5 ? Math.pow(2, p - 1) * Math.pow(t, p) : 1 - Math.pow(-2 * t + 2, p) / 2);
const cn = (...c) => c.filter(Boolean).join(' ');

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

export default function TileReveal({
  images,
  headline,
  children,
  columns = 3,
  gap = 28,
  gridWidth = 720,
  tileAspect = 1,
  tileRadius = 0,
  grayscale = false,
  direction = 'alternate',
  stagger = 0.06,
  overlap = 0.6,
  zoom = 2.05,
  spread = 0.4,
  scrollLength = 3,
  scrub = 0.08,
  contentGap = 28,
  backgroundColor = 'transparent',
  onProgress,
  className,
  style
}) {
  const reduced = useReducedMotion();
  const sectionRef = useRef(null);
  const stageRef = useRef(null);
  const gridRef = useRef(null);
  const tileRefs = useRef([]);
  const headRef = useRef(null);
  const contentRef = useRef(null);
  const current = useRef(0);
  const raf = useRef(0);
  const last = useRef(0);
  const running = useRef(false);
  const stageW = useRef(0);
  const stageH = useRef(0);
  const gridW = useRef(0);
  const gridH = useRef(0);
  const contentH = useRef(0);

  const cols = Math.max(1, Math.round(columns));
  const count = images.length;

  const plan = useMemo(() => {
    const mid = (cols - 1) / 2;
    const perCol = Array.from({ length: cols }, (_, c) => Math.floor((count - c + cols - 1) / cols));
    const maxRows = Math.max(0, ...perCol);
    const zoomStart = Math.max(0, (maxRows > 0 ? 1 + (maxRows - 1) * stagger : 0) - overlap);
    const contentStart = zoomStart + 1 - 0.32;
    const total = Math.max(zoomStart + 1, contentStart + 0.32, 0.001);
    return {
      tiles: Array.from({ length: count }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const rowsInCol = perCol[col];
        const fromTop = direction === 'top' || (direction !== 'bottom' && col % 2 === 0);
        const centre = Math.abs(col - mid) < 0.001;
        return {
          start: (fromTop ? rowsInCol - 1 - row : row) * stagger,
          dir: fromTop ? -1 : 1,
          col,
          row,
          lateral: centre ? 0 : Math.sign(col - mid),
          vertical: centre ? (row < Math.floor(rowsInCol / 2) ? -1 : 1) : 0
        };
      }),
      rows: Math.ceil(count / cols),
      mid,
      zoomStart,
      splitStart: zoomStart + 0.5,
      contentStart,
      total
    };
  }, [cols, count, direction, overlap, stagger]);

  const render = useCallback(
    progress => {
      const grid = gridRef.current;
      if (!grid) return;
      const t = progress * plan.total;
      const travel = (stageH.current + gridH.current) / 2;
      const zoomP = easeInOut(clamp(t - plan.zoomStart, 0, 1), 3);
      const splitP = easeInOut(clamp((t - plan.splitStart) / 0.5, 0, 1), 1);
      const contentP = easeInOut(clamp((t - plan.contentStart) / 0.32, 0, 1), 2);
      const z = Math.max(zoom, 1);
      grid.style.transform = `scale(${1 + (z - 1) * zoomP})`;

      const tileW = Math.max(1, (gridW.current - gap * (cols - 1)) / cols);
      const tileH = tileW / Math.max(tileAspect, 0.01);
      const stepX = tileW + gap;
      const stepY = tileH + gap;
      const midRow = (plan.rows - 1) / 2;
      const pushX = d => Math.max(spread * tileW, stageW.current / (2 * z) + tileW / 2 - Math.abs(d) + gap);
      const pushY = d => Math.max(spread * tileH, stageH.current / (2 * z) + tileH / 2 - Math.abs(d) + gap);

      for (let i = 0; i < plan.tiles.length; i++) {
        const el = tileRefs.current[i];
        if (!el) continue;
        const tile = plan.tiles[i];
        const fly = easeInOut(clamp(t - tile.start, 0, 1), 1);
        const y = tile.dir * travel * (1 - fly);
        const x = tile.lateral * pushX((tile.col - plan.mid) * stepX) * zoomP;
        const ySplit = tile.vertical * pushY((tile.row - midRow) * stepY) * splitP;
        el.style.transform = `translate3d(${x.toFixed(2)}px, ${(y + ySplit).toFixed(2)}px, 0)`;
        el.style.visibility = fly <= 0 ? 'hidden' : 'visible';
      }

      const head = headRef.current;
      if (head) {
        const shift = ((contentH.current + contentGap) / 2) * (1 - contentP);
        head.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
      }
      const content = contentRef.current;
      if (content) {
        content.style.opacity = contentP.toFixed(3);
        content.style.transform = `translate3d(0, ${((1 - contentP) * 12).toFixed(2)}px, 0)`;
        content.style.pointerEvents = contentP > 0.5 ? 'auto' : 'none';
      }
      onProgress?.(progress);
    },
    [cols, contentGap, gap, onProgress, plan, spread, tileAspect, zoom]
  );

  const readProgress = useCallback(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return 0;
    const rect = section.getBoundingClientRect();
    const range = rect.height - stage.getBoundingClientRect().height;
    return range <= 0 ? 0 : clamp(-rect.top / range, 0, 1);
  }, []);

  useEffect(() => {
    if (reduced) return undefined;
    const section = sectionRef.current;
    const stage = stageRef.current;
    const grid = gridRef.current;
    if (!section || !stage || !grid) return undefined;
    const doc = section.ownerDocument;
    const win = doc.defaultView;
    if (!win) return undefined;
    const lag = Math.max(scrub, 0);

    const tick = now => {
      const prev = last.current || now;
      const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000));
      last.current = now;
      const target = readProgress();
      const k = lag > 0 ? 1 - Math.exp(-dt / lag) : 1;
      const value = current.current + (target - current.current) * k;
      current.current = value;
      render(value);
      if (Math.abs(target - value) > 4e-4) raf.current = win.requestAnimationFrame(tick);
      else {
        current.current = target;
        render(target);
        running.current = false;
      }
    };
    const kick = () => {
      if (running.current) return;
      running.current = true;
      last.current = 0;
      raf.current = win.requestAnimationFrame(tick);
    };
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      stageW.current = rect.width;
      stageH.current = rect.height;
      gridW.current = grid.offsetWidth;
      gridH.current = grid.offsetHeight;
      contentH.current = contentRef.current?.offsetHeight ?? 0;
      current.current = readProgress();
      render(current.current);
    };

    measure();
    win.addEventListener('scroll', kick, { passive: true });
    doc.addEventListener('scroll', kick, { passive: true, capture: true });
    win.addEventListener('resize', measure);
    win.addEventListener('pageshow', measure);
    const ro = new ResizeObserver(measure);
    ro.observe(section);
    ro.observe(stage);
    ro.observe(grid);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => {
      win.cancelAnimationFrame(raf.current);
      running.current = false;
      win.removeEventListener('scroll', kick);
      doc.removeEventListener('scroll', kick, { capture: true });
      win.removeEventListener('resize', measure);
      win.removeEventListener('pageshow', measure);
      ro.disconnect();
    };
  }, [readProgress, render, reduced, scrub]);

  const sectionStyle = useMemo(
    () => ({ height: reduced ? undefined : `${((1 + Math.max(scrollLength, 0)) * 100).toFixed(2)}svh`, ...style }),
    [reduced, scrollLength, style]
  );
  const tileStyle = useMemo(() => ({ aspectRatio: `${tileAspect}`, borderRadius: `${tileRadius}px` }), [tileAspect, tileRadius]);

  const layer = (
    <div className="tr-layer" style={{ gap: `${contentGap}px` }}>
      {headline !== undefined && (
        <div ref={headRef} className="tr-move">
          {headline}
        </div>
      )}
      {children !== undefined && (
        <div ref={contentRef} className="tr-move" style={reduced ? undefined : { opacity: 0 }}>
          {children}
        </div>
      )}
    </div>
  );

  if (reduced) {
    return (
      <section ref={sectionRef} className={cn('tr-section tr-section--still', className)} style={{ ...sectionStyle, height: '100svh', background: backgroundColor }}>
        {layer}
      </section>
    );
  }

  return (
    <section ref={sectionRef} className={cn('tr-section', className)} style={sectionStyle}>
      <div ref={stageRef} className="tr-stage" style={{ height: '100svh', background: backgroundColor }}>
        {layer}
        <div className="tr-grid-wrap" style={{ width: `min(${gridWidth}px, calc(100% - ${2 * gap}px))` }}>
          <div ref={gridRef} className="tr-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: `${gap}px` }}>
            {images.map((src, i) => (
              <div key={`${src}-${i}`} ref={el => { tileRefs.current[i] = el; }} className="tr-tile" style={{ ...tileStyle, visibility: 'hidden' }}>
                <img src={src} alt="" draggable={false} loading="lazy" className={cn('tr-img', grayscale && 'tr-img--gray')} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
