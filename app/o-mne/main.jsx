import { createRoot } from 'react-dom/client';
import Lanyard from './Lanyard.jsx';

const root = createRoot(document.getElementById('root'));
const show = () => root.render(
  <div style={{ width: '100%', height: '100%' }}>
    <Lanyard frontImage="/o-mne/card-front.webp" />
  </div>
);

// the badge drops right after the question loader clears (or at once when there is no loader)
if (!document.documentElement.classList.contains('qload') || window.__qDone) show();
else window.addEventListener('q-done', show, { once: true });
