import { hydrateRoot } from 'react-dom/client';
import App from './App.jsx';

// the markup is pre-rendered at build time (fast first paint, crawlable text); React takes over here
hydrateRoot(document.getElementById('root'), <App />);

// scroll cue (static markup outside React): shown only while the page sits at the top
const hint = document.querySelector('.tr-hint');
if (hint) {
  const sync = () => hint.classList.toggle('is-on', (document.scrollingElement || document.body).scrollTop < 24);
  sync();
  addEventListener('scroll', sync, { passive: true });
}
