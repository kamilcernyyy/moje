/*!
 * ShaderCard — a content card with a luminous flame rising behind it.
 * Vanilla WebGL recreation of the React Bits Pro "Shader Card" look and props.
 * Usage: new ShaderCard(element, { color: '#5227FF', ... })
 * The flame is drawn in a Web Worker (OffscreenCanvas) when the browser allows it.
 * © Grafysta
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    borderRadius: '24px',
    color: '#5227FF',
    highlightColor: null,      // defaults to a lighter, warmer shade of color
    backgroundColor: '#111111',
    speed: 0.5,
    positionY: 0,
    scale: 4,
    effectRadius: 0.9,
    effectBoost: 0.5,
    edgeMin: 0,
    edgeMax: 1,
    falloffPower: 2,
    noiseScale: 1.5,
    widthFactor: 1.5,
    waveAmount: 0.15,
    branchIntensity: 2,
    verticalExtent: 1.5,
    horizontalExtent: 1.5,
    contours: 1,
    flash: 0.6,
    blur: 4,
    intensity: 1,
    bloom: 0.8,
    grain: 0.25,
    fade: 0.6,
    opacity: 1,
    interactive: true,
    tiltStrength: 8,
    parallax: 1,
    hoverRise: 1,
    intro: true,
    autoPlay: true,
    paused: false,
    dpr: 2
  };

  var VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

  var FS = [
    'precision highp float;',
    'uniform vec2 uRes; uniform float uTime; uniform float uIntro; uniform float uHover;',
    'uniform vec3 uColor; uniform vec3 uHi; uniform vec3 uBg;',
    'uniform float uPosY, uScale, uRadius, uBoost, uEdgeMin, uEdgeMax, uFalloff, uNoise, uWidth, uWave, uBranch;',
    'uniform float uVExt, uHExt, uContours, uFlash, uIntensity, uBloom, uGrain, uFade, uOpacity;',
    'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }',
    'float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return v; }',
    'void main(){',
    '  vec2 frag = gl_FragCoord.xy;',
    // card space: x centred, y from the bottom edge, both in units of the card height
    '  vec2 p = vec2((frag.x - 0.5 * uRes.x) / uRes.y, frag.y / uRes.y);',
    '  float t = uTime;',
    '  float rise = uPosY * 0.25 + (uIntro - 1.0) * 0.9 + uHover * 0.12;',
    '  vec2 q = vec2(p.x / (uWidth * uHExt / 1.5), (p.y - rise) / (uVExt / 1.5));',
    // domain-warped flame body that rises and splits into tongues
    '  vec2 flow = vec2(0.0, -t * 0.55);',
    '  float w1 = fbm(q * uNoise * (uScale / 4.0) + flow);',
    '  float w2 = fbm(q * uNoise * 2.1 * (uScale / 4.0) + flow * 1.6 + vec2(w1 * uBranch, 0.0));',
    '  float sway = sin(q.y * 4.0 - t * 1.3) * uWave;',
    '  float h = 0.18 + uRadius * 0.42 + (w2 - 0.5) * 0.55 * (uBranch / 2.0) + sway * 0.4;',
    '  float d = q.y - h;',
    '  float body = 1.0 - smoothstep(-0.18, 0.22 + uBoost * 0.2, d);',
    '  body = pow(clamp(body, 0.0, 1.0), uFalloff * 0.5);',
    '  float lateral = 1.0 - smoothstep(0.55 * uWidth, 1.3 * uWidth, abs(q.x) + 0.15);',
    '  body *= mix(1.0, lateral, 0.35);',
    '  body = smoothstep(uEdgeMin, uEdgeMax, body);',
    // glowing contour along the flame edge and fine inner lines
    '  float edge = exp(-abs(d) * 9.0) * (0.55 + 0.45 * w1);',
    '  float lines = (0.5 + 0.5 * sin((w2 + w1) * 26.0)) * body * (1.0 - body) * 2.2;',
    '  float core = (1.0 - smoothstep(-0.1, 0.9, q.y)) * body;',
    '  float pulse = 1.0 + uFlash * 0.35 * pow(max(0.0, sin(t * 0.8)), 14.0);',
    '  float glow = (1.0 + uHover * 0.25) * uIntensity * pulse;',
    // cloudy body: darker violet troughs, lighter lilac billows
    '  float cloud = smoothstep(0.3, 0.85, fbm(q * 3.2 * (uScale / 4.0) + flow * 1.3 + vec2(w2, 0.0)));',
    '  vec3 tone = mix(uColor * 0.72, mix(uColor, uHi, 0.55), cloud);',
    '  vec3 col = uBg;',
    '  col = mix(col, tone, body * (0.62 + 0.3 * cloud));',
    '  col += uHi * (edge * 0.55 + lines * 0.18 * uContours) * body * glow;',
    '  col += uColor * core * uBloom * 0.55 * glow;',
    '  col += uHi * pow(core, 2.0) * uBloom * 0.35 * glow;',
    // fade the flame towards the top so content stays readable
    '  float top = smoothstep(0.15, 1.0, p.y) * uFade;',
    '  col = mix(col, uBg, clamp(top * 0.85, 0.0, 1.0));',
    '  col = mix(uBg, col, uOpacity);',
    '  col += (hash(frag + fract(t * 7.0) * 100.0) - 0.5) * uGrain * 0.09;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function rgb(hex) {
    var c = String(hex).trim().replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var n = parseInt(c, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  // keep any colour bright and saturated enough to glow as a flame
  function vivid(c) {
    var r = c[0], g = c[1], b = c[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    s = Math.max(s, 0.85); l = Math.min(0.62, Math.max(0.5, l));
    var C = (1 - Math.abs(2 * l - 1)) * s, X = C * (1 - Math.abs((h / 60) % 2 - 1)), m = l - C / 2, o;
    o = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
    return [o[0] + m, o[1] + m, o[2] + m];
  }
  // lighter, warmer shade of the flame colour
  function highlight(c) { return [Math.min(1, c[0] * 0.45 + 0.62), Math.min(1, c[1] * 0.45 + 0.5), Math.min(1, c[2] * 0.45 + 0.55)]; }

  /* ---------- GL renderer (runs in the worker, or on the main thread as a fallback) ---------- */
  var UNIFORMS = ['uRes', 'uTime', 'uIntro', 'uHover', 'uColor', 'uHi', 'uBg', 'uPosY', 'uScale', 'uRadius', 'uBoost', 'uEdgeMin', 'uEdgeMax', 'uFalloff',
    'uNoise', 'uWidth', 'uWave', 'uBranch', 'uVExt', 'uHExt', 'uContours', 'uFlash', 'uIntensity', 'uBloom', 'uGrain', 'uFade', 'uOpacity'];
  var MAP = { uPosY: 'positionY', uScale: 'scale', uRadius: 'effectRadius', uBoost: 'effectBoost', uEdgeMin: 'edgeMin', uEdgeMax: 'edgeMax',
    uFalloff: 'falloffPower', uNoise: 'noiseScale', uWidth: 'widthFactor', uWave: 'waveAmount', uBranch: 'branchIntensity', uVExt: 'verticalExtent',
    uHExt: 'horizontalExtent', uContours: 'contours', uFlash: 'flash', uIntensity: 'intensity', uBloom: 'bloom', uGrain: 'grain', uFade: 'fade', uOpacity: 'opacity' };

  function GLR(canvas, o) {
    var gl = this.gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) throw new Error('no webgl');
    this.canvas = canvas;
    function sh(type, src) { var x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr); gl.useProgram(pr);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var u = this.u = {};
    UNIFORMS.forEach(function (n) { u[n] = gl.getUniformLocation(pr, n); });
    var c = rgb(o.color);
    gl.uniform3fv(u.uColor, c);
    gl.uniform3fv(u.uHi, o.highlightColor ? rgb(o.highlightColor) : highlight(c));
    gl.uniform3fv(u.uBg, rgb(o.backgroundColor));
    for (var k in MAP) gl.uniform1f(u[k], o[MAP[k]]);
  }
  GLR.prototype.resize = function (w, h) {
    this.canvas.width = w; this.canvas.height = h;
    this.gl.viewport(0, 0, w, h); this.gl.uniform2f(this.u.uRes, w, h);
  };
  GLR.prototype.draw = function (f) {
    var gl = this.gl, u = this.u;
    if (f.color) { gl.uniform3fv(u.uColor, f.color); gl.uniform3fv(u.uHi, f.hi); }
    gl.uniform1f(u.uTime, f.time); gl.uniform1f(u.uIntro, f.intro); gl.uniform1f(u.uHover, f.hover);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  /* ---------- worker bootstrap ---------- */
  if (typeof WorkerGlobalScope !== 'undefined' && global instanceof WorkerGlobalScope) {
    var glr = null;
    global.onmessage = function (e) {
      var m = e.data;
      try {
        if (m.type === 'init') glr = new GLR(m.canvas, m.opts);
        else if (glr && m.type === 'resize') glr.resize(m.w, m.h);
        else if (glr && m.type === 'frame') glr.draw(m.f);
      } catch (err) { /* a failed flame just leaves the card dark */ }
    };
    return;
  }

  var SCRIPT = document.currentScript && document.currentScript.src;

  /* ---------- page side ---------- */
  var cards = [], rafId = 0;
  function loop(now) {
    rafId = 0;
    var any = false;
    for (var i = 0; i < cards.length; i++) if (cards[i]._frame(now)) any = true;
    if (any) rafId = requestAnimationFrame(loop);
  }
  function wake() { if (!rafId) rafId = requestAnimationFrame(loop); }

  function ShaderCard(el, options) {
    var o = this.o = Object.assign({}, DEFAULTS, options || {});
    this.el = el;
    this.reduced = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (this.reduced) o.paused = true;

    el.classList.add('shader-card');
    el.style.borderRadius = o.borderRadius;
    el.style.backgroundColor = o.backgroundColor;

    // flame layer under the content
    var layer = this.layer = document.createElement('div');
    layer.className = 'shader-card__flame';
    layer.setAttribute('aria-hidden', 'true');
    var cv = this.canvas = document.createElement('canvas');
    cv.style.filter = o.blur ? 'blur(' + o.blur + 'px)' : '';
    layer.appendChild(cv);
    el.insertBefore(layer, el.firstChild);
    this.content = el.querySelector('.shader-card__content');

    var plain = {}; for (var key in o) if (typeof o[key] !== 'function') plain[key] = o[key];
    try {
      if (SCRIPT && typeof Worker !== 'undefined' && 'transferControlToOffscreen' in cv) {
        var off = cv.transferControlToOffscreen(), w = this.worker = new Worker(SCRIPT);
        w.postMessage({ type: 'init', canvas: off, opts: plain }, [off]);
        this.r = {
          resize: function (a, b) { w.postMessage({ type: 'resize', w: a, h: b }); },
          draw: function (f) { w.postMessage({ type: 'frame', f: f }); }
        };
      } else this.r = new GLR(cv, plain);
    } catch (err) { layer.remove(); return; }

    this.state = { hover: 0, hoverT: 0, rx: 0, ry: 0, rxT: 0, ryT: 0, px: 0, py: 0 };
    this.time = 0;
    this.visible = true;
    this.introStart = null;

    var self = this;
    this._ro = new ResizeObserver(function () { self._resize(); self._dirty = true; wake(); });
    this._ro.observe(el);
    if ('IntersectionObserver' in global) {
      this._io = new IntersectionObserver(function (e) {
        self.visible = e[0].isIntersecting;
        if (self.visible && self.introStart === null) self.introStart = performance.now();
        wake();
      });
      this._io.observe(el);
    } else this.introStart = performance.now();
    if (o.interactive) this._bind();
    this._resize();
    cards.push(this);
    wake();
  }

  var P = ShaderCard.prototype;

  P._resize = function () {
    if (!this.r) return;
    var r = this.el.getBoundingClientRect(), pad = (this.o.blur || 0) * 2;
    var d = Math.min(global.devicePixelRatio || 1, this.o.dpr);
    // the canvas overhangs the card by the blur radius so blurred edges stay full
    var w = r.width + pad * 2, h = r.height + pad * 2;
    this.canvas.style.cssText += ';position:absolute;left:' + (-pad) + 'px;top:' + (-pad) + 'px;width:' + w + 'px;height:' + h + 'px;';
    this.r.resize(Math.max(1, Math.round(w * d)), Math.max(1, Math.round(h * d)));
  };

  P._bind = function () {
    var self = this, el = this.el, s = this.state, o = this.o;
    var finePointer = !global.matchMedia || global.matchMedia('(hover: hover) and (pointer: fine)').matches;
    el.addEventListener('pointerenter', function () { s.hoverT = 1; wake(); });
    el.addEventListener('pointerleave', function () { s.hoverT = 0; s.rxT = 0; s.ryT = 0; wake(); });
    el.addEventListener('pointermove', function (e) {
      if (!finePointer || self.reduced) return;
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      s.ryT = x * 2 * o.tiltStrength; s.rxT = -y * 2 * o.tiltStrength;
      s.pxT = x; s.pyT = y; wake();
    });
    el.addEventListener('focus', function () { s.hoverT = 1; wake(); });
    el.addEventListener('blur', function () { s.hoverT = 0; wake(); });
  };

  // returns true while the card still needs frames
  P._frame = function (now) {
    if (!this.r || !this.visible) return false;
    var o = this.o, s = this.state, dt = this._last ? Math.min(0.05, (now - this._last) / 1000) : 0.016;
    this._last = now;
    var k = 1 - Math.exp(-dt * 7);
    s.hover += (s.hoverT - s.hover) * k;
    s.rx += (s.rxT - s.rx) * k; s.ry += (s.ryT - s.ry) * k;
    s.px += ((s.pxT || 0) * (s.hoverT ? 1 : 0) - s.px) * k; s.py += ((s.pyT || 0) * (s.hoverT ? 1 : 0) - s.py) * k;

    var hover = s.hover * o.hoverRise;
    var running = o.autoPlay && !o.paused;
    if (running) this.time += dt * o.speed * (1 + hover * 0.6);
    var intro = 1;
    if (o.intro && !this.reduced && this.introStart !== null) {
      var it = Math.min(1, (now - this.introStart) / 1400);
      intro = 1 - Math.pow(1 - it, 3);
    }

    var tilt = Math.abs(s.rx) + Math.abs(s.ry) > 0.01;
    this.el.style.transform = tilt ? 'perspective(800px) rotateX(' + s.rx.toFixed(2) + 'deg) rotateY(' + s.ry.toFixed(2) + 'deg)' : '';
    if (this.content) {
      var m = o.parallax * 6;
      this.content.style.transform = tilt ? 'translate(' + (s.px * m).toFixed(2) + 'px,' + (s.py * m).toFixed(2) + 'px)' : '';
    }

    var f = { time: this.time + 3.0, intro: intro, hover: hover };
    if (this._col) {                       // colour crossfade (setColor)
      var cp = Math.min(1, (now - this._col.t0) / this._col.dur), e = cp < 0.5 ? 2 * cp * cp : 1 - Math.pow(-2 * cp + 2, 2) / 2, fr = this._col.from, t2 = this._col.to;
      var cc = [fr[0] + (t2[0] - fr[0]) * e, fr[1] + (t2[1] - fr[1]) * e, fr[2] + (t2[2] - fr[2]) * e];
      f.color = cc; f.hi = highlight(cc); this._cur = cc;
      if (cp >= 1) this._col = null;
    }
    this.r.draw(f);

    var settling = Math.abs(s.hover - s.hoverT) > 0.002 || Math.abs(s.rx - s.rxT) > 0.01 || Math.abs(s.ry - s.ryT) > 0.01 || intro < 1;
    var keep = running || settling || this._dirty || !!this._col;
    this._dirty = false;
    return keep;
  };

  P.replay = function () { this.introStart = performance.now(); wake(); };
  // crossfade the flame to another colour (made vivid so it always glows)
  P.setColor = function (hex, seconds) {
    if (!this.r) return;
    var to = vivid(rgb(hex)), from = this._cur || rgb(this.o.color);
    if (this.reduced) this._col = { from: to, to: to, t0: 0, dur: 1 };
    else this._col = { from: from, to: to, t0: performance.now(), dur: (seconds || 0.8) * 1000 };
    wake();
  };
  P.destroy = function () {
    this._ro && this._ro.disconnect(); this._io && this._io.disconnect();
    var i = cards.indexOf(this); if (i >= 0) cards.splice(i, 1);
    if (this.worker) this.worker.terminate();
    this.layer && this.layer.remove();
  };

  global.ShaderCard = ShaderCard;
})(typeof window !== 'undefined' ? window : self);
