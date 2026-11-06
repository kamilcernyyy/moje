import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import GlassSurface from '../glass/GlassSurface.jsx';

// Layout 9 "Zásuvka", every glass size enlarged by 25 %:
// desktop = glass drawer on the right, mobile = glass bottom sheet with a handle.
const S = 1.25;
const GLASS = { distortionScale: -180, displace: 0.5, backgroundOpacity: 0.1 };

function useMobile() {
  const query = '(max-width: 760px)';
  const [mobile, setMobile] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

function Buttons({ w, h }) {
  return (
    <div className="hp-btns">
      <a className="hp-btn" href="/o-mne/">
        <GlassSurface {...GLASS} width={w} height={h} borderRadius={h / 2}>
          <span className="hp-label">O mně a proč zvolit mě</span>
        </GlassSurface>
      </a>
      <button className="hp-btn" type="button">
        <GlassSurface {...GLASS} width={w} height={h} borderRadius={h / 2}>
          <span className="hp-label">CHCI!</span>
        </GlassSurface>
      </button>
    </div>
  );
}

function Home() {
  const mobile = useMobile();
  const [collapsed, setCollapsed] = useState(false);
  const drag = useRef(null);

  if (!mobile) {
    // drawer: 376 × full height in the chosen mockup, buttons 304 × 64 → ×1.25
    return (
      <div className="hp-drawer">
        <GlassSurface {...GLASS} width={Math.round(376 * S)} height="calc(100dvh - 48px)" borderRadius={Math.round(28 * S)} />
        <Buttons w={Math.round(304 * S)} h={Math.round(64 * S)} />
      </div>
    );
  }

  // bottom sheet: buttons 350 × 58 in the mockup → height ×1.25, full width minus gutters
  const onDown = e => { drag.current = e.clientY; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onUp = e => {
    if (drag.current === null) return;
    const dy = e.clientY - drag.current;
    drag.current = null;
    if (Math.abs(dy) < 8) setCollapsed(c => !c);
    else setCollapsed(dy > 0);
  };
  return (
    <div className={`hp-sheet${collapsed ? ' is-collapsed' : ''}`}>
      <GlassSurface {...GLASS} width="100%" height="100%" borderRadius={Math.round(28 * S)} />
      <button className="hp-handle" type="button" aria-label={collapsed ? 'Vysunout tlačítka' : 'Schovat tlačítka'}
        aria-expanded={!collapsed} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (drag.current = null)}>
        <span />
      </button>
      <Buttons w="100%" h={Math.round(58 * S)} />
    </div>
  );
}

createRoot(document.getElementById('hp-root')).render(<Home />);
