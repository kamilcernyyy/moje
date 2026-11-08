/* Detail práce: keys and swipes between projects, the depth gallery (identity, motion), the live frame and a few details. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var slug = root.dataset.slug;
  var remember = function () { try { sessionStorage.setItem('ribbon-return', slug); } catch (e) {} };

  // ← Stuha returns to this very card in the ribbon
  var back = document.querySelector('.dt-back');
  if (back) back.addEventListener('click', remember);

  // keys: Esc back to the ribbon, arrows between projects
  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    var a = document.querySelector('.dt-bar [data-key="' + e.key + '"]');
    if (!a) return;
    e.preventDefault();
    if (a === back) remember();
    location.href = a.href;
  });

  // mobile: a decisive sideways swipe flips to the previous / next project (záměr 9)
  var sx = 0, sy = 0, st = 0, ok = false;
  addEventListener('touchstart', function (e) {
    var t = e.target;
    ok = e.touches.length === 1 && !(t.closest && t.closest('.desk, .live, .dev, .dg'));
    if (!ok) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
  }, { passive: true });
  addEventListener('touchend', function (e) {
    if (!ok) return;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Date.now() - st < 600 && Math.abs(dx) > 90 && Math.abs(dy) < Math.abs(dx) * 0.4) {
      var a = document.querySelector('.dt-bar [rel="' + (dx < 0 ? 'next' : 'prev') + '"]');
      if (a) location.href = a.href;
    }
  }, { passive: true });

  // the live web loads only when it comes near the screen
  var frame = document.querySelector('.live-view iframe[data-src]');
  if (frame && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (x) { return x.isIntersecting; })) { frame.src = frame.dataset.src; io.disconnect(); }
    }, { rootMargin: '400px' });
    io.observe(frame);
  } else if (frame) frame.src = frame.dataset.src;

  // "Další projekt" leans toward the pointer
  var next = document.querySelector('.dt-next');
  if (next && window.gsap && !reduce) {
    next.addEventListener('pointermove', function (e) {
      var r = next.getBoundingClientRect();
      gsap.to(next, { rotateY: ((e.clientX - r.left) / r.width - 0.5) * 6, rotateX: -((e.clientY - r.top) / r.height - 0.5) * 6, transformPerspective: 900, duration: 0.5, ease: 'power3' });
    });
    next.addEventListener('pointerleave', function () { gsap.to(next, { rotateX: 0, rotateY: 0, duration: 0.7, ease: 'power3' }); });
  }

  // depth gallery (variant 9): pictures and lines stand one behind another, the scroll flies the camera through them
  var dg = document.querySelector('.dg');
  if (dg && window.gsap && window.ScrollTrigger && !reduce) {
    gsap.registerPlugin(ScrollTrigger);
    dg.classList.add('is-3d');
    var els = Array.prototype.slice.call(dg.querySelectorAll('.dg-item, .dg-line'));
    var GAP = 1300, narrow = innerWidth < 760, pass = narrow ? 150 : 320;   // how long a station lingers once the camera reaches it
    // every station takes the other side than the one before, so a picture and a line never stand in each other's way;
    // on a phone they stack in the middle instead and the lines float a bit higher
    var nodes = els.map(function (el, k) {
      var line = el.classList.contains('dg-line'), side = k % 2 ? 1 : -1;
      return { el: el, z: -k * GAP, x: narrow ? 0 : side * 24, y: narrow ? (line ? -16 : 6) : (line ? 0 : (k % 3 - 1) * 3), v: el.querySelector('video'), on: false };
    });
    // the flight ends with the last station in full view, then the page scrolls on
    var span = (els.length - 1) * GAP;
    dg.style.height = (100 + (els.length - 1) * 38) + 'vh';
    var state = { p: 0 };
    var render = function () {
      var cam = state.p * span;
      nodes.forEach(function (n) {
        var z = n.z + cam;
        // fades out as it passes the camera, comes out of the fog in the distance
        var o = z > pass ? 0 : z > 0 ? 1 - z / pass : z < -2600 ? 0 : z < -1000 ? (z + 2600) / 1600 : 1;
        n.el.style.opacity = o.toFixed(3);
        n.el.style.zIndex = String(Math.round(5000 + z / 10));     // nearer draws on top
        n.el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
        n.el.style.transform = 'translate(-50%,-50%) translate3d(' + n.x + 'vw,' + n.y + 'vh,' + z.toFixed(1) + 'px)';
        // a motion piece plays only while it is in sight
        if (n.v && (o > 0.15) !== n.on) {
          n.on = o > 0.15;
          if (n.on) { n.v.preload = 'auto'; var pl = n.v.play(); if (pl && pl.catch) pl.catch(function () {}); } else n.v.pause();
        }
      });
    };
    var to = gsap.quickTo(state, 'p', { duration: 0.6, ease: 'power3', onUpdate: render });
    ScrollTrigger.create({ trigger: dg, start: 'top top', end: 'bottom bottom', onUpdate: function (s) { to(s.progress); } });
    render();
  } else if (dg) {
    // without the flight the videos wait for a tap
    dg.querySelectorAll('video').forEach(function (v) { v.controls = true; v.preload = 'metadata'; });
  }

  // booking CTA: the Electric Border (React Bits) is fetched only when the CTA comes near, so it never weighs on the first load
  var cta = document.querySelector('[data-electric]');
  if (cta && 'IntersectionObserver' in window) {
    var ctaIo = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      ctaIo.disconnect();
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/assets/js/cta.css'; document.head.appendChild(l);
      var s = document.createElement('script'); s.src = '/assets/js/cta.js'; s.defer = true; document.head.appendChild(s);
    }, { rootMargin: '600px 0px' });
    ctaIo.observe(cta);
  }
})();
