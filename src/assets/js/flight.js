/* "Mé práce": flight through fog (GSAP ScrollTrigger). The hero stage stays put (CSS sticky) while the scroll flies
   the hero-03 tunnel camera ahead until the tunnel dissolves into fog of the background colour; the wheel of works
   below then comes up out of that same fog (its cards rise in on their own). Scrubbed both ways. */
(function () {
  'use strict';
  var root = document.documentElement;
  var gallery = document.getElementById('galerie');
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;

  // "Prohlédnout práce" and the way back from a detail: down to the wheel
  var toGallery = function (smooth) {
    if (!gallery) return;
    window.scrollTo({ top: gallery.getBoundingClientRect().top + window.scrollY, behavior: smooth ? 'smooth' : 'auto' });
  };
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href="#galerie"]');
    if (!link) return;
    e.preventDefault();
    toGallery(true);
  });

  if (!root.classList.contains('fly')) return;
  var track = document.querySelector('.pr-track');
  var hero = document.getElementById('pr-hero');
  // no GSAP: fall back to the plain stacked page
  if (!gsap || !ST || !track || !hero || !gallery) { root.classList.remove('fly'); return; }
  gsap.registerPlugin(ST);
  ST.config({ ignoreMobileResize: true });

  var clamp = gsap.utils.clamp(0, 1);
  var easeIn = gsap.parseEase('power2.in');
  var state = { p: 0 };
  var last = -1;
  var content = hero.querySelector('.pr-content');

  function apply() {
    var p = state.p;
    var fly = easeIn(p);
    // the copy flies past the camera and is gone before the fog closes
    if (content) {
      var c = clamp(p / 0.6);
      gsap.set(content, { opacity: 1 - c, scale: 1 + c * 0.7, filter: 'blur(' + (c * 8).toFixed(2) + 'px)' });
    }
    if (Math.abs(fly - last) > 1e-4) {
      last = fly;
      window.__tunnelFly = fly;
      window.dispatchEvent(new CustomEvent('tunnel-fly', { detail: fly }));
    }
  }

  var to = gsap.quickTo(state, 'p', { duration: 0.7, ease: 'power3', onUpdate: apply });
  var trigger = ST.create({ trigger: track, start: 'top top', end: 'bottom bottom', onUpdate: function (self) { to(self.progress); } });
  state.p = trigger.progress;
  apply();

  // the gallery heading clears out of the fog as it comes up (opacity only: the wheel pins itself inside)
  var head = gallery.querySelector('.pr-gallery-head');
  if (head) gsap.fromTo(head, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, ease: 'none', scrollTrigger: { trigger: gallery, start: 'top bottom', end: 'top 35%', scrub: 0.6 } });

  // back from a detail page (?k=…): straight to the wheel (Wheel.jsx then turns it to that work)
  if (/[?&]k=/.test(location.search)) { state.p = 1; to(1); apply(); toGallery(false); }
})();
