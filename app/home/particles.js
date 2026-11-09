/* Grafysta headpage: the headline made of light particles (from the 3D background lab, "Obraz z částic").
   On load a field of points breathes along the bottom of the screen; thousands of them rise out of it on their own
   and gather into "Váš grafický stylista.", exactly over the real <h1> (kept in the page, invisible, for search and
   screen readers), and stay. The pointer blows the letters apart and ripples the field.
   This file samples the headline and drives the motion with GSAP; the WebGL runs in a worker (particles-core.js),
   so the page itself never waits for it. */
(function () {
  'use strict';
  var root = document.documentElement;
  var h1 = document.querySelector('.tr-headline');
  var canvas = document.querySelector('canvas[data-particles]');
  if (!h1 || !canvas || !root.classList.contains('pt')) return;
  var CORE = '/assets/js/home-particles-core.js';
  var fail = function () { root.classList.remove('pt'); if (canvas.parentNode) canvas.remove(); };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var narrow = innerWidth < 760;
  var N = narrow ? 9000 : 17000;
  var SS = 2;

  // the headline drawn exactly like the h1, line by line, then turned into N target points (CSS px inside the h1)
  function targets() {
    var cs = getComputedStyle(h1), box = h1.getBoundingClientRect();
    var cv = document.createElement('canvas');
    cv.width = Math.ceil(box.width * SS); cv.height = Math.ceil(box.height * SS);
    var cx = cv.getContext('2d', { willReadFrequently: true });
    cx.scale(SS, SS);
    cx.fillStyle = '#fff';
    cx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    if ('letterSpacing' in cx) cx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    cx.textBaseline = 'alphabetic';
    var fs = parseFloat(cs.fontSize), range = document.createRange();
    h1.childNodes.forEach(function (node) {
      if (node.nodeType !== 3 || !node.textContent.trim()) return;
      range.selectNodeContents(node);
      var r = range.getBoundingClientRect();
      // baseline: the line box centre, moved down by about half the cap height
      cx.fillText(node.textContent.trim().toLocaleUpperCase('cs'), r.left - box.left, r.top - box.top + r.height / 2 + fs * 0.32);
    });
    var img = cx.getImageData(0, 0, cv.width, cv.height).data, cand = [];
    for (var y = 0; y < cv.height; y++) for (var x = 0; x < cv.width; x++) if (img[(y * cv.width + x) * 4 + 3] > 140) cand.push(x, y);
    if (!cand.length) throw new Error('no glyphs');
    var tgt = new Float32Array(N * 2);
    for (var k = 0; k < N; k++) {
      var c = (Math.random() * (cand.length / 2)) | 0;
      tgt[k * 2] = (cand[c * 2] + Math.random()) / SS; tgt[k * 2 + 1] = (cand[c * 2 + 1] + Math.random()) / SS;
    }
    return tgt;
  }

  var send = null;
  var where = function () {
    var r = h1.getBoundingClientRect();
    var vis = parseFloat(getComputedStyle(h1.parentElement).opacity);
    return { x: r.left, y: r.top, vis: isFinite(vis) ? vis : 1 };
  };

  function run() {
    var tgt;
    try { tgt = targets(); } catch (e) { fail(); return; }
    var pos = where();
    var opts = { W: innerWidth, H: innerHeight, dpr: devicePixelRatio || 1, N: N, narrow: narrow, reduce: reduce, tgt: tgt, x: pos.x, y: pos.y };
    var ready = function () { canvas.classList.add('is-on'); animate(); };
    if (typeof Worker !== 'undefined' && 'transferControlToOffscreen' in canvas) {
      var off = canvas.transferControlToOffscreen(), worker = new Worker(CORE);
      worker.onmessage = function (e) { if (e.data.type === 'ready') ready(); else fail(); };
      worker.onerror = fail;
      opts.type = 'init'; opts.canvas = off;
      send = function (type, v, transfer) { worker.postMessage({ type: type, v: v }, transfer || []); };
      worker.postMessage(opts, [off, tgt.buffer]);
    } else {
      var s = document.createElement('script');
      s.src = CORE;
      s.onload = function () {
        var scene = null;
        try { scene = self.GrafystaParticles && self.GrafystaParticles(canvas, opts); } catch (e) { scene = null; }
        if (!scene) { fail(); return; }
        send = function (type, v) { scene[type](v); };
        ready();
      };
      s.onerror = fail;
      document.head.appendChild(s);
    }
  }

  // GSAP: the field fades up, then the letters gather out of it; the pointer is damped
  function animate() {
    var gsap = window.gsap;
    var st = { p: reduce ? 1 : 0, fade: reduce ? 1 : 0, push: 0, ripple: 0, px: -1e4, py: -1e4 };
    var push = function () { send('set', { p: st.p, fade: st.fade, push: st.push, ripple: st.ripple, px: st.px, py: st.py }); };
    push();
    if (gsap && !reduce) {
      gsap.to(st, { fade: 1, duration: 1.2, ease: 'power2.out', onUpdate: push });
      gsap.to(st, { p: 1, duration: 4.2, delay: 0.5, ease: 'power1.inOut', onUpdate: push });
    } else { st.p = 1; st.fade = 1; push(); }
    if (!reduce) {
      var q = function (k, d) { return gsap ? gsap.quickTo(st, k, { duration: d, ease: 'power3.out', onUpdate: push }) : function (v) { st[k] = v; push(); }; };
      var toX = q('px', 0.35), toY = q('py', 0.35), toPush = q('push', 0.6), toRipple = q('ripple', 0.8);
      var first = true;
      addEventListener('pointermove', function (e) {
        if (first) { st.px = e.clientX; st.py = e.clientY; first = false; }
        toX(e.clientX); toY(e.clientY);
        toPush(e.pointerType === 'mouse' ? 46 : 0); toRipple(1);
      }, { passive: true });
      root.addEventListener('pointerleave', function () { toPush(0); toRipple(0); });
    }
    // the headline moves (scroll, and the tile reveal eases it upward after the scroll has stopped): every frame
    // the points look where the real h1 is, and hear about it only when it moved
    var lx = -1e9, ly = -1e9, lv = -1, loop = 0;
    var follow = function () {
      loop = requestAnimationFrame(follow);
      var w = where();
      if (Math.abs(w.x - lx) > 0.1 || Math.abs(w.y - ly) > 0.1 || Math.abs(w.vis - lv) > 0.002) { lx = w.x; ly = w.y; lv = w.vis; send('set', w); }
    };
    follow();
    document.addEventListener('visibilitychange', function () {
      var on = document.visibilityState !== 'hidden';
      send('visible', on);
      cancelAnimationFrame(loop); if (on) follow();
    });
    var lw = innerWidth, lh = innerHeight, rz = 0;
    addEventListener('resize', function () {
      cancelAnimationFrame(rz);
      rz = requestAnimationFrame(function () {
        // a phone's address bar sliding is not a new layout
        if (innerWidth === lw && Math.abs(innerHeight - lh) < 160) return;
        lw = innerWidth; lh = innerHeight;
        var v = { W: lw, H: lh, dpr: devicePixelRatio || 1 };
        try { v.tgt = targets(); } catch (e) {}
        send('resize', v, v.tgt ? [v.tgt.buffer] : []);
        send('set', where());
      });
    });
  }

  // after the first paint, once the Odibee font is in (the h1 must be laid out in it before it is sampled)
  var go = function () {
    var fs = parseFloat(getComputedStyle(h1).fontSize);
    var f = document.fonts && document.fonts.load ? document.fonts.load('400 ' + fs + 'px "Odibee Sans CZ"') : Promise.resolve();
    f.then(run, run);
  };
  if (document.readyState === 'complete') requestAnimationFrame(go); else addEventListener('load', function () { requestAnimationFrame(go); }, { once: true });
})();
