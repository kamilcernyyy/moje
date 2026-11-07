/* "Mé práce": crane-down camera move (GSAP ScrollTrigger). The stage stays put (CSS sticky) for one screen of scroll
   while the hero-03 tunnel tilts up and away and the ribbon gallery rises from below into the shot, scrubbed both ways. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('crane')) return;
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  var track = document.querySelector('.pr-track');
  var hero = document.getElementById('pr-hero');
  var gallery = document.querySelector('.pr-gallery');
  // no GSAP: fall back to the plain stacked page
  if (!gsap || !ST || !track || !hero || !gallery) { root.classList.remove('crane'); return; }

  gsap.registerPlugin(ST);
  ST.config({ ignoreMobileResize: true });

  gsap.set(hero, { transformOrigin: '50% 100%' });
  gsap.set(gallery, { transformOrigin: '50% 0%', y: 0, yPercent: 100, rotateX: -62 }); // y: 0 drops the CSS start offset

  var tl = gsap.timeline({
    defaults: { ease: 'power2.inOut', duration: 1 },
    scrollTrigger: { trigger: track, start: 'top top', end: 'bottom bottom', scrub: 0.6 }
  });
  tl.to(hero, { yPercent: -100, rotateX: 62 }, 0)
    .to(hero, { opacity: 0.2, ease: 'power1.in', duration: 0.5 }, 0.5)
    .to(gallery, { yPercent: 0, rotateX: 0 }, 0);

  // "Prohlédnout práce": ride the crane down to the gallery instead of jumping to the anchor
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href="#galerie"]');
    if (!link) return;
    e.preventDefault();
    window.scrollTo({ top: tl.scrollTrigger.end, behavior: 'smooth' });
  });
})();
