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
    var words = document.querySelectorAll('.q-w');
    if (!words.length) { end(); return; }
    // the rise runs in CSS from the first paint; once the last word has landed the words hold and leave upward.
    // The exit runs on the compositor (Web Animations, transform only), so the heavy badge/page mount that follows
    // can never freeze it, and the page is mounted only after the words are gone (it used to start mid-exit).
    var last = words[words.length - 1], started = false;
    function after() { root.classList.remove('qload'); requestAnimationFrame(function () { requestAnimationFrame(done); }); }
    function leave() {
      if (started) return;
      started = true;
      if (!words[0].animate) {
        var gsap = window.gsap;
        if (!gsap) { end(); return; }
        words.forEach(function (w) { w.style.animation = 'none'; });
        gsap.set(words, { yPercent: 0 });
        gsap.to(words, { yPercent: -115, duration: 0.55, ease: 'power3.in', stagger: 0.04, delay: 0.8, onComplete: after });
        return;
      }
      var runs = [];
      words.forEach(function (w, i) {
        w.style.animation = 'none';
        // power3.in
        runs.push(w.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-115%)' }],
          { duration: 550, delay: 800 + i * 40, easing: 'cubic-bezier(.55,.055,.675,.19)', fill: 'forwards' }).finished);
      });
      Promise.all(runs).then(after, after);
    }
    var anim = last.getAnimations ? last.getAnimations()[0] : null;
    if (anim && anim.finished) anim.finished.then(leave, leave); else last.addEventListener('animationend', leave, { once: true });
    setTimeout(leave, 1800);
  }

  run();
})();
