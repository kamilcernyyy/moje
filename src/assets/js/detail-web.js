/* Detail of a web project: the 3D phone (device-core.js, in a worker) shows the real mobile screens.
   The buttons pick a screen (the phone spins once and swaps it), the scroll turns the phone and walks through the screens. */
(function () {
  'use strict';
  var dev = document.querySelector('.dev');
  if (!dev) return;
  var CORE = '/assets/js/device-core.js';
  var stage = dev.querySelector('.dev-stage');
  var btns = Array.prototype.slice.call(dev.querySelectorAll('[data-screen]'));
  var screens = [];
  try { screens = JSON.parse(dev.dataset.screens || '[]'); } catch (e) {}
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var current = 0, manual = false, post = null;
  var abs = function (u) { return new URL(u, location.href).href; };

  function mark(i) { btns.forEach(function (b, k) { b.setAttribute('aria-current', String(k === i)); }); }
  function show(i) { if (i === current) return; current = i; mark(i); if (post) post({ type: 'show', i: i }); }
  mark(0);
  btns.forEach(function (b, k) { b.addEventListener('click', function () { manual = true; show(k); }); });

  function size() { var r = stage.getBoundingClientRect(); return { width: r.width, height: r.height, dpr: window.devicePixelRatio || 1 }; }
  function start() {
    if (!screens.length || !('createImageBitmap' in window)) return;
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    stage.appendChild(canvas);
    var init = Object.assign({ screens: screens.map(abs), color: dev.dataset.color, reduced: reduce }, size());
    var ready = function () { dev.classList.add('is-3d'); };
    if (typeof canvas.transferControlToOffscreen === 'function' && typeof Worker !== 'undefined') {
      try {
        var off = canvas.transferControlToOffscreen();
        var w = new Worker(CORE);
        w.onmessage = function (e) { if (e.data && e.data.type === 'ready') ready(); };
        w.postMessage(Object.assign({ type: 'init', canvas: off }, init), [off]);
        post = function (m) { w.postMessage(m); };
      } catch (e) { post = null; }
    }
    if (!post) {
      var s = document.createElement('script');
      s.src = CORE;
      s.onload = function () {
        if (!window.DeviceCore) return;
        var d = window.DeviceCore(canvas, Object.assign({ onReady: ready }, init));
        post = function (m) {
          if (m.type === 'resize') d.resize(m.width, m.height, m.dpr);
          else if (m.type === 'pointer') d.pointer(m.x, m.y);
          else if (m.type === 'scroll') d.scroll(m.v);
          else if (m.type === 'show') d.show(m.i);
          else if (m.type === 'visible') d.setVisible(m.value);
        };
      };
      document.head.appendChild(s);
    }
    new ResizeObserver(function () { if (post) post(Object.assign({ type: 'resize' }, size())); }).observe(stage);
    new IntersectionObserver(function (es) { if (post) post({ type: 'visible', value: es.some(function (x) { return x.isIntersecting; }) }); }).observe(stage);
    if (current) post && post({ type: 'show', i: current });
  }

  // start the 3D only when the phone comes near the screen
  var io = new IntersectionObserver(function (es) {
    if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); start(); }
  }, { rootMargin: '300px' });
  io.observe(dev);

  // pointer tilts the phone
  dev.addEventListener('pointermove', function (e) {
    if (!post || e.pointerType !== 'mouse') return;
    var r = dev.getBoundingClientRect();
    post({ type: 'pointer', x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 });
  });
  dev.addEventListener('pointerleave', function () { if (post) post({ type: 'pointer', x: 0, y: 0 }); });

  // scroll turns the phone and, until a button is used, walks through the screens
  var ticking = false;
  addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var r = dev.getBoundingClientRect(), vh = innerHeight;
      var p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      if (post && !reduce) post({ type: 'scroll', v: (p - 0.5) * 0.9 });
      if (!manual && screens.length > 1) show(Math.min(screens.length - 1, Math.max(0, Math.floor((p - 0.25) / 0.5 * screens.length))));
    });
  }, { passive: true });
})();
