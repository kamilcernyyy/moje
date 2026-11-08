import { createRoot } from 'react-dom/client';
import { Component, useEffect, useRef, useState } from 'react';
import Lanyard from './Lanyard.jsx';
import WaveLettering from './WaveLettering.jsx';
import TumbleWall from './TumbleWall.js';
import FlexCarousel from '../fx/FlexCarousel.jsx';

// client logos as glass (scripts/glass-logo.py turns a black logo into these); placeholders until the real ones arrive
const LOGOS = [
  ['orbita', 'Orbita'], ['lipa', 'Lípa'], ['kovo', 'Kovo'], ['vlna', 'Vlna'], ['mlyn', 'Mlýn'], ['hora', 'Hora'],
  ['klas', 'Klas'], ['sklo', 'Sklo'], ['bod', 'Ateliér Bod'], ['vez', 'Věž'], ['para', 'Pára'], ['rybnik', 'Rybník']
].map(([file, title]) => ({ src: `/o-mne/logos/${file}.webp`, alt: `Logo ${title}`, title, file }));

// a logo's work on "Mé práce", when there is one (sample projects for now)
const WORK = { orbita: 'orbita-studio', lipa: 'lipa-bylinkarna', kovo: 'kovo-strojirna', vlna: 'vlna-festival', hora: 'hora-chata', klas: 'klas-pekarstvi', sklo: 'sklo-sklarna', para: 'para-kavarna' };

// záměr 4: tapping a logo lifts out the client's reference. The quotes are placeholders until real clients send them.
function Clients() {
  const ref = useRef(null);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let down = null;
    // the wall captures the pointer while dragging, so a short tap is detected here
    const onDown = e => {
      const piece = e.target.closest && e.target.closest('[data-tw-item]');
      down = piece ? { i: +piece.getAttribute('data-tw-item'), x: e.clientX, y: e.clientY, t: performance.now() } : null;
    };
    const onUp = e => {
      if (!down) return;
      const tap = performance.now() - down.t < 350 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8;
      if (tap) setSel(LOGOS[down.i % LOGOS.length]);
      down = null;
    };
    const onKey = e => {
      const piece = e.target.closest && e.target.closest('[data-tw-item]');
      if (piece && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSel(LOGOS[+piece.getAttribute('data-tw-item') % LOGOS.length]); }
    };
    el.addEventListener('pointerdown', onDown, true);
    addEventListener('pointerup', onUp, true);
    el.addEventListener('keydown', onKey);
    return () => { el.removeEventListener('pointerdown', onDown, true); removeEventListener('pointerup', onUp, true); el.removeEventListener('keydown', onKey); };
  }, []);
  useEffect(() => {
    if (!sel) return;
    const onKey = e => { if (e.key === 'Escape') setSel(null); };
    addEventListener('keydown', onKey);
    const card = ref.current && ref.current.querySelector('.om-ref');
    if (card && window.gsap) window.gsap.fromTo(card, { opacity: 0, y: 24, scale: 0.96, filter: 'blur(6px)' }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.55, ease: 'power3.out' });
    const close = card && card.querySelector('.om-ref-x');
    if (close) close.focus({ preventScroll: true });
    return () => removeEventListener('keydown', onKey);
  }, [sel]);
  const slug = sel && WORK[sel.file];
  return (
    <section className="om-clients" aria-label="Klienti" ref={ref}>
      <TumbleWall items={LOGOS} count={LOGOS.length} shape="circle" size={150} ariaLabel="Loga klientů" />
      <p className="om-clients-hint">Klepněte na logo</p>
      {sel ? (
        <aside className="om-ref" role="dialog" aria-label={`Reference: ${sel.title}`} key={sel.file}>
          <button className="om-ref-x" type="button" aria-label="Zavřít" onClick={() => setSel(null)}>×</button>
          <img src={sel.src} alt="" width="72" height="72" />
          <div>
            <p className="om-ref-name">{sel.title}</p>
            <blockquote>Sem přijde citát klienta, jakmile ho pošle.</blockquote>
            {slug ? <a href={`/prace/${slug}/`}>Zobrazit projekt →</a> : null}
          </div>
        </aside>
      ) : null}
    </section>
  );
}

// without WebGL the badge can't hang on its lanyard: the card itself is shown, still
const CARD = <img className="om-badge-still" src="/o-mne/card-front.webp" alt="Grafysta, grafický designér a webdeveloper" width="1024" height="1440" />;
const hasGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
class Badge extends Component {
  constructor(p) { super(p); this.state = { failed: !hasGL }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? CARD : <Lanyard frontImage="/o-mne/card-front.webp" />; }
}

// "Vybrané práce": the work covers in the React Bits FlexCarousel (liquid + rise); the centred card opens its work.
// Mounted when the section comes near, so its images and WebGL never compete with the badge.
const PRACE = (() => { try { return JSON.parse(document.getElementById('om-prace').textContent); } catch (e) { return []; } })();
const NARROW = matchMedia('(max-width: 760px)').matches; // phone: the glass edge sits outside the centred card
const hasGL2 = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } })();
function Works() {
  const ref = useRef(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setNear(true); return undefined; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => { const c = ref.current && ref.current.querySelector('.flex-carousel'); if (c) c.setAttribute('aria-label', 'Vybrané práce'); });
  if (!PRACE.length) return null;
  if (!hasGL2) return (
    <section className="om-works" aria-labelledby="om-works-h">
      <div className="om-works-head"><h2 id="om-works-h">Vybrané práce</h2><p><a href="/prace/">Všechny práce →</a></p></div>
      <ul className="om-works-list">{PRACE.map(w => <li key={w.href}><a href={w.href}>{w.title}</a> <span>{w.subtitle}</span></li>)}</ul>
    </section>
  );
  return (
    <section className="om-works" aria-labelledby="om-works-h">
      <div className="om-works-head">
        <h2 id="om-works-h">Vybrané práce</h2>
        <p>Klepni na práci uprostřed · <a href="/prace/">Všechny práce →</a></p>
      </div>
      <div className="om-works-stage" ref={ref}>
        {near ? (
          <FlexCarousel items={PRACE} preset="liquid" intro="rise" cardHeight={NARROW ? 0.4 : 0.56} lensWidth={NARROW ? 1.02 : undefined} gap={12} squeeze={0.2}
            focusOnClick={false} captureWheel={false} captions onSelect={(i, item) => { if (item && item.href) location.href = item.href; }} />
        ) : null}
      </div>
    </section>
  );
}

const root = createRoot(document.getElementById('root'));
const show = () => root.render(
  <>
    <div className="om-badge">
      <Badge />
    </div>
    <Works />
    {/* clients: their logos rain in as glass pieces and can be thrown around */}
    <Clients />
    {/* footer at the very end of the page: a sea of Grafysta lettering */}
    <footer className="om-footer">
      <WaveLettering text="GRAFYSTA · VÁŠ GRAFICKÝ STYLISTA ·" fontWeight={400} />
    </footer>
  </>
);

// the badge drops right after the question loader clears (or at once when there is no loader)
if (!document.documentElement.classList.contains('qload') || window.__qDone) show();
else window.addEventListener('q-done', show, { once: true });
