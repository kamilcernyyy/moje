/* Headpage intro (GSAP): logo letters rise, the flame panel climbs in and its flame flares up,
   then the ribbon camera dives in on its own (the ribbon starts its tour 1.4 s after it is ready). */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('intro')) return;

  var started = false;
  function run() {
    if (started) return;
    started = true;
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
    // the panel is mounted after load; wait for it (up to ~2 s) and let it climb in
    var tries = 0;
    (function panelIn() {
      var panel = document.querySelector('.hp-panel, .hp-sheet');
      if (!panel && tries++ < 120) { requestAnimationFrame(panelIn); return; }
      if (!panel) return;
      gsap.fromTo(panel, { y: 64, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.95, ease: 'power3.out', delay: tries ? 0 : 0.35, clearProps: 'transform,opacity',
        onStart: function () { window.dispatchEvent(new Event('hp-intro')); }
      });
    })();
  }

  window.addEventListener('ribbon-ready', run, { once: true });
  // no WebGL or a slow device: play the intro anyway
  var fallback = function () { setTimeout(run, 2200); };
  if (document.readyState === 'complete') fallback(); else window.addEventListener('load', fallback, { once: true });
})();
