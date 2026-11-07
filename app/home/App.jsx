import TileReveal from './TileReveal.jsx';
import GlassSurface from '../glass/GlassSurface.jsx';

// Headpage: Tile Reveal with the Grafysta headline; after the tiles leave, the line and two glass buttons.
const ART = ['brana', 'citron', 'okveti', 'spektrum', 'posun', 'rovnovaha', 'prstenec', 'ohyb'];
const IMAGES = Array.from({ length: 12 }, (_, i) => `/assets/tiles/${ART[i % ART.length]}.webp`);
const GLASS = { distortionScale: -180, displace: 0.5, backgroundOpacity: 0.1 };

function Btn({ href, label }) {
  return (
    <a className="tr-btn" href={href}>
      <GlassSurface {...GLASS} width="100%" height="100%" borderRadius={999}>
        <span className="tr-btn-label">{label}</span>
      </GlassSurface>
    </a>
  );
}

export default function App() {
  return (
    <TileReveal images={IMAGES} headline={<h1 className="tr-headline">Váš grafický<br />stylista.</h1>}>
      <p className="tr-lead">Kreativní designerská práce na webu i v tisku.</p>
      <nav className="tr-btns" aria-label="Rozcestník">
        <Btn href="/o-mne/" label="O mně" />
        <Btn href="/prace/" label="Mé práce" />
      </nav>
    </TileReveal>
  );
}
