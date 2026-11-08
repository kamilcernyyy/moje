import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import TumbleWall from '../o-mne/TumbleWall.js';
import './detail-tisk.css';

// "Tiskový stůl" (detail of a print project): the pieces lie on a dark desk seen from above and can be thrown around
// (Tumble Wall, no gravity). A click lifts a piece into view with a loupe; a brochure can be leafed through.

function Loupe({ src, alt }) {
  const box = useRef(null);
  const [lens, setLens] = useState(null);
  const ZOOM = 2.6, SIZE = 190;
  const move = e => {
    const r = box.current.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) return setLens(null);
    setLens({ x, y, w: r.width, h: r.height });
  };
  return (
    <div className="lb-loupe" ref={box} onPointerMove={move} onPointerLeave={() => setLens(null)}>
      <img src={src} alt={alt} draggable={false} />
      {lens && (
        <span className="lb-lens" aria-hidden="true" style={{
          width: SIZE, height: SIZE, left: lens.x - SIZE / 2, top: lens.y - SIZE / 2,
          backgroundImage: `url(${src})`, backgroundSize: `${lens.w * ZOOM}px ${lens.h * ZOOM}px`,
          backgroundPosition: `${-(lens.x * ZOOM - SIZE / 2)}px ${-(lens.y * ZOOM - SIZE / 2)}px`
        }} />
      )}
    </div>
  );
}

function Book({ pages, name }) {
  const [leaf, setLeaf] = useState(0);              // spread index: left = pages[2l-1], right = pages[2l]
  const [turn, setTurn] = useState(null);           // { dir: 1 | -1 }
  const sheet = useRef(null);
  const last = Math.ceil((pages.length - 1) / 2);
  const flip = useCallback(dir => {
    if (turn) return;
    if (dir > 0 && leaf >= last) return;
    if (dir < 0 && leaf <= 0) return;
    setTurn({ dir });
  }, [turn, leaf, last]);
  useEffect(() => {
    if (!turn || !sheet.current) return;
    const g = window.gsap;
    const done = () => { setLeaf(l => l + turn.dir); setTurn(null); };
    const from = turn.dir > 0 ? 0 : -180, to = turn.dir > 0 ? -180 : 0;
    if (!g || matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
    g.fromTo(sheet.current, { rotateY: from }, { rotateY: to, duration: 0.9, ease: 'power2.inOut', onComplete: done });
  }, [turn]);
  useEffect(() => {
    const key = e => { if (e.key === 'ArrowRight') { e.preventDefault(); flip(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); flip(-1); } };
    addEventListener('keydown', key, true);
    return () => removeEventListener('keydown', key, true);
  }, [flip]);

  const p = i => (i >= 0 && i < pages.length ? pages[i] : null);
  let left = p(2 * leaf - 1), right = p(2 * leaf), front = null, back = null;
  if (turn && turn.dir > 0) { right = p(2 * leaf + 2); front = p(2 * leaf); back = p(2 * leaf + 1); }
  if (turn && turn.dir < 0) { left = p(2 * leaf - 3); front = p(2 * leaf - 2); back = p(2 * leaf - 1); }
  const page = (src, cls) => src ? <img className={cls} src={src} alt="" draggable={false} /> : <span className={cls + ' is-empty'} />;
  return (
    <div className="lb-book" aria-label={`${name}, brožura`}>
      <div className="bk-spread">
        <button type="button" className="bk-half bk-left" onClick={() => flip(-1)} aria-label="Předchozí dvoustrana" disabled={leaf <= 0}>{page(left, 'bk-page')}</button>
        <button type="button" className="bk-half bk-right" onClick={() => flip(1)} aria-label="Další dvoustrana" disabled={leaf >= last}>{page(right, 'bk-page')}</button>
        {turn && (
          <div className="bk-sheet" ref={sheet}>
            {page(front, 'bk-face bk-front')}
            {page(back, 'bk-face bk-back')}
          </div>
        )}
      </div>
      <p className="bk-count">{leaf === 0 ? 'Obálka' : `${2 * leaf}–${Math.min(2 * leaf + 1, pages.length)} / ${pages.length}`} · klikni na stranu nebo použij šipky</p>
    </div>
  );
}

function Lightbox({ item, pages, name, onClose }) {
  const [book, setBook] = useState(false);
  const closeRef = useRef(null);
  useEffect(() => {
    const key = e => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();   // stay in the lightbox, not the next project
    };
    addEventListener('keydown', key, true);
    closeRef.current && closeRef.current.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', key, true); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label={book ? `${name}, brožura` : item.alt} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lb-bar">
        {pages.length > 0 && (
          <div className="lb-tabs" role="group" aria-label="Zobrazení">
            <button type="button" aria-pressed={!book} onClick={() => setBook(false)}>Detail s lupou</button>
            <button type="button" aria-pressed={book} onClick={() => setBook(true)}>Prolistovat brožuru</button>
          </div>
        )}
        <button type="button" className="lb-close" ref={closeRef} onClick={onClose}>Zavřít <span aria-hidden="true">✕</span></button>
      </div>
      {book ? <Book pages={pages} name={name} /> : <Loupe src={item.src} alt={item.alt} />}
    </div>
  );
}

function Desk({ pieces, shown, pages, name }) {
  const [sel, setSel] = useState(null);
  // on the desk every piece lies upright in a card (a landscape card is turned on its side); the lightbox shows it as made
  const items = pieces.map((src, i) => ({ src: shown[i] || src, full: src, alt: `${name}, tiskovina ${i + 1}`, title: '' }));
  const lift = item => item && setSel({ ...item, src: item.full || item.src });
  const wrap = useRef(null);
  // a short tap on a piece lifts it into the lightbox (the wall captures the pointer while dragging, so clicks
  // don't reach the piece itself); keyboard Enter / Space still goes through the wall's own onSelect
  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    let down = null;
    const onDown = e => {
      const piece = e.target.closest && e.target.closest('[data-tw-item]');
      down = piece ? { i: +piece.getAttribute('data-tw-item'), x: e.clientX, y: e.clientY, t: performance.now() } : null;
    };
    const onUp = e => {
      if (!down) return;
      const tap = performance.now() - down.t < 350 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8;
      if (tap) lift(items[down.i % items.length]);
      down = null;
    };
    el.addEventListener('pointerdown', onDown, true);
    addEventListener('pointerup', onUp, true);
    return () => { el.removeEventListener('pointerdown', onDown, true); removeEventListener('pointerup', onUp, true); };
  }, [items.length]);
  return (
    <div ref={wrap} style={{ position: 'absolute', inset: 0 }}>
      <TumbleWall items={items} count={Math.min(14, items.length * 2)} shape="card" size={190} sizeVariance={0.5} radius={5} frame="none"
        showTitles={false} shadow={1} gravity={0} gravityX={0} drift={0.25} airFriction={0.05} bounce={0.4} spin={0.8}
        entrance="burst" ariaLabel={`${name}, tiskoviny na stole`} onSelect={lift} />
      {sel && <Lightbox item={sel} pages={pages} name={name} onClose={() => setSel(null)} />}
    </div>
  );
}

// a landscape piece (a business card…) is turned a quarter, so the portrait card on the desk shows all of it
function upright(src) {
  return fetch(src).then(r => r.blob()).then(b => createImageBitmap(b)).then(bmp => {
    if (bmp.width <= bmp.height) return src;
    const c = document.createElement('canvas');
    c.width = bmp.height; c.height = bmp.width;
    const g = c.getContext('2d');
    g.translate(c.width, 0); g.rotate(Math.PI / 2); g.drawImage(bmp, 0, 0);
    return new Promise(res => c.toBlob(b => res(b ? URL.createObjectURL(b) : src), 'image/webp', 0.92));
  }).catch(() => src);
}

const host = document.querySelector('.desk');
if (host) {
  let pieces = [], pages = [];
  try { pieces = JSON.parse(host.dataset.pieces || '[]'); pages = JSON.parse(host.dataset.pages || '[]'); } catch (e) {}
  const mount = () => {
    host.classList.add('is-live');
    const el = document.createElement('div');
    el.className = 'desk-live';
    host.appendChild(el);
    Promise.all(pieces.map(upright)).then(shown => createRoot(el).render(<Desk pieces={pieces} shown={shown} pages={pages} name={host.dataset.name || ''} />));
  };
  // mount when the desk comes near the screen
  const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { io.disconnect(); mount(); } }, { rootMargin: '300px' });
  io.observe(host);
}
