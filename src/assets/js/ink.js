/* Grafysta ink loader: a fixed canvas behind the page content, the fluid in a worker (ink-core.js).
   Started only after the page has loaded and gone idle, so it never weighs on the first paint.
   Usage: <canvas class="ink" data-ink aria-hidden="true"></canvas> + this script. */
(function () {
  'use strict';
  var cv = document.querySelector('canvas[data-ink]');
  if (!cv || typeof WebGL2RenderingContext === 'undefined') return;
  var CORE = '/assets/js/ink-core.js';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var opts = { reduced: reduced };
  try { var extra = JSON.parse(cv.getAttribute('data-ink') || '{}'); for (var k in extra) opts[k] = extra[k]; } catch (e) {}

  var api = null;
  var send = function (type, a, b, c) { if (api) api(type, a, b, c); };

  var boot = function () {
    var w = innerWidth, h = innerHeight, dpr = devicePixelRatio || 1;
    var ready = function () { cv.classList.add('is-on'); };
    var fail = function () { cv.remove(); api = null; };
    if (typeof Worker !== 'undefined' && 'transferControlToOffscreen' in cv) {
      var off = cv.transferControlToOffscreen(), worker = new Worker(CORE);
      worker.onmessage = function (e) { if (e.data.type === 'ready') ready(); else if (e.data.type === 'fail') fail(); };
      worker.onerror = fail;
      worker.postMessage({ type: 'init', canvas: off, w: w, h: h, dpr: dpr, opts: opts }, [off]);
      api = function (type, a, b, c) { worker.postMessage({ type: type, a: a, b: b, c: c }); };
    } else {
      var s = document.createElement('script');
      s.src = CORE;
      s.onload = function () {
        var ink = null;
        try { ink = self.GrafystaInk && self.GrafystaInk(cv, opts); } catch (e) { ink = null; }
        if (!ink) { fail(); return; }
        ink.resize(w, h, dpr); ink.start(); ready();
        api = function (type, a, b, c) { ink[type](a, b, c); };
      };
      document.head.appendChild(s);
    }

    // pointer and touch: listened for on the window, the canvas itself never takes events
    addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      send('move', e.clientX / innerWidth, 1 - e.clientY / innerHeight, false);
    }, { passive: true });
    var touch = function (e) { var t = e.touches[0]; if (t) send('move', t.clientX / innerWidth, 1 - t.clientY / innerHeight, true); };
    addEventListener('touchstart', touch, { passive: true });
    addEventListener('touchmove', touch, { passive: true });
    addEventListener('touchend', function () { send('lift'); }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { send('leave'); });
    addEventListener('blur', function () { send('leave'); });
    document.addEventListener('visibilitychange', function () { send('visible', document.visibilityState !== 'hidden'); });
    // rebuild only on real size changes (not when a mobile address bar slides), the ink would start over
    var rz = 0, lw = w, lh = h;
    addEventListener('resize', function () {
      cancelAnimationFrame(rz);
      rz = requestAnimationFrame(function () {
        if (innerWidth === lw && Math.abs(innerHeight - lh) < 160) return;
        lw = innerWidth; lh = innerHeight;
        send('resize', lw, lh, devicePixelRatio || 1);
      });
    });
  };

  var later = function () { setTimeout(function () { 'requestIdleCallback' in window ? requestIdleCallback(boot, { timeout: 1500 }) : boot(); }, 300); };
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
})();
