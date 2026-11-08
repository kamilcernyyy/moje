/* Grafysta, every page: glass cursor (desktop), a playful wordmark, and the way back into the ribbon. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // glass cursor: a small lens that trails the pointer and swells over anything you can open (záměr 11)
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce) {
    var cur = document.createElement('div');
    cur.className = 'gcur';
    cur.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cur);
    var x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y, raf = 0, last = null;
    cur.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
    var tick = function () {
      cx += (x - cx) * 0.28; cy += (y - cy) * 0.28;
      cur.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.3 ? requestAnimationFrame(tick) : 0;
    };
    addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || (!e.clientX && !e.clientY)) return;
      x = e.clientX; y = e.clientY;
      if (!cur.classList.contains('is-on')) { cx = x; cy = y; }
      cur.classList.add('is-on');
      if (!raf) raf = requestAnimationFrame(tick);
      var t = e.target;
      if (t === last) return;
      last = t;
      var inRibbon = t && t.closest && t.closest('#depth-ribbon');
      var open = t && t.closest && (t.closest('a, button, [role="button"], [data-tw-item], .live-pin') || (inRibbon && getComputedStyle(t).cursor === 'pointer'));
      cur.classList.toggle('is-big', !!open);
      cur.textContent = inRibbon && open ? 'Otevřít' : '';
    }, { passive: true });
    // the ribbon changes its own cursor without moving the target: re-check on every move over it
    addEventListener('pointermove', function (e) {
      var r = e.target && e.target.closest && e.target.closest('#depth-ribbon');
      if (!r) return;
      var open = getComputedStyle(e.target).cursor === 'pointer';
      cur.classList.toggle('is-big', open);
      cur.textContent = open ? 'Otevřít' : '';
    }, { passive: true });
    document.addEventListener('pointerleave', function () { cur.classList.remove('is-on'); });
  }

  // playful wordmark: the letters hop when you point at it (záměr 20)
  var logo = document.querySelector('.hp-logo');
  if (logo && !reduce) {
    logo.addEventListener('pointerenter', function () {
      var g = window.gsap;
      var chars = logo.querySelectorAll('.ch');
      if (!g) return;
      if (!chars.length) {
        var text = logo.textContent.trim();
        logo.setAttribute('aria-label', text);
        logo.innerHTML = text.split('').map(function (c) { return '<span class="ch" aria-hidden="true" style="display:inline-block">' + c + '</span>'; }).join('');
        chars = logo.querySelectorAll('.ch');
      }
      g.fromTo(chars, { y: 0 }, { y: -10, duration: 0.18, ease: 'power2.out', stagger: 0.035, yoyo: true, repeat: 1, overwrite: true });
    });
  }

  // visits without cookies (záměr 16): Vercel Web Analytics, loaded after the page is up; it only answers on Vercel
  // once Analytics is switched on for the project, so local builds skip it
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  if (!/^(localhost|127\.|\[::1\])/.test(location.hostname)) {
    var addVa = function () { var s = document.createElement('script'); s.defer = true; s.src = '/_vercel/insights/script.js'; document.head.appendChild(s); };
    if (document.readyState === 'complete') setTimeout(addVa, 1500); else addEventListener('load', function () { setTimeout(addVa, 1500); }, { once: true });
  }
})();
