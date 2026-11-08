import { useEffect, useState } from 'react';
import GalleryTunnel from './GalleryTunnel.jsx';
import GlassSurface from '../glass/GlassSurface.jsx';

// Hero 03 (Originkit, section-12-hero) at the top of "Mé práce", in Grafysta colours and type.
// Navbar → the page's own Grafysta logo; "Explore Gallery" → scrolls down to the wheel of works below.

/** Matches `--breakpoint-ipad` / `--breakpoint-desktop-sm` of the original */
const IPAD_MIN = 768;
const DESKTOP_SM_MIN = 1280;

/**
 * Responsive GalleryTunnel config:
 * - < ipad: size 5, fade 88
 * - ipad … desktop-sm: size 6, fade 96
 * - desktop-sm+: size 10, fade 100
 */
const useTunnelConfig = () => {
  const [config, setConfig] = useState({ tunnelSize: 5, fade: 88, boost: 30 });
  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      if (width < IPAD_MIN) return setConfig({ tunnelSize: 5, fade: 88, boost: 30 });
      if (width < DESKTOP_SM_MIN) return setConfig({ tunnelSize: 6, fade: 96, boost: 30 });
      // Bigger frames fill with nearer slabs — max fade + denser fog in tunnel
      return setConfig({ tunnelSize: 10, fade: 100, boost: 30 });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return config;
};

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
};

const ART = ['brana', 'citron', 'okveti', 'spektrum', 'posun', 'rovnovaha', 'prstenec', 'ohyb'];
const TUNNEL_IMAGES = ART.map(name => ({ src: `/assets/tiles/${name}.webp`, alt: '' }));
const TUNNEL_COLORS = ['#5227FF', '#B19EEF', '#FF4F9A', '#FF8A3D', '#2E1A8C', '#7C5CFF'];
const GLASS = { distortionScale: -180, displace: 0.5, backgroundOpacity: 0.1 };

/** Animated Three.js gallery tunnel. Click/hold empty areas to boost; UI stays clickable above. */
const PerspectiveBackground = () => {
  const reduceMotion = useReducedMotion();
  const { fade, boost } = useTunnelConfig();
  // the WebGL tunnel starts once the page has loaded and gone idle, so it never competes with first paint
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let id = 0;
    const go = () => (id = 'requestIdleCallback' in window ? requestIdleCallback(() => setReady(true), { timeout: 1200 }) : setTimeout(() => setReady(true), 80));
    if (document.readyState === 'complete') go();
    else addEventListener('load', go, { once: true });
    return () => {
      removeEventListener('load', go);
      if ('cancelIdleCallback' in window) cancelIdleCallback(id);
      clearTimeout(id);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pr-bg">
      {ready && (
        <GalleryTunnel
          background="#0A0A0A"
          lineColor="#4A4560"
          lineOpacity={50}
          grid={4}
          speed={reduceMotion ? 0 : 9}
          boost={reduceMotion ? 0 : boost}
          fade={fade}
          label={false}
          images={TUNNEL_IMAGES}
          colors={TUNNEL_COLORS}
          style={{ width: '100%', height: '100%' }}
        />
      )}
      {/* Soft center veil — stronger on desktop to match design wash */}
      <div className="pr-veil" />
    </div>
  );
};

function Btn({ href, label, wide }) {
  return (
    <a className={wide ? 'pr-btn pr-btn--wide' : 'pr-btn'} href={href}>
      <GlassSurface {...GLASS} width="100%" height="100%" borderRadius={999}>
        <span className="pr-btn-label">{label}</span>
      </GlassSurface>
    </a>
  );
}

// copy fades up out of a blur (GSAP, intro.js) at the original's delays
const HeroContent = () => (
  <div className="pr-content">
    {/* Soft veil so tunnel lines don’t fight the type */}
    <div aria-hidden="true" className="pr-content-veil" />
    <div className="pr-content-inner">
      <div className="pr-text">
        <h1 className="pr-title" data-reveal="0.12">Mé práce</h1>
        <p className="pr-lead" data-reveal="0.22">Weby, vizuální identity, motion grafika a tiskoviny.</p>
      </div>
      <div className="pr-btns" data-reveal="0.32">
        <Btn href="#galerie" label="Prohlédnout práce" wide />
        <Btn href="/o-mne/" label="O mně" />
      </div>
    </div>
  </div>
);

export default function Hero() {
  return (
    <section aria-label="Mé práce" className="pr-hero">
      <div className="pr-hero-inner">
        <PerspectiveBackground />
        <div className="pr-center">
          <HeroContent />
        </div>
      </div>
    </section>
  );
}
