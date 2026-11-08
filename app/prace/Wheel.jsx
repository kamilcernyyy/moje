import { useEffect, useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { RadialScrollGallery } from '@/components/ui/portfolio-and-image-gallery';
import { Badge } from '@/components/ui/badge';

// "Mé práce": the works on the 21st.dev Radial Scroll Gallery, a wheel that turns with the scroll (it replaced the
// Depth Ribbon). Cards follow the component's demo, in Grafysta type and colours; a card opens its work.

const WORKS = window.__PRACE || [];
const N = WORKS.length;
// the wheel starts with its 3 o'clock item at index 0 and turns clockwise: the item nearest the top (270°) is shown
// first, and every next work comes up from the left as the page scrolls
const TOP = Math.round(N * 0.75) % Math.max(N, 1);
const ORDER = WORKS.map((_, i) => WORKS[(TOP - i + N) % N]);

// the component starts at baseRadius and switches to mobileRadius after mounting; on a phone that switch makes its
// GSAP intro restore the desktop positions, so a phone gets the phone radius from the very first render
const PHONE = window.innerWidth < 768;
const RADIUS = { desk: 540, phone: 230 };

// the detail then opens out of the fog (dive-in on the detail page)
const open = w => {
  if (!w) return;
  try { sessionStorage.setItem('dive', w.slug); } catch (e) {}
  location.href = `/prace/${w.slug}/`;
};

export default function Wheel() {
  const ref = useRef(null);

  // back from a detail page (?k=slug): scroll the wheel so that this work sits at the top
  useEffect(() => {
    const k = new URLSearchParams(location.search).get('k');
    const i = ORDER.findIndex(w => w.slug === k);
    const ST = window.ScrollTrigger;
    if (i < 0 || !ST || !ref.current) return undefined;
    const go = () => {
      const t = ST.getAll().find(s => s.pin === ref.current);
      if (!t) return false;
      const turn = (((270 - (i / N) * 360) % 360) + 360) % 360 / 360;
      window.scrollTo(0, Math.round(t.start + turn * (t.end - t.start)));
      return true;
    };
    let tries = 0;
    const id = setInterval(() => { if (go() || ++tries > 40) clearInterval(id); }, 50);
    return () => clearInterval(id);
  }, []);

  if (!N) return null;
  return (
    <RadialScrollGallery
      ref={ref}
      className="pr-wheel"
      baseRadius={PHONE ? RADIUS.phone : RADIUS.desk}
      mobileRadius={RADIUS.phone}
      visiblePercentage={50}
      scrollDuration={2600}
      onItemSelect={i => open(ORDER[i])}
      role="region"
      aria-label="Kolo prací"
    >
      {hoveredIndex =>
        ORDER.map((w, index) => {
          const isActive = hoveredIndex === index;
          return (
            <div
              key={w.slug}
              className="group relative w-[140px] h-[196px] sm:w-[240px] sm:h-[320px] overflow-hidden rounded-xl bg-card border border-border shadow-lg"
            >
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src={w.obal}
                  alt={w.nazev}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className={`h-full w-full object-cover transition-transform duration-700 ease-out ${
                    isActive ? 'scale-110 blur-0' : 'scale-100 blur-[1px] grayscale-[30%]'
                  }`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/10 to-transparent opacity-60" />
              </div>

              <div className="absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
                <div className="flex justify-between items-start gap-2">
                  <Badge variant="secondary" className="pr-wheel-badge text-[11px] sm:text-[13px] px-2 sm:px-2.5 py-0.5 bg-background/80 backdrop-blur">
                    {w.ukazka ? 'Ukázka' : w.typLabel}
                  </Badge>
                  <div className={`w-6 h-6 sm:w-7 sm:h-7 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-all duration-500 ${isActive ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-45'}`}>
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </div>
                </div>

                <div className={`transition-transform duration-500 ${isActive ? 'translate-y-0' : 'translate-y-2'}`}>
                  <h3 className="pr-wheel-title m-0 text-[22px] sm:text-[34px] leading-[.9] text-foreground">{w.nazev}</h3>
                  <p className="pr-wheel-meta m-0 mt-1 sm:mt-1.5 text-[11px] sm:text-[15px] text-foreground/70">{w.meta}</p>
                  <div className={`h-0.5 bg-primary mt-2 transition-all duration-500 ${isActive ? 'w-full opacity-100' : 'w-0 opacity-0'}`} />
                </div>
              </div>
            </div>
          );
        })
      }
    </RadialScrollGallery>
  );
}
