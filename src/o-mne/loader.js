/* O mně loader (GSAP): "Kdo jsem a proč se mnou?" rises word by word from a mask, holds,
   then leaves upward like a curtain; the Lanyard badge mounts (and drops) as the words clear. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('qload')) return;

  function done() {
    if (window.__qDone) return;
    window.__qDone = 1;
    window.dispatchEvent(new Event('q-done'));
  }
  function end() { root.classList.remove('qload'); done(); }

  function run() {
    var gsap = window.gsap;
    var text = document.querySelector('.q-loader p');
    var words = document.querySelectorAll('.q-w');
    if (!gsap || !text || !words.length) { end(); return; }
    gsap.timeline({ onComplete: end })
      .set(text, { visibility: 'visible' })
      .fromTo(words, { yPercent: 115 }, { yPercent: 0, duration: 0.7, ease: 'power3.out', stagger: 0.1 })
      .to(words, { yPercent: -115, duration: 0.55, ease: 'power3.in', stagger: 0.04 }, '+=0.8')
      .call(done, null, '-=0.2');
  }

  // start once the font is ready (max 1.2 s), so the question never swaps fonts mid-animation
  var fonts = document.fonts;
  var ready = fonts && fonts.load
    ? Promise.race([fonts.load('400 1em "Odibee Sans CZ"'), new Promise(function (r) { setTimeout(r, 1200); })])
    : Promise.resolve();
  ready.then(run, run);
})();
