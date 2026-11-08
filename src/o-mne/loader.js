/* O mně loader: "Kdo jsem a proč se mnou?" rises word by word from a mask (CSS), holds,
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
    var words = document.querySelectorAll('.q-w');
    if (!gsap || !words.length) { end(); return; }
    // the rise runs in CSS from the first paint; once the last word has landed, GSAP takes over for the hold and the exit
    var last = words[words.length - 1], started = false;
    function leave() {
      if (started) return;
      started = true;
      words.forEach(function (w) { w.style.animation = 'none'; });
      gsap.set(words, { yPercent: 0 });
      gsap.timeline({ onComplete: end })
        .to(words, { yPercent: -115, duration: 0.55, ease: 'power3.in', stagger: 0.04 }, '+=0.8')
        .call(done, null, '-=0.2');
    }
    var anim = last.getAnimations ? last.getAnimations()[0] : null;
    if (anim && anim.finished) anim.finished.then(leave, leave); else last.addEventListener('animationend', leave, { once: true });
    setTimeout(leave, 1800);
  }

  run();
})();
