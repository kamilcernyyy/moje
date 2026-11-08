/*!
 * DepthRibbon core — a ribbon of images winding through 3D space.
 * WebGL2 renderer that runs inside a Web Worker (OffscreenCanvas) or,
 * as a fallback, on the main thread. Modelled on the React Bits Pro
 * "Depth Ribbon" API. © Grafysta
 */
(function (G) {
  'use strict';

  /* ---------- tiny vector helpers ---------- */
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function norm(a) { var l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hex(c) {
    c = String(c || '#fff').trim().replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var n = parseInt(c, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  function lookAt(eye, target, up) {
    var z = norm(sub(eye, target)), x = norm(cross(up, z)), y = cross(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
  }
  function mat4mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }

  /* ---------- easing (GSAP power3 equivalents, used inside the worker) ---------- */
  var EASE = {
    'power3.out': function (t) { return 1 - Math.pow(1 - t, 4); },
    'power3.inOut': function (t) { return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; },
    'power2.out': function (t) { return 1 - (1 - t) * (1 - t); },
    'power2.in': function (t) { return t * t * t; }
  };

  /* ---------- paths ---------- */
  var PATHS = {
    loop: function (t) { return [10.5 * Math.sin(t), 1.7 * Math.cos(t), 3.1 * Math.sin(2 * t)]; },        // figure-eight over itself
    knot: function (t) { var s = 2.5; return [s * (Math.sin(t) + 2 * Math.sin(2 * t)), -s * 0.75 * Math.sin(3 * t), s * (Math.cos(t) - 2 * Math.cos(2 * t))]; },
    wave: function (t) { return [8.5 * Math.cos(t), 1.5 * Math.sin(3 * t), 8.5 * Math.sin(t)]; }
  };

  /* ---------- shaders ---------- */
  var CARD_VS = [
    '#version 300 es',
    'layout(location=0) in vec2 aCorner;',
    'layout(location=1) in vec3 aCenter;',
    'layout(location=2) in vec3 aT;',
    'layout(location=3) in vec3 aU;',
    'layout(location=4) in float aTex;',
    'layout(location=5) in float aState;',
    'uniform mat4 uVP; uniform vec2 uSize; uniform vec3 uCam; uniform float uShadowPass;',
    'uniform vec2 uGrid; uniform vec4 uCell;',
    'out vec2 vLocal; out vec2 vUV; out float vDist; out float vFacing; out float vState;',
    'void main(){',
    '  vec3 N = normalize(cross(aT, aU));',
    '  float side = dot(N, uCam - aCenter) >= 0.0 ? 1.0 : -1.0;',
    '  vec2 size = uSize * (1.0 + aState * 0.045);',
    '  vec3 c = aCenter + N * side * aState * 0.16 * uSize.y;',
    '  vec3 p;',
    '  if (uShadowPass > 0.5) {',
    '    vec2 sz = size * 1.7;',
    '    p = c - N * side * 0.06 * size.y - aU * 0.1 * size.y + aT * aCorner.x * sz.x + aU * aCorner.y * sz.y;',
    '    vLocal = aCorner * sz;',
    '  } else {',
    '    p = c + aT * aCorner.x * size.x + aU * aCorner.y * size.y;',
    '    vLocal = aCorner * size;',
    '  }',
    '  float cx = side > 0.0 ? aCorner.x + 0.5 : 0.5 - aCorner.x;',
    '  vec2 uv = vec2(cx, 0.5 - aCorner.y);',
    '  float col = mod(aTex, uGrid.x); float row = floor(aTex / uGrid.x + 0.001);',
    '  vUV = (vec2(col, row) + uCell.xy + uv * uCell.zw) / uGrid;',
    '  vDist = distance(p, uCam); vFacing = side; vState = aState;',
    '  gl_Position = uVP * vec4(p, 1.0);',
    '}'].join('\n');

  var CARD_FS = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vLocal; in vec2 vUV; in float vDist; in float vFacing; in float vState;',
    'uniform sampler2D uTex; uniform vec3 uBg; uniform vec3 uInk; uniform vec2 uFog; uniform vec2 uSize;',
    'uniform float uRadius; uniform float uShadowPass; uniform float uShadow; uniform float uClip;',
    'out vec4 o;',
    'float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }',
    'void main(){',
    '  float fog = smoothstep(uFog.x, uFog.y, vDist);',
    // a focused card stays in clear view: whatever stands between it and the camera fades away
    '  float clip = uClip > 0.0 ? smoothstep(uClip - 0.35 * uSize.y, uClip, vDist) : 1.0;',
    '  if (clip < 0.01) discard;',
    '  vec2 b = uSize * 0.5 * (1.0 + vState * 0.045);',
    '  if (uShadowPass > 0.5) {',
    '    float d = sdRound(vLocal, b * 0.94, uRadius);',
    '    float a = 1.0 - smoothstep(-0.06 * uSize.y, 0.22 * uSize.y, d); a *= a;',
    '    a *= uShadow * (0.34 + vState * 0.2) * (1.0 - fog) * clip;',
    '    if (a < 0.003) discard;',
    '    o = vec4(uInk, a);',
    '    return;',
    '  }',
    '  float d = sdRound(vLocal, b, uRadius);',
    '  float aa = max(fwidth(d), 1e-4);',
    '  float a = 1.0 - smoothstep(-aa, aa, d);',
    '  if (a < 0.01) discard;',
    '  vec3 col = texture(uTex, vUV).rgb;',
    '  col *= vFacing < 0.0 ? 0.78 : 1.0;',
    '  col = mix(col, uBg, clamp(-vState, 0.0, 1.0) * 0.82);',   // filtered out: sinks into the background
    '  col = mix(col, uBg, fog);',
    '  o = vec4(col, a * clip);',
    '}'].join('\n');

  var LINE_VS = '#version 300 es\nlayout(location=0) in vec3 aPos;\nuniform mat4 uVP; uniform vec3 uCam; out float vDist;\n' +
    'void main(){ vDist = distance(aPos, uCam); gl_Position = uVP * vec4(aPos, 1.0); }';
  var LINE_FS = '#version 300 es\nprecision highp float;\nin float vDist; uniform vec3 uColor; uniform vec2 uFog; uniform float uAlpha; out vec4 o;\n' +
    'void main(){ float fog = smoothstep(uFog.x, uFog.y, vDist); o = vec4(uColor, uAlpha * (1.0 - fog)); }';

  function compile(gl, vs, fs) {
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p: p, u: u };
  }

  /* ======================================================== */
  /**
   * @param canvas  HTMLCanvasElement or OffscreenCanvas
   * @param o       plain options (structured-cloneable)
   * @param emit    function (type, payload) → notifies the page
   */
  function RibbonCore(canvas, o, emit) {
    this.o = o; this.canvas = canvas; this.emit = emit || function () {};
    var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;

    var dbg = gl.getExtension('WEBGL_debug_renderer_info');
    var renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    this.soft = !o.hq && /swiftshader|llvmpipe|software|basic render/i.test(renderer);
    this.dprCap = this.soft ? Math.min(o.dpr, 0.6) : o.dpr;
    this.cellW = this.soft ? o.cell[0] / 2 : o.cell[0];
    this.cellH = this.soft ? o.cell[1] / 2 : o.cell[1];
    this.scale = 1; this._ft = 16; this._ftN = 0;
    this.w = 1; this.h = 1; this.dpr = 1;

    this.s = {
      u: 0, vel: 0, speed: 0,
      m: o.tour === 'ride' || o.paused ? 0 : 1,  // overview weight
      f: 0,                                      // focus weight
      yaw: 0.2,
      hovered: -1, focused: -1, fIndex: -1, focusSide: 1,
      rideTime: 0, phase: 'intro', holding: false, visible: true
    };
    this.tweens = {};
    this._lastTravel = -1; this._mode = '';
    this._received = 0;

    this._buildPath();
    this._buildCards();
    this._initGL();

    var self = this;
    this._raf = (typeof G.requestAnimationFrame === 'function') ? G.requestAnimationFrame.bind(G) : function (f) { return setTimeout(function () { f(performance.now()); }, 16); };
    this._loop = function () { if (self._dead) return; self._frame(); self._raf(self._loop); };
    this._raf(this._loop);

    this.emit('init', { cellW: this.cellW, cellH: this.cellH, soft: this.soft });
  }

  var P = RibbonCore.prototype;

  /* ---------- geometry ---------- */
  P._buildPath = function () {
    var fn = PATHS[this.o.path] || PATHS.loop, M = 4096, K = 2048, i;
    var pts = [], cum = [0], L = 0;
    for (i = 0; i <= M; i++) {
      pts.push(fn((i / M) * Math.PI * 2));
      if (i > 0) { L += len(sub(pts[i], pts[i - 1])); cum.push(L); }
    }
    var pos = new Float32Array(K * 3), j = 0, k;
    for (k = 0; k < K; k++) {
      var target = (k / K) * L;
      while (j < M - 1 && cum[j + 1] < target) j++;
      var t = (target - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
      var p = mix(pts[j], pts[j + 1], t);
      pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2];
    }
    var T = new Float32Array(K * 3), S = new Float32Array(K * 3), U = new Float32Array(K * 3);
    var Y = [0, 1, 0], prevS = [1, 0, 0], r = 0;
    for (k = 0; k < K; k++) {
      var a = (k + 1) % K, b = (k - 1 + K) % K;
      var tg = norm([pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2]]);
      var sd = cross(tg, Y);
      sd = len(sd) < 1e-3 ? prevS : norm(sd);
      var up = cross(sd, tg);
      var tw = 0.24 * Math.sin((k / K) * Math.PI * 4);            // gentle ribbon twist
      var c = Math.cos(tw), s = Math.sin(tw);
      T.set(tg, k * 3); S.set(add(mul(sd, c), mul(up, s)), k * 3); U.set(sub(mul(up, c), mul(sd, s)), k * 3);
      prevS = sd;
      r = Math.max(r, len([pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]]));
    }
    this.path = { pos: pos, T: T, S: S, U: U, K: K, L: L, r: r };
    this.N = Math.max(8, Math.min(240, this.o.count | 0));
    this.spacing = L / this.N;
    this.cardH = this.o.cardSize * this.spacing;
    this.cardW = this.cardH * this.o.aspect;
  };

  P._sample = function (u) {
    var pa = this.path, K = pa.K, a = ((((u / this.N) % 1) + 1) % 1) * K;
    var k0 = Math.floor(a) % K, k1 = (k0 + 1) % K, f = a - Math.floor(a);
    function g(arr) {
      return [arr[k0 * 3] + (arr[k1 * 3] - arr[k0 * 3]) * f, arr[k0 * 3 + 1] + (arr[k1 * 3 + 1] - arr[k0 * 3 + 1]) * f, arr[k0 * 3 + 2] + (arr[k1 * 3 + 2] - arr[k0 * 3 + 2]) * f];
    }
    return { p: g(pa.pos), t: norm(g(pa.T)), s: norm(g(pa.S)), up: norm(g(pa.U)) };
  };

  P._buildCards = function () {
    var N = this.N, I = Math.max(1, this.o.items.length), i;
    var center = new Float32Array(N * 3), T = new Float32Array(N * 3), U = new Float32Array(N * 3), tex = new Float32Array(N);
    var rand = rng(this.o.seed * 7919 + 17), order = [];
    while (order.length < N) {                         // shuffled passes, no immediate repeats
      var pass = []; for (i = 0; i < I; i++) pass.push(i);
      for (i = I - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)), x = pass[i]; pass[i] = pass[j]; pass[j] = x; }
      if (order.length && I > 1 && pass[0] === order[order.length - 1]) pass.push(pass.shift());
      order = order.concat(pass);
    }
    this.cards = [];
    for (i = 0; i < N; i++) {
      var sm = this._sample(i);
      // cards stand across the path like a deck: width along the side vector, facing along the path
      center.set(sm.p, i * 3); T.set(sm.s, i * 3); U.set(sm.up, i * 3); tex[i] = order[i];
      this.cards.push({ c: sm.p, t: sm.s, up: sm.up, n: norm(cross(sm.s, sm.up)), item: order[i] });
    }
    this._inst = { center: center, T: T, U: U, tex: tex, state: new Float32Array(N) };
  };

  /* ---------- GL ---------- */
  P._initGL = function () {
    var gl = this.gl, o = this.o;
    this.card = compile(gl, CARD_VS, CARD_FS);
    this.line = compile(gl, LINE_VS, LINE_FS);

    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    function buf(data, loc, size, divisor, usage) {
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      if (divisor) gl.vertexAttribDivisor(loc, 1);
      return b;
    }
    buf(new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), 0, 2, 0);
    buf(this._inst.center, 1, 3, 1); buf(this._inst.T, 2, 3, 1); buf(this._inst.U, 3, 3, 1); buf(this._inst.tex, 4, 1, 1);
    this.stateBuf = buf(this._inst.state, 5, 1, 1, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);

    this.lineVao = gl.createVertexArray(); gl.bindVertexArray(this.lineVao);
    var lb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, lb); gl.bufferData(gl.ARRAY_BUFFER, this.path.pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // texture atlas: each cell starts as the item's flat colour, artwork streams in later
    var I = Math.max(1, o.items.length);
    this.grid = [Math.ceil(Math.sqrt(I)), 0]; this.grid[1] = Math.ceil(I / this.grid[0]);
    this.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.grid[0] * this.cellW, this.grid[1] * this.cellH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    var an = gl.getExtension('EXT_texture_filter_anisotropic');
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    for (var i = 0; i < I; i++) {
      var c = hex((o.items[i] && o.items[i].bg) || '#cccccc'), px = new Uint8Array(this.cellW * this.cellH * 4);
      for (var k = 0; k < px.length; k += 4) { px[k] = c[0] * 255; px[k + 1] = c[1] * 255; px[k + 2] = c[2] * 255; px[k + 3] = 255; }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, (i % this.grid[0]) * this.cellW, Math.floor(i / this.grid[0]) * this.cellH, this.cellW, this.cellH, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
    var inset = 2;
    this.cellUV = [inset / this.cellW, inset / this.cellH, 1 - (2 * inset) / this.cellW, 1 - (2 * inset) / this.cellH];

    this.bg = hex(o.backgroundColor); this.ink = hex(o.inkColor); this.accent = hex(o.accentColor);
    gl.clearColor(this.bg[0], this.bg[1], this.bg[2], 1);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  };

  // artwork for item i arrives as an ImageBitmap (or canvas) at cell size
  P.setImage = function (i, img) {
    var gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, (i % this.grid[0]) * this.cellW, Math.floor(i / this.grid[0]) * this.cellH, gl.RGBA, gl.UNSIGNED_BYTE, img);
    if (img.close) img.close();
    if (++this._received >= this.o.items.length) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      this._ready = true;
      var self = this;
      if (this.o.tour === 'cycle' && !this.o.paused) this._later(1.4, function () { self._dive(2.6); });
    }
  };

  P.resize = function (w, h, dpr) {
    this.w = Math.max(1, w); this.h = Math.max(1, h); this.dpr = dpr || 1;
    var d = Math.min(this.dpr, this.dprCap) * this.scale;
    this.canvas.width = Math.round(this.w * d); this.canvas.height = Math.round(this.h * d);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.aspectR = this.w / this.h;
    this.fovR = this.o.fov * Math.PI / 180;
    var hfov = 2 * Math.atan(Math.tan(this.fovR / 2) * this.aspectR);
    this.overDist = (this.path.r + this.cardH) / Math.sin(Math.min(this.fovR, hfov) / 2) * 1.0;
    this.proj = perspective(this.fovR, this.aspectR, 0.05, 400);
    // lens shift: moves the whole picture on screen (NDC units) without touching the 3D scene
    var sh = this.shift || [0, 0];
    this.proj[8] = -sh[0]; this.proj[9] = -sh[1];
  };

  /* ---------- input (canvas-local CSS pixels) ---------- */
  P.input = function (e) {
    var st = this.s, o = this.o, self = this, d = this._down;
    if (!o.interactive) return;
    if (e.type === 'down') {
      this._down = d = { x: e.x, y: e.y, lx: e.x, ly: e.y, t: e.t, moved: false, touch: e.pointerType === 'touch', hist: [] };
      st.vel = 0;
      if (o.holdToReveal) {
        clearTimeout(this._holdTimer);
        this._holdTimer = setTimeout(function () { if (self._down === d && !d.moved) { d.hold = true; st.holding = true; self._reveal(true); } }, 320);
      }
    } else if (e.type === 'move') {
      if (d) {
        var dx = e.x - d.lx, dy = e.y - d.ly;
        if (Math.abs(e.x - d.x) + Math.abs(e.y - d.y) > 6) d.moved = true;
        if (d.hold) st.yaw -= dx * 0.006;
        else if (d.moved && o.draggable) {
          if (st.focused >= 0) this.release();
          var step = (d.touch ? -dx : dy) * 0.018;
          st.u += step;
          d.hist.push({ t: e.t, v: step }); if (d.hist.length > 6) d.hist.shift();
          this._interacted();
        }
        d.lx = e.x; d.ly = e.y;
      } else if (e.pointerType === 'mouse' && !st.holding) {
        this._setHover(this._pick(e.x, e.y));
      }
    } else if (e.type === 'up' || e.type === 'cancel') {
      if (!d) return;
      clearTimeout(this._holdTimer);
      if (d.hold) { st.holding = false; this._reveal(false); }
      else if (e.type === 'up' && !d.moved && e.t - d.t < 400 && o.focusOnClick) {
        var hit = this._pick(e.x, e.y);
        if (st.focused >= 0 && hit === st.focused && o.openOnFocusedClick) this.emit('open', { item: this.cards[hit].item, card: hit });
        else if (st.focused >= 0 && (hit < 0 || hit === st.focused)) this.release();
        else if (hit >= 0) this.focusCard(hit);
      } else if (d.moved && d.hist.length && !o.reduced) {
        var sum = 0, n = 0;
        d.hist.forEach(function (h) { if (e.t - h.t < 120) { sum += h.v; n++; } });
        if (n) st.vel = (sum / n) * 60;
      }
      this._down = null;
    } else if (e.type === 'leave') {
      if (!d) this._setHover(-1);
    } else if (e.type === 'wheel') {
      if (st.focused >= 0) this.release();
      if (st.m > 0.02 && !st.holding) this._dive(1.2);
      st.vel += clamp(e.dy, -120, 120) * 0.012;
      this._interacted();
    }
  };

  P._pick = function (x, y) {
    if (!this.cam) return -1;
    var sh = this.shift || [0, 0];
    var nx = (x / this.w) * 2 - 1 - sh[0], ny = 1 - (y / this.h) * 2 - sh[1], cam = this.cam;
    var f = norm(sub(cam.target, cam.pos)), right = norm(cross(f, cam.up)), up = cross(right, f), th = Math.tan(this.fovR / 2);
    var dir = norm(add(f, add(mul(right, nx * th * this.aspectR), mul(up, ny * th))));
    var best = -1, bt = Infinity, hw = this.cardW / 2, hh = this.cardH / 2, maxD = this._fog ? this._fog[1] * 0.85 : 1e9;
    for (var i = 0; i < this.cards.length; i++) {
      var c = this.cards[i], den = dot(dir, c.n);
      if (Math.abs(den) < 1e-5) continue;
      var t = dot(sub(c.c, cam.pos), c.n) / den;
      if (t <= 0 || t >= bt || t > maxD) continue;
      var p = sub(add(cam.pos, mul(dir, t)), c.c);
      if (Math.abs(dot(p, c.t)) <= hw && Math.abs(dot(p, c.up)) <= hh) { bt = t; best = i; }
    }
    return best;
  };
  P._setHover = function (i) {
    if (i === this.s.hovered) return;
    this.s.hovered = i;
    this.emit('cursor', { value: i >= 0 ? 'pointer' : (this.o.holdToReveal ? 'grab' : 'default') });
  };

  /* ---------- tweens & tour ---------- */
  P._tween = function (key, to, dur, ease) {
    if (this.o.reduced || !dur) { this.s[key] = to; delete this.tweens[key]; return; }
    this.tweens[key] = { from: this.s[key], to: to, t: 0, dur: dur, ease: EASE[ease] || EASE['power3.inOut'] };
  };
  P._stepTweens = function (dt, realDt) {
    for (var k in this.tweens) {
      var tw = this.tweens[k]; tw.t += k === 'dv' ? realDt : dt;   // opening a work keeps real time, it hands over to a page load
      var p = Math.min(1, tw.t / tw.dur);
      this.s[k] = tw.from + (tw.to - tw.from) * tw.ease(p);
      if (p >= 1) delete this.tweens[k];
    }
  };
  P._later = function (sec, fn) { clearTimeout(this._tourTimer); this._tourTimer = setTimeout(fn, sec * 1000); };
  P._dive = function (dur) {
    clearTimeout(this._tourTimer);
    if (this.o.tour === 'overview') return;
    this.s.phase = 'ride'; this.s.rideTime = 0;
    this._tween('m', 0, dur || 2.2, 'power3.inOut');
  };
  P._pullBack = function () {
    var self = this;
    this.s.phase = 'overview';
    this._tween('m', 1, 2.4, 'power3.inOut');
    this._later(5.2, function () { if (!self.s.holding && self.s.focused < 0) self._dive(2.4); });
  };
  P._reveal = function (on) {
    if (on) {
      clearTimeout(this._tourTimer);
      if (this.s.focused >= 0) this.release(true);
      this._tween('m', 1, 1.1, 'power3.out');
    } else if (this.o.tour !== 'overview') this._dive(1.3);
  };
  P._interacted = function () {
    this.s.rideTime = 0;
    if (this.s.phase === 'overview' && !this.s.holding && this.s.focused < 0) this._dive(1.4);
  };

  /* ---------- commands ---------- */
  P.travel = function (n) {
    if (this.s.focused >= 0) this.release();
    this._tween('u', this.s.u + n, 0.9, 'power3.out');
    this._interacted();
  };
  P.focusCard = function (i) {
    var st = this.s, c = this.cards[i];
    if (!c || (this._mask && !this._mask[c.item])) return;
    clearTimeout(this._tourTimer);
    delete this.tweens.u;
    var camPos = this.cam ? this.cam.pos : add(c.c, c.n);
    st.focusSide = dot(c.n, sub(camPos, c.c)) >= 0 ? 1 : -1;
    this._focusFrom = (st.focused >= 0 && st.f > 0.01 && this.cam) ? { pos: this.cam.pos.slice(), target: this.cam.target.slice(), up: this.cam.up.slice() } : null;
    st.focused = i; st.fIndex = i; st.phase = 'focus'; st.f = 0;
    this._tween('f', 1, 1.3, 'power3.inOut');
    this.emit('focus', { item: c.item, card: i });
  };
  P.focusItem = function (item) {
    var best = -1, bd = Infinity, N = this.N, u = this.s.u;
    for (var i = 0; i < N; i++) {
      if (this.cards[i].item !== item) continue;
      var d = (((i - u) % N) + N) % N; if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0) this.focusCard(best);
  };
  P.release = function (silent) {
    var st = this.s, i = st.focused;
    if (i < 0) return;
    st.u = i - 0.35;                      // ride on from the focused card (hidden while f≈1)
    this._focusFrom = null;
    st.focused = -1; st.phase = 'ride'; st.rideTime = 0;
    this._tween('f', 0, 1.2, 'power3.inOut');
    this._tween('m', 0, 1.2, 'power3.inOut');
    if (!silent) this.emit('focus', { item: -1, card: -1 });
  };
  P.reveal = function () { this._reveal(true); };
  P.setVisible = function (v) { this.s.visible = !!v; };
  P.setShift = function (x, y) { this.shift = [x, y]; if (this.proj) { this.proj[8] = -x; this.proj[9] = -y; } };
  // service filter: works outside it sink into the background and can't be focused
  P.setFilter = function (mask) {
    this._mask = mask && mask.length ? mask : null;
    if (this._mask && this.s.focused >= 0 && !this._mask[this.cards[this.s.focused].item]) this.release();
  };
  P.setArrive = function (a) { this.arrive = Math.max(0, Math.min(1, +a || 0)); };
  P.dive = function () {
    var st = this.s;
    if (st.focused < 0) return;
    clearTimeout(this._tourTimer);
    this._dived = false;
    if (this.o.reduced) { st.dv = 1; return; }
    st.dv = st.dv || 0;
    this._tween('dv', 1, 0.95, 'power2.in');
  };
  P.undive = function () { this.s.dv = 0; this._dived = false; delete this.tweens.dv; };
  P.destroy = function () { this._dead = true; clearTimeout(this._tourTimer); clearTimeout(this._holdTimer); };

  // message router used by the worker bootstrap and the main-thread fallback
  P.handle = function (m) {
    switch (m.type) {
      case 'resize': this.resize(m.w, m.h, m.dpr); break;
      case 'input': this.input(m.e); break;
      case 'image': this.setImage(m.i, m.img); break;
      case 'focusItem': this.focusItem(m.i); break;
      case 'release': this.release(); break;
      case 'travel': this.travel(m.n); break;
      case 'reveal': this.reveal(); break;
      case 'visible': this.setVisible(m.v); break;
      case 'shift': this.setShift(m.x, m.y); break;
      case 'arrive': this.setArrive(m.a); break;
      case 'dive': this.dive(); break;
      case 'filter': this.setFilter(m.m); break;
      case 'undive': this.undive(); break;
      case 'destroy': this.destroy(); break;
    }
  };

  /* ---------- per frame ---------- */
  P._rideCam = function (u) {
    var o = this.o, sp = this.spacing;
    var a = this._sample(u - 1), b = this._sample(u + 6);
    var D = 1.7 * sp * o.offset, H = 1.0 * sp * o.offset;
    var pos = add(a.p, add(mul(a.s, D), mul(a.up, H)));
    var target = add(b.p, add(mul(b.s, -D * 1.35), mul(b.up, -H * 0.75)));
    // roll the view so the ribbon climbs diagonally from lower left to upper right
    var up = norm(add(mul(a.up, 0.6), [0, 0.4, 0])), f = norm(sub(target, pos)), roll = 0.2;
    up = norm(add(mul(up, Math.cos(roll)), mul(cross(f, up), Math.sin(roll))));
    return { pos: pos, target: target, up: up };
  };
  P._overCam = function () {
    var d = this.overDist, y = this.s.yaw, el = 0.45;
    return { pos: [Math.sin(y) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(y) * Math.cos(el) * d], target: [0, 0, 0], up: [0, 1, 0] };
  };
  P._focusCam = function (i) {
    var c = this.cards[i], th = Math.tan(this.fovR / 2), portrait = this.aspectR < 0.8;
    var dh = this.cardH / ((portrait ? 0.5 : 0.6) * 2 * th), dw = this.cardW / (0.82 * 2 * th * this.aspectR);
    var n = mul(c.n, this.s.focusSide);
    var center = add(c.c, mul(n, 0.16 * this.cardH));
    var shift = mul(c.up, -this.cardH * 0.04);
    return { pos: add(add(center, mul(n, Math.max(dh, dw))), shift), target: add(center, shift), up: c.up };
  };

  P._frame = function () {
    var now = performance.now(), st = this.s, o = this.o, N = this.N;
    if (!st.visible || !this.proj) { this._last = now; return; }
    if (this.soft && this._last && now - this._last < 30) return;           // ~30 fps on software GL
    var dt = this._last ? Math.min(0.05, (now - this._last) / 1000) : 0.016;
    this._last = now;

    this._stepTweens(dt, this._lastRaw ? Math.min(0.25, (now - this._lastRaw) / 1000) : dt);
    this._lastRaw = now;
    var target = o.paused || st.focused >= 0 || st.holding || (o.pauseOnHover && st.hovered >= 0) ? 0 : o.speed;
    st.speed += (target - st.speed) * (1 - Math.exp(-dt * 3));
    st.u += (st.speed + st.vel) * dt;
    st.vel *= Math.exp(-dt * 2.4); if (Math.abs(st.vel) < 0.001) st.vel = 0;
    if (!o.paused) st.yaw += dt * 0.05;

    if (o.tour === 'cycle' && !o.paused && st.phase === 'ride' && st.focused < 0 && !st.holding && st.m < 0.01) {
      st.rideTime += dt;
      if (st.rideTime > o.interval) { st.rideTime = 0; this._pullBack(); }
    }

    var ride = this._rideCam(st.u), over = this._overCam(), m = o.tour === 'overview' ? 1 : st.m;
    var pos = mix(ride.pos, over.pos, m), tgt = mix(ride.target, over.target, m), up = norm(mix(ride.up, over.up, m));
    if (st.f > 0 && st.fIndex >= 0) {
      var fc = this._focusCam(st.fIndex), from = this._focusFrom;
      if (from) { pos = from.pos; tgt = from.target; up = from.up; }
      pos = mix(pos, fc.pos, st.f); tgt = mix(tgt, fc.target, st.f); up = norm(mix(up, fc.up, st.f));
    }
    // dive through the focused card (opening a project): the camera passes the card plane and the fog closes
    var dv = st.dv || 0;
    if (dv > 0 && st.fIndex >= 0) {
      var dc = this.cards[st.fIndex], dn = mul(dc.n, st.focusSide);
      pos = mix(pos, add(dc.c, mul(dn, -this.cardH * 0.6)), dv);
      tgt = mix(tgt, add(dc.c, mul(dn, -this.cardH * 3)), dv);
    }
    // arrival from deep fog (scroll-driven on "Mé práce"): pull the camera far back along its view
    var arr = this.arrive || 0;
    if (arr > 0) pos = add(tgt, mul(sub(pos, tgt), 1 + arr * 5));
    this.cam = { pos: pos, target: tgt, up: up };

    var sp = this.spacing, fg = Math.max(0.05, o.fog);
    var rideFog = [2.5 * sp, (26 * sp) / fg], overFog = [this.overDist + this.path.r * 0.4, this.overDist + this.path.r * 3.6 / fg];
    var fogR = [rideFog[0] + (overFog[0] - rideFog[0]) * m, rideFog[1] + (overFog[1] - rideFog[1]) * m];
    fogR[0] += 2 * st.f; fogR[1] += 4 * st.f;
    if (arr > 0) { fogR[0] *= 1 - arr; fogR[1] *= 1 - arr * 0.94; }   // at arr = 1 everything sits inside the fog
    if (dv > 0) { var k = Math.min(1, dv * 1.25); fogR[0] *= 1 - k; fogR[1] = fogR[1] * (1 - k) + 0.02; }
    if (dv >= 1 && !this._dived) { this._dived = true; this.emit('dived', {}); }
    this._fog = fogR;
    // clear the line of sight to the focused card
    this._clip = 0;
    if (st.f > 0 && st.fIndex >= 0) {
      var fcc = this.cards[st.fIndex].c, dF = Math.sqrt(dot(sub(pos, fcc), sub(pos, fcc)));
      this._clip = st.f * Math.max(0, dF - 0.3 * this.cardH);
    }

    var S = this._inst.state, dirty = false, k = 1 - Math.exp(-dt * 10);
    for (var i = 0; i < N; i++) {
      var t = (i === st.focused ? 1 : 0) + (i === st.hovered && st.focused < 0 ? 0.8 : 0);
      if (this._mask && !this._mask[this.cards[i].item]) t = -1;
      if (Math.abs(S[i] - t) > 0.001) { S[i] += (t - S[i]) * k; dirty = true; }
    }
    var gl = this.gl;
    if (dirty) { gl.bindBuffer(gl.ARRAY_BUFFER, this.stateBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, S); }

    var ci = st.focused >= 0 ? st.focused : (((Math.round(st.u + 0.6) % N) + N) % N);
    if (ci !== this._lastTravel) { this._lastTravel = ci; this.emit('travel', { item: this.cards[ci].item, card: ci }); }
    var mode = st.focused >= 0 ? 'focus' : (m > 0.5 ? 'overview' : 'ride');
    if (mode !== this._mode) { this._mode = mode; this.emit('mode', { mode: mode }); }

    var t0 = performance.now();
    this._draw();
    if (this._ready && !this._shown) { this._shown = true; this.emit('ready', {}); }   // first frame with artwork
    this._adapt(performance.now() - t0, dt);
  };

  // lower the render resolution when frames get expensive
  P._adapt = function (cost, dt) {
    this._ft = this._ft * 0.9 + Math.max(cost, dt * 1000) * 0.1;
    if (++this._ftN < 45) return;
    this._ftN = 0;
    if (this._ft > (this.soft ? 45 : 24) && this.scale > 0.5) { this.scale = Math.max(0.5, this.scale * 0.8); this.resize(this.w, this.h, this.dpr); }
  };

  P._draw = function () {
    var gl = this.gl, cam = this.cam, vp = mat4mul(this.proj, lookAt(cam.pos, cam.target, cam.up)), fog = this._fog, u;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (this.o.thread > 0) {
      gl.useProgram(this.line.p); u = this.line.u;
      gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform3fv(u.uCam, cam.pos);
      gl.uniform3fv(u.uColor, this.accent); gl.uniform2fv(u.uFog, fog); gl.uniform1f(u.uAlpha, this.o.thread);
      gl.depthMask(false);
      gl.bindVertexArray(this.lineVao); gl.drawArrays(gl.LINE_LOOP, 0, this.path.K);
    }
    gl.useProgram(this.card.p); u = this.card.u;
    gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform3fv(u.uCam, cam.pos);
    gl.uniform2f(u.uSize, this.cardW, this.cardH);
    gl.uniform2f(u.uGrid, this.grid[0], this.grid[1]);
    gl.uniform4fv(u.uCell, this.cellUV);
    gl.uniform3fv(u.uBg, this.bg); gl.uniform3fv(u.uInk, this.ink);
    gl.uniform2fv(u.uFog, fog);
    gl.uniform1f(u.uRadius, this.o.radius * 0.5 * Math.min(this.cardW, this.cardH));
    gl.uniform1f(u.uShadow, this.o.shadow);
    gl.uniform1f(u.uClip, this._clip || 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(u.uTex, 0);
    gl.bindVertexArray(this.vao);
    if (this.o.shadow > 0) { gl.uniform1f(u.uShadowPass, 1); gl.depthMask(false); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.N); }
    gl.uniform1f(u.uShadowPass, 0); gl.depthMask(true);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.N);
    gl.bindVertexArray(null);
  };

  G.RibbonCore = RibbonCore;

  /* ---------- worker bootstrap ---------- */
  if (typeof WorkerGlobalScope !== 'undefined' && G instanceof WorkerGlobalScope) {
    var core = null;
    G.onmessage = function (e) {
      var m = e.data;
      if (m.type === 'init') {
        try {
          core = new RibbonCore(m.canvas, m.opts, function (type, payload) { payload.type = type; G.postMessage(payload); });
          core.resize(m.w, m.h, m.dpr);
        } catch (err) { G.postMessage({ type: 'error', message: String(err && err.message || err) }); }
      } else if (core) core.handle(m);
    };
  }
})(self);
