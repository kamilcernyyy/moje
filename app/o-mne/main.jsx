import { createRoot } from 'react-dom/client';
import Lanyard from './Lanyard.jsx';
import WaveLettering from './WaveLettering.jsx';
import TumbleWall from './TumbleWall.js';

// client logos as glass (scripts/glass-logo.py turns a black logo into these); placeholders until the real ones arrive
const LOGOS = [
  ['orbita', 'Orbita'], ['lipa', 'Lípa'], ['kovo', 'Kovo'], ['vlna', 'Vlna'], ['mlyn', 'Mlýn'], ['hora', 'Hora'],
  ['klas', 'Klas'], ['sklo', 'Sklo'], ['bod', 'Ateliér Bod'], ['vez', 'Věž'], ['para', 'Pára'], ['rybnik', 'Rybník']
].map(([file, title]) => ({ src: `/o-mne/logos/${file}.webp`, alt: `Logo ${title}`, title }));

const root = createRoot(document.getElementById('root'));
const show = () => root.render(
  <>
    <div className="om-badge">
      <Lanyard frontImage="/o-mne/card-front.webp" />
    </div>
    {/* clients: their logos rain in as glass pieces and can be thrown around */}
    <section className="om-clients" aria-label="Klienti">
      <TumbleWall items={LOGOS} count={LOGOS.length} shape="circle" size={150} ariaLabel="Loga klientů" />
    </section>
    {/* footer at the very end of the page: a sea of Grafysta lettering */}
    <footer className="om-footer">
      <WaveLettering text="GRAFYSTA · VÁŠ GRAFICKÝ STYLISTA ·" fontWeight={400} />
    </footer>
  </>
);

// the badge drops right after the question loader clears (or at once when there is no loader)
if (!document.documentElement.classList.contains('qload') || window.__qDone) show();
else window.addEventListener('q-done', show, { once: true });
