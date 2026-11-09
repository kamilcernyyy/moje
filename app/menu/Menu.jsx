import { GooeyNavbar } from '@/components/ui/gooey-navbar';

// The site menu: Gooey Navbar (glass) top right. Label widths are measured in Inter 600 (the component's font) and
// fixed here, so the server-rendered menu and the live one are the same size before the font even arrives.
const LINKS = [
  { label: 'Úvod', link: '/' },
  { label: 'Mé práce', link: '/prace/' },
  { label: 'O mně', link: '/o-mne/' }
];
const ITEMS = LINKS.map((l, i) => ({ ...l, width: [92, 125, 98][i] })); // the prompt's defaults: 15 px, padding 24

const GLASS = { pillColor: 'rgba(20, 20, 24, 0.5)', textColor: 'rgba(242, 242, 243, 0.78)', hoverTextColor: '#ffffff' };
// the component keeps the click for itself (it only marks the tab): here the click goes to the page
const go = (i, item) => { if (item && item.link) location.href = item.link; };

// same size and shape everywhere (the prompt's defaults); only the anchor differs: top right on a computer grows to
// the left, centred on a phone grows both ways
export default function Menu({ active }) {
  return (
    <>
      <div className="gm-d">
        <GooeyNavbar items={ITEMS} activeIndex={active} defaultActiveIndex={active} onSelect={go} anchorEdge="right" {...GLASS} />
      </div>
      <div className="gm-m">
        <GooeyNavbar items={ITEMS} activeIndex={active} defaultActiveIndex={active} onSelect={go} anchorEdge="center" {...GLASS} />
      </div>
    </>
  );
}
