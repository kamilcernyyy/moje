/* "Mé práce" intro (GSAP): logo letters rise (the hero copy reveal is CSS, so it paints without waiting for scripts);
   the flame panel climbs in (and its flame flares up) once the ribbon gallery scrolls into view. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('intro')) return;
  var gsap = window.gsap;
  var logo = document.querySelector('.hp-logo');
  if (!gsap || !logo) { root.classList.remove('intro'); return; }

  // split the wordmark into letters inside a clipping line
  var text = logo.textContent;
  logo.innerHTML = '<span class="sr-only">' + text + '</span><span class="hp-logo-line" aria-hidden="true">' +
    text.split('').map(function (c) { return '<span class="ch">' + c + '</span>'; }).join('') + '</span>';
  var chars = logo.querySelectorAll('.ch');

  var tl = gsap.timeline({
    defaults: { ease: 'power3.out' },
    onComplete: function () { root.classList.remove('intro'); }
  });
  tl.set(logo, { visibility: 'visible' })
    .fromTo(chars, { yPercent: 115 }, { yPercent: 0, duration: 0.8, stagger: 0.045 }, 0);

  // the panel mounts after load; hold it down until the gallery is on screen, then let it climb in
  var tries = 0;
  (function panelIn() {
    var panel = document.querySelector('.hp-panel, .hp-sheet');
    if (!panel && tries++ < 600) { requestAnimationFrame(panelIn); return; }
    if (!panel) return;
    gsap.set(panel, { y: 64, opacity: 0 });
    var shown = false;
    var show = function () {
      if (shown) return;
      shown = true;
      gsap.to(panel, {
        y: 0, opacity: 1, duration: 0.95, ease: 'power3.out', clearProps: 'transform,opacity',
        onStart: function () { window.dispatchEvent(new Event('hp-intro')); }
      });
    };
    // the fog flight hands the gallery over itself
    if (root.classList.contains('fly')) { window.addEventListener('pr-gallery-in', show, { once: true }); return; }
    var gallery = document.querySelector('.pr-gallery');
    if (!gallery || !('IntersectionObserver' in window)) { show(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].intersectionRatio >= 0.35) { io.disconnect(); show(); }
    }, { threshold: [0, 0.35] });
    io.observe(gallery);
  })();
})();
