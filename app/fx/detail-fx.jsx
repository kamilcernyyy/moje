import { createRoot } from 'react-dom/client';
import { useEffect, useRef } from 'react';
import ElectricBorder from './ElectricBorder.jsx';
import FlexCarousel from './FlexCarousel.jsx';
import { ELECTRIC } from './brand.js';

// React Bits effects on the work details, fetched only when the end of the page comes near (detail.js).

// Booking CTA: the server-rendered link stays for crawlers and no-JS, here it is swapped for the same link
// wrapped in the Electric Border.
for (const a of document.querySelectorAll('[data-electric]')) {
  const host = document.createElement('div');
  host.className = 'eb-host';
  a.replaceWith(host);
  createRoot(host).render(
    <ElectricBorder {...ELECTRIC} borderRadius={999}>
      <a className={a.className} href={a.getAttribute('href')}>{a.textContent}</a>
    </ElectricBorder>
  );
}

// "Všechny obrázky": FlexCarousel (liquid + rise) over the justified rows, which stay for crawlers and without WebGL2.
const hasGL2 = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } })();

// on a phone the cards stay narrower than the screen, so the bend has room on both sides
const NARROW = matchMedia('(max-width: 760px)').matches;

function Gallery({ items }) {
  const ref = useRef(null);
  // the carousel names itself in English; on this page it is the work's gallery
  useEffect(() => { const el = ref.current && ref.current.querySelector('.flex-carousel'); if (el) el.setAttribute('aria-label', 'Galerie: všechny obrázky práce'); }, []);
  return (
    <div className="g-flex" ref={ref}>
      <FlexCarousel items={items} preset="liquid" intro="rise" cardHeight={NARROW ? 0.38 : 0.5} lensWidth={NARROW ? 1.02 : undefined} gap={12} squeeze={0.2} focusOnClick captureWheel={false} captions />
    </div>
  );
}

const gal = document.querySelector('.dt-gallery[data-flex]');
if (gal && hasGL2) {
  let items = [];
  try { items = JSON.parse(gal.getAttribute('data-flex')); } catch (e) {}
  if (items.length > 1) {
    const host = document.createElement('div');
    host.className = 'g-host';
    gal.before(host);
    gal.hidden = true;
    createRoot(host).render(<Gallery items={items} />);
  }
}
