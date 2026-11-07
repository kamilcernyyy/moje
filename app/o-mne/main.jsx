import { createRoot } from 'react-dom/client';
import Lanyard from './Lanyard.jsx';
import WaveLettering from './WaveLettering.jsx';

const root = createRoot(document.getElementById('root'));
const show = () => root.render(
  <>
    <div className="om-badge">
      <Lanyard frontImage="/o-mne/card-front.webp" />
    </div>
    {/* footer at the very end of the page: a sea of Grafysta lettering */}
    <footer className="om-footer">
      <WaveLettering text="GRAFYSTA · VÁŠ GRAFICKÝ STYLISTA ·" fontWeight={400} />
    </footer>
  </>
);

// the badge drops right after the question loader clears (or at once when there is no loader)
if (!document.documentElement.classList.contains('qload') || window.__qDone) show();
else window.addEventListener('q-done', show, { once: true });
