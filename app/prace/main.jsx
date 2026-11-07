import { useEffect, useRef, useState } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import GlassSurface from '../glass/GlassSurface.jsx';
import Hero from './Hero.jsx';

// Headpage, layout 9 / panel variant 1:
// a Shader Card flame panel (bottom right; on mobile a floating card) carrying two GlassSurface buttons.
const GLASS = { distortionScale: -180, displace: 0.5, backgroundOpacity: 0.1 };
const DESK = { w: 380, h: 80, pad: 28, gap: 15 };
const MOB = { h: 64, pad: 16, gap: 10, inset: 12, handle: 26 };

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

function Btn({ w, h, label, href }) {
  const glass = (
    <GlassSurface {...GLASS} width={w} height={h} borderRadius={h / 2}>
      <span className="hp-label">{label}</span>
    </GlassSurface>
  );
  return href ? <a className="hp-btn" href={href}>{glass}</a> : <button className="hp-btn" type="button">{glass}</button>;
}

function Home() {
  const mobile = useMobile();
  const flameRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const drag = useRef(null);

  // flame panel: rises again on the intro.
  // Created in its own idle slot so the WebGL setup never lands in the same task as the first render.
  useEffect(() => {
    if (!window.ShaderCard) return undefined;
    let card = null;
    const start = () => {
      if (!flameRef.current) return;
      card = new window.ShaderCard(flameRef.current, { borderRadius: '24px', interactive: false, transparent: true });
    };
    const id = 'requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 600 }) : setTimeout(start, 50);
    const onIntro = () => card && card.replay && card.replay();
    window.addEventListener('hp-intro', onIntro);
    return () => {
      if ('cancelIdleCallback' in window) cancelIdleCallback(id); else clearTimeout(id);
      window.removeEventListener('hp-intro', onIntro);
      if (card) card.destroy();
    };
  }, [mobile]);

  if (!mobile) {
    const { w, h, pad, gap } = DESK;
    return (
      <div className="hp-panel" style={{ width: w + pad * 2, height: h * 2 + gap + pad * 2 }}>
        <GlassSurface {...GLASS} className="hp-panel-glass" width={w + pad * 2} height={h * 2 + gap + pad * 2} borderRadius={24} />
        <div className="hp-flame" ref={flameRef} key="d" />
        <div className="hp-btns" style={{ padding: pad, gap }}>
          <Btn w={w} h={h} label="O mně a proč zvolit mě" href="/o-mne/" />
          <Btn w={w} h={h} label="CHCI!" />
        </div>
      </div>
    );
  }

  const { h, pad, gap, inset, handle } = MOB;
  const onDown = e => { drag.current = e.clientY; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onUp = e => {
    if (drag.current === null) return;
    const dy = e.clientY - drag.current;
    drag.current = null;
    if (Math.abs(dy) < 8) setCollapsed(c => !c);
    else setCollapsed(dy > 0);
  };
  return (
    <div className={`hp-sheet${collapsed ? ' is-collapsed' : ''}`}
      style={{ left: inset, right: inset, bottom: `calc(${inset}px + env(safe-area-inset-bottom))`, height: handle + h * 2 + gap + pad }}>
      <GlassSurface {...GLASS} className="hp-panel-glass" width="100%" height="100%" borderRadius={24} />
      <div className="hp-flame" ref={flameRef} key="m" />
      <button className="hp-handle" type="button" aria-label={collapsed ? 'Vysunout tlačítka' : 'Schovat tlačítka'}
        aria-expanded={!collapsed} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (drag.current = null)}>
        <span />
      </button>
      <div className="hp-btns" style={{ padding: `${handle}px ${pad}px 0`, gap }}>
        <Btn w="100%" h={h} label="O mně a proč zvolit mě" href="/o-mne/" />
        <Btn w="100%" h={h} label="CHCI!" />
      </div>
    </div>
  );
}

// hero-03 on top: markup pre-rendered at build time, React takes over here
hydrateRoot(document.getElementById('pr-hero'), <Hero />);

// panel: mount after the page has loaded and gone idle, so the glass and flame never block first paint
const mount = () => createRoot(document.getElementById('hp-root')).render(<Home />);
const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(mount, { timeout: 800 }) : setTimeout(mount, 60));
if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true });
