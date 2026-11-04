/*!
 * DepthRibbon — a ribbon of images winding through 3D space.
 * Page-side controller: owns the canvas, input and artwork, and runs the
 * WebGL renderer (ribbon-core.js) in a Web Worker through OffscreenCanvas,
 * so the main thread stays free. Falls back to the main thread when needed.
 * © Grafysta
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    items: [],               // { src? | draw?(ctx, w, h, item, i), alt, title?, subtitle?, bg? }
    count: 72,
    path: 'loop',            // loop | knot | wave
    tour: 'cycle',           // cycle | ride | overview
    interval: 9,
    speed: 0.6,              // cards per second
    cardSize: 0.72,
    aspect: 1,
    radius: 0.12,
    offset: 1,
    fov: 60,
    fog: 1,
    thread: 0.3,
    shadow: 0.5,
    accentColor: '#B19EEF',
    backgroundColor: '#0a0a0a',
    captions: true,
    ariaLabel: 'Depth ribbon gallery. Scroll or drag to travel, hold to see the whole path, click an image to bring it close.',
    inkColor: '#000000',
    focusOnClick: true,
    holdToReveal: true,
    interactive: true,
    draggable: true,
    wheel: true,
    pauseOnHover: true,
    seed: 0,
    paused: false,
    dpr: 2,
    cell: [512, 512],
    workerUrl: null,         // url of ribbon-core.js; null = main thread
    coreUrl: null,           // same file, loaded on demand for the fallback
    onFocusChange: null,     // (item, itemIndex, cardIndex)
    onTravel: null,          // (item, itemIndex, cardIndex)
    onModeChange: null,      // ('ride' | 'overview' | 'focus')
    onReady: null,
    onError: null
  };

  var KEYS = ['count', 'path', 'tour', 'interval', 'speed', 'cardSize', 'aspect', 'radius', 'offset', 'fov', 'fog', 'thread', 'shadow',
    'accentColor', 'backgroundColor', 'inkColor', 'focusOnClick', 'holdToReveal', 'interactive', 'draggable', 'wheel', 'pauseOnHover',
    'seed', 'paused', 'dpr', 'cell', 'hq'];

  function idle(fn) { return global.requestIdleCallback ? global.requestIdleCallback(fn, { timeout: 250 }) : setTimeout(fn, 32); }

  function DepthRibbon(container, options) {
    var o = this.o = Object.assign({}, DEFAULTS, options || {});
    this.el = container;
    this.reduced = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (this.reduced) o.paused = true;

    var plain = { reduced: this.reduced, items: o.items.map(function (it) { return { bg: it.bg || '#cccccc' }; }) };
    KEYS.forEach(function (k) { plain[k] = o[k]; });
    this._plain = plain;
    this._queue = [];
    this._dead = false;

    this._makeDom();
    this._makeCanvas();
    this._bind();

    var canWorker = o.workerUrl && typeof Worker !== 'undefined' && 'transferControlToOffscreen' in this.canvas;
    if (canWorker) this._startWorker(); else this._startMain();
  }

  var P = DepthRibbon.prototype;

  // root, canvas layer, screen-reader list and caption, as in the original component
  P._makeDom = function () {
    var o = this.o, el = this.el;
    el.setAttribute('role', 'region');
    el.setAttribute('aria-roledescription', 'gallery');
    el.setAttribute('aria-label', o.ariaLabel);
    el.setAttribute('tabindex', '0');
    el.style.position = el.style.position || 'relative';
    el.style.overflow = 'hidden';
    el.style.minHeight = '420px';
    el.style.backgroundColor = o.backgroundColor;
    this.layer = document.createElement('div');
    this.layer.style.cssText = 'position:absolute;inset:0;touch-action:pan-y;user-select:none;-webkit-user-select:none;opacity:0;transition:opacity 700ms ease;';
    el.appendChild(this.layer);
    var ul = document.createElement('ul');
    ul.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    o.items.forEach(function (it) {
      var li = document.createElement('li');
      li.textContent = (it.title || it.alt) + ': ' + (it.alt || it.title) + (it.subtitle ? ', ' + it.subtitle.charAt(0).toLowerCase() + it.subtitle.slice(1) : '');
      ul.appendChild(li);
    });
    el.appendChild(ul);
    if (o.captions) {
      var cap = this.cap = document.createElement('div');
      cap.setAttribute('aria-live', 'polite');
      cap.style.cssText = 'position:absolute;left:0;right:0;bottom:6%;display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;opacity:0;transform:translateY(8px);' +
        'transition:opacity 420ms, transform 520ms cubic-bezier(0.22,1,0.36,1);color:rgba(255,255,255,0.94);text-align:center;';
      this.capT = document.createElement('span'); this.capT.style.cssText = 'font-size:15px;font-weight:600;line-height:1.35;';
      this.capS = document.createElement('span'); this.capS.style.cssText = 'font-size:13px;opacity:0.6;line-height:1.35;';
      cap.appendChild(this.capT); cap.appendChild(this.capS); el.appendChild(cap);
    }
  };
  P._caption = function (item) {
    if (!this.cap) return;
    var c = this.cap;
    if (item) {
      this.capT.textContent = item.title || ''; this.capS.textContent = item.subtitle || '';
      c.style.transition = 'opacity 420ms 520ms, transform 520ms cubic-bezier(0.22,1,0.36,1) 520ms';
      c.style.opacity = '1'; c.style.transform = 'translateY(0px)';
    } else {
      c.style.transition = 'opacity 420ms, transform 520ms cubic-bezier(0.22,1,0.36,1)';
      c.style.opacity = '0'; c.style.transform = 'translateY(8px)';
    }
  };

  P._makeCanvas = function () {
    if (this.canvas) this.canvas.remove();
    var c = this.canvas = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    this.layer.appendChild(c);
  };

  P._size = function () {
    var r = this.el.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height), dpr: global.devicePixelRatio || 1 };
  };

  P._startWorker = function () {
    var self = this, sz = this._size();
    try {
      var off = this.canvas.transferControlToOffscreen();
      var w = this.worker = new Worker(this.o.workerUrl);
      w.onmessage = function (e) { self._on(e.data); };
      w.onerror = function (e) { e.preventDefault && e.preventDefault(); self._fallback('worker error'); };
      this._send = function (m) { w.postMessage(m, m.img && m.img.close ? [m.img] : []); };
      w.postMessage({ type: 'init', canvas: off, opts: this._plain, w: sz.w, h: sz.h, dpr: sz.dpr }, [off]);
    } catch (err) { this._fallback(err); }
  };

  // worker could not render (e.g. no WebGL2 in workers): rebuild on the main thread
  P._fallback = function () {
    if (this._fellBack || this._dead) return;
    this._fellBack = true;
    if (this.worker) { this.worker.terminate(); this.worker = null; }
    this._makeCanvas();
    this._startMain();
  };

  P._startMain = function () {
    var self = this;
    var go = function () {
      if (!global.RibbonCore) { self._fail('RibbonCore missing'); return; }
      var sz = self._size();
      try {
        var core = self.core = new global.RibbonCore(self.canvas, self._plain, function (type, p) { p.type = type; self._on(p); });
        core.resize(sz.w, sz.h, sz.dpr);
        self._send = function (m) { core.handle(m); };
      } catch (err) { self._fail(err); }
    };
    if (global.RibbonCore || !this.o.coreUrl) go();
    else { var s = document.createElement('script'); s.src = this.o.coreUrl; s.onload = go; s.onerror = function () { self._fail('core failed to load'); }; document.head.appendChild(s); }
  };

  P._fail = function (err) {
    if (this.canvas) this.canvas.remove();
    if (this.o.onError) this.o.onError(err);
  };

  /* ---------- messages from the renderer ---------- */
  P._on = function (m) {
    var o = this.o;
    switch (m.type) {
      case 'init': this._cell = [m.cellW, m.cellH]; this._paintAll(); break;
      case 'error': if (this.worker) this._fallback(m.message); else this._fail(m.message); break;
      case 'focus': this._caption(m.item >= 0 ? o.items[m.item] : null); if (o.onFocusChange) o.onFocusChange(m.item >= 0 ? o.items[m.item] : null, m.item, m.card); break;
      case 'travel': if (o.onTravel) o.onTravel(o.items[m.item], m.item, m.card); break;
      case 'mode': if (o.onModeChange) o.onModeChange(m.mode); break;
      case 'cursor': this.canvas.style.cursor = m.value; break;
      case 'ready':
        // crossfade from the static first frame (poster) to the live scene
        var layer = this.layer, poster = this.el.querySelector('[data-ribbon-poster]');
        requestAnimationFrame(function () { layer.style.opacity = '1'; });
        if (poster) setTimeout(function () { poster.remove(); }, 900);
        if (o.onReady) o.onReady();
        break;
    }
  };

  /* ---------- artwork: painted on the main thread in idle slices, sent as ImageBitmaps ---------- */
  P._paintAll = function () {
    var self = this, items = this.o.items, W = this._cell[0], H = this._cell[1];
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    var i = 0;
    var deliver = function (idx) {
      if (self._dead) return;
      if (self.worker && global.createImageBitmap) {
        global.createImageBitmap(cv).then(function (bmp) { self._send({ type: 'image', i: idx, img: bmp }); next(); });
      } else { self._send({ type: 'image', i: idx, img: cv }); next(); }
    };
    var next = function () {
      if (i >= items.length || self._dead) return;
      idle(function () {
        var idx = i++, it = items[idx];
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
        ctx.fillStyle = it.bg || '#cccccc'; ctx.fillRect(0, 0, W, H);
        if (it.src) {
          var img = new Image(); img.decoding = 'async'; img.crossOrigin = 'anonymous';
          img.onload = function () {
            var s = Math.max(W / img.naturalWidth, H / img.naturalHeight), w = img.naturalWidth * s, h = img.naturalHeight * s;
            ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h); deliver(idx);
          };
          img.onerror = function () { deliver(idx); };
          img.src = it.src;
        } else {
          if (it.draw) { ctx.save(); it.draw(ctx, W, H, it, idx); ctx.restore(); }
          deliver(idx);
        }
      });
    };
    next();
  };

  /* ---------- input ---------- */
  P._bind = function () {
    var self = this, o = this.o;
    var send = function (m) { if (self._send) self._send(m); };
    this._ro = new ResizeObserver(function () { var s = self._size(); send({ type: 'resize', w: s.w, h: s.h, dpr: s.dpr }); });
    this._ro.observe(this.el);
    var vis = { io: true };
    var pushVis = function () { send({ type: 'visible', v: vis.io && !document.hidden }); };
    if ('IntersectionObserver' in global) { this._io = new IntersectionObserver(function (e) { vis.io = e[0].isIntersecting; pushVis(); }); this._io.observe(this.el); }
    this._vis = pushVis; document.addEventListener('visibilitychange', pushVis);

    this._key = function (e) { if (e.key === 'Escape') send({ type: 'release' }); };
    global.addEventListener('keydown', this._key);
    if (!o.interactive) return;

    // listeners live on the container so they survive a canvas swap
    var el = this.el;
    var ptr = function (type) {
      return function (e) {
        if (type === 'down') { if (e.button !== 0) return; try { el.setPointerCapture(e.pointerId); } catch (x) {} }
        var r = el.getBoundingClientRect();
        send({ type: 'input', e: { type: type, x: e.clientX - r.left, y: e.clientY - r.top, pointerType: e.pointerType, t: performance.now() } });
      };
    };
    el.addEventListener('pointerdown', ptr('down'));
    el.addEventListener('pointermove', ptr('move'));
    el.addEventListener('pointerup', ptr('up'));
    el.addEventListener('pointercancel', ptr('cancel'));
    el.addEventListener('pointerleave', ptr('leave'));
    if (o.wheel) {
      el.addEventListener('wheel', function (e) {
        e.preventDefault();
        send({ type: 'input', e: { type: 'wheel', dy: e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, t: performance.now() } });
      }, { passive: false });
    }
  };

  /* ---------- public API ---------- */
  P.focusItem = function (i) { this._send && this._send({ type: 'focusItem', i: i }); };
  P.release = function () { this._send && this._send({ type: 'release' }); };
  P.travel = function (n) { this._send && this._send({ type: 'travel', n: n }); };
  P.reveal = function () { this._send && this._send({ type: 'reveal' }); };
  P.destroy = function () {
    this._dead = true;
    this._send && this._send({ type: 'destroy' });
    if (this.worker) this.worker.terminate();
    this._ro && this._ro.disconnect(); this._io && this._io.disconnect();
    document.removeEventListener('visibilitychange', this._vis);
    global.removeEventListener('keydown', this._key);
    this.canvas && this.canvas.remove();
  };

  DepthRibbon.supported = function () { return typeof global.WebGL2RenderingContext !== 'undefined'; };

  global.DepthRibbon = DepthRibbon;
})(window);
