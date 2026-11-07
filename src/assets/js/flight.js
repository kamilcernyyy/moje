/* "Mé práce": flight through fog (GSAP ScrollTrigger). One screen-high stage stays put (CSS sticky) while the scroll
   steers the real cameras: first half, the hero-03 tunnel camera flies ahead until the tunnel dissolves into fog of
   the background colour; at the midpoint, inside that fog, the picture is handed to the ribbon; second half, the ribbon
   camera arrives from deep in the same fog to its usual shot. Both scenes share the background and fog, so the
   hand-over is invisible and it reads as one continuous flight. Scrubbed both ways. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('fly')) return;
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  var track = document.querySelector('.pr-track');
  var hero = document.getElementById('pr-hero');
  var gallery = document.querySelector('.pr-gallery');
  // no GSAP: fall back to the plain stacked page
  if (!gsap || !ST || !track || !hero || !gallery) { root.classList.remove('fly'); return; }
  gsap.registerPlugin(ST);
  ST.config({ ignoreMobileResize: true });

  var clamp = gsap.utils.clamp(0, 1);
  var easeIn = gsap.parseEase('power2.in');
  var easeOut = gsap.parseEase('power2.out');
  var state = { p: 0 };
  var last = { fly: -1, arrive: -1, side: '' };
  var panelShown = false;

  function apply() {
    var p = state.p;
    var side = p < 0.5 ? 'tunnel' : 'ribbon';
    var a = clamp(p / 0.5);              // tunnel half
    var b = clamp((p - 0.5) / 0.5);      // ribbon half
    var fly = easeIn(a);
    var arrive = side === 'ribbon' ? 1 - easeOut(b) : 1;

    // the copy flies past the camera and is gone before the fog closes
    var content = hero.querySelector('.pr-content');
    if (content) {
      var c = clamp(a / 0.6);
      gsap.set(content, { opacity: 1 - c, scale: 1 + c * 0.7, filter: 'blur(' + (c * 8).toFixed(2) + 'px)' });
    }
    if (Math.abs(fly - last.fly) > 1e-4) {
      last.fly = fly;
      window.__tunnelFly = fly;
      window.dispatchEvent(new CustomEvent('tunnel-fly', { detail: fly }));
    }
    var ribbon = window.__ribbon;
    if (ribbon && ribbon.setArrive && Math.abs(arrive - last.arrive) > 1e-4) { last.arrive = arrive; ribbon.setArrive(arrive); }

    // hand-over inside the fog: the scene that isn't on screen moves out of the stage (and stops drawing)
    if (side !== last.side) {
      last.side = side;
      gsap.set(hero, { y: 0, yPercent: side === 'tunnel' ? 0 : -100 });
      gsap.set(gallery, { y: 0, yPercent: side === 'ribbon' ? 0 : 100 }); // y: 0 drops the CSS start offset
    }
    if (!panelShown && b > 0.8) { panelShown = true; window.dispatchEvent(new Event('pr-gallery-in')); }
  }

  var to = gsap.quickTo(state, 'p', { duration: 0.7, ease: 'power3', onUpdate: apply });
  var trigger = ST.create({ trigger: track, start: 'top top', end: 'bottom bottom', onUpdate: function (self) { to(self.progress); } });
  // the ribbon boots after load; hand it the current arrival as soon as it exists
  window.addEventListener('ribbon-ready', function () { last.arrive = -1; apply(); });
  state.p = trigger.progress;
  apply();

  // "Prohlédnout práce": fly the whole way down to the gallery
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href="#galerie"]');
    if (!link) return;
    e.preventDefault();
    window.scrollTo({ top: trigger.end, behavior: 'smooth' });
  });
})();
