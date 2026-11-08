import { createRoot } from 'react-dom/client';
import ElectricBorder from './ElectricBorder.jsx';
import { ELECTRIC } from './brand.js';

// Booking CTAs on static pages (work details): the server-rendered link stays for crawlers and no-JS,
// here it is swapped for the same link wrapped in the React Bits Electric Border.
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
