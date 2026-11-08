import { createRoot, hydrateRoot } from 'react-dom/client';
import Hero from './Hero.jsx';
import Wheel from './Wheel.jsx';

// hero-03 on top: markup pre-rendered at build time, React takes over here
hydrateRoot(document.getElementById('pr-hero'), <Hero />);

// the wheel of works below the fog flight (Radial Scroll Gallery)
const el = document.getElementById('pr-wheel');
if (el) createRoot(el).render(<Wheel />);
