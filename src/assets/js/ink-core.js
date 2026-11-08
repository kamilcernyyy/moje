/* Grafysta ink: soft ink that blooms behind the cursor (our own take on the idea of React Bits Pro "Chroma Halo").
   A small stable-fluids simulation in WebGL2: the pointer pushes the fluid and lays down violet / lilac smoke,
   which drifts, curls and fades. When nobody points, an invisible cursor paints slowly on its own.
   Runs in a Web Worker on an OffscreenCanvas; the same file works on the main thread as a fallback (self.GrafystaInk). */
(function () {
  'use strict';

  var VERT = '#version 300 es\nout vec2 vUv;\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUv=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}';
  var HEAD = '#version 300 es\nprecision highp float;\nprecision highp sampler2D;\nin vec2 vUv;\nout vec4 o;\n';

  var FRAG = {
    splat: 'uniform sampler2D uTarget;uniform float uAspect;uniform vec3 uValue;uniform vec2 uPoint;uniform float uRadius;' +
      'void main(){vec2 p=vUv-uPoint;p.x*=uAspect;vec3 s=exp(-dot(p,p)/uRadius)*uValue;o=vec4(texture(uTarget,vUv).xyz+s,1.0);}',
    advect: 'uniform sampler2D uVelocity;uniform sampler2D uSource;uniform vec2 uTexel;uniform float uDt;uniform float uDecay;' +
      'void main(){vec2 c=vUv-uDt*texture(uVelocity,vUv).xy*uTexel;o=vec4(texture(uSource,c).xyz*exp(-uDecay*uDt),1.0);}',
    curl: 'uniform sampler2D uVelocity;uniform vec2 uTexel;' +
      'void main(){float L=texture(uVelocity,vUv-vec2(uTexel.x,0.0)).y;float R=texture(uVelocity,vUv+vec2(uTexel.x,0.0)).y;' +
      'float T=texture(uVelocity,vUv+vec2(0.0,uTexel.y)).x;float B=texture(uVelocity,vUv-vec2(0.0,uTexel.y)).x;o=vec4(0.5*(R-L-T+B),0.0,0.0,1.0);}',
    vorticity: 'uniform sampler2D uVelocity;uniform sampler2D uCurl;uniform vec2 uTexel;uniform float uCurlK;uniform float uDt;' +
      'void main(){float L=texture(uCurl,vUv-vec2(uTexel.x,0.0)).x;float R=texture(uCurl,vUv+vec2(uTexel.x,0.0)).x;' +
      'float T=texture(uCurl,vUv+vec2(0.0,uTexel.y)).x;float B=texture(uCurl,vUv-vec2(0.0,uTexel.y)).x;float C=texture(uCurl,vUv).x;' +
      'vec2 f=0.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+0.0001;f*=uCurlK*C;f.y*=-1.0;' +
      'vec2 v=texture(uVelocity,vUv).xy+f*uDt;o=vec4(clamp(v,-1000.0,1000.0),0.0,1.0);}',
    divergence: 'uniform sampler2D uVelocity;uniform vec2 uTexel;' +
      'void main(){vec2 C=texture(uVelocity,vUv).xy;float L=texture(uVelocity,vUv-vec2(uTexel.x,0.0)).x;float R=texture(uVelocity,vUv+vec2(uTexel.x,0.0)).x;' +
      'float T=texture(uVelocity,vUv+vec2(0.0,uTexel.y)).y;float B=texture(uVelocity,vUv-vec2(0.0,uTexel.y)).y;' +
      'if(vUv.x-uTexel.x<0.0)L=-C.x;if(vUv.x+uTexel.x>1.0)R=-C.x;if(vUv.y+uTexel.y>1.0)T=-C.y;if(vUv.y-uTexel.y<0.0)B=-C.y;' +
      'o=vec4(0.5*(R-L+T-B),0.0,0.0,1.0);}',
    fade: 'uniform sampler2D uTarget;uniform float uValue;void main(){o=vec4(texture(uTarget,vUv).x*uValue,0.0,0.0,1.0);}',
    pressure: 'uniform sampler2D uPressure;uniform sampler2D uDivergence;uniform vec2 uTexel;' +
      'void main(){float L=texture(uPressure,vUv-vec2(uTexel.x,0.0)).x;float R=texture(uPressure,vUv+vec2(uTexel.x,0.0)).x;' +
      'float T=texture(uPressure,vUv+vec2(0.0,uTexel.y)).x;float B=texture(uPressure,vUv-vec2(0.0,uTexel.y)).x;' +
      'o=vec4((L+R+B+T-texture(uDivergence,vUv).x)*0.25,0.0,0.0,1.0);}',
    gradient: 'uniform sampler2D uPressure;uniform sampler2D uVelocity;uniform vec2 uTexel;' +
      'void main(){float L=texture(uPressure,vUv-vec2(uTexel.x,0.0)).x;float R=texture(uPressure,vUv+vec2(uTexel.x,0.0)).x;' +
      'float T=texture(uPressure,vUv+vec2(0.0,uTexel.y)).x;float B=texture(uPressure,vUv-vec2(0.0,uTexel.y)).x;' +
      'o=vec4(texture(uVelocity,vUv).xy-vec2(R-L,T-B),0.0,1.0);}',
    display: 'uniform sampler2D uDye;uniform vec2 uBlur;uniform float uGain;uniform float uOpacity;uniform vec3 uThin;uniform vec3 uDense;' +
      'void main(){float d=texture(uDye,vUv).r*0.4;' +
      'd+=texture(uDye,vUv+vec2(uBlur.x,uBlur.y)).r*0.15;d+=texture(uDye,vUv+vec2(-uBlur.x,uBlur.y)).r*0.15;' +
      'd+=texture(uDye,vUv+vec2(uBlur.x,-uBlur.y)).r*0.15;d+=texture(uDye,vUv-uBlur).r*0.15;' +
      // thin ink is our saturated violet, dense ink turns lilac with a pale core (smoke on a dark page)
      'float a=1.0-exp(-max(d,0.0)*uGain);vec3 hue=mix(uThin,uDense,smoothstep(0.3,0.95,a));' +
      'vec3 col=mix(hue,vec3(1.0),smoothstep(0.8,1.0,a)*0.25)*a;a*=uOpacity;col*=uOpacity;' +
      'float g=(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))))-0.5)/255.0;' +
      'o=vec4(clamp(col+g,0.0,a),a);}'
  };

  var QUALITY = { low: [64, 256], medium: [112, 384], high: [160, 512] };

  var hex = function (h) {
    var m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    if (!m) return [0.32, 0.15, 1];
    return [0, 2, 4].map(function (i) { return parseInt(m[1].slice(i, i + 2), 16) / 255; });
  };
  var raf = typeof self.requestAnimationFrame === 'function' ? function (cb) { return self.requestAnimationFrame(cb); } : function (cb) { return setTimeout(function () { cb(performance.now()); }, 16); };
  var caf = typeof self.cancelAnimationFrame === 'function' ? function (id) { self.cancelAnimationFrame(id); } : function (id) { clearTimeout(id); };

  function createInk(canvas, opts) {
    var o = Object.assign({
      colors: ['#5227FF', '#B19EEF'], size: 64, force: 1, intensity: 1, trail: 1.5, drift: 0.9, blur: 8, opacity: 0.85,
      quality: 'medium', autoplay: true, autoplaySpeed: 1, idleDelay: 1.5, curl: 22, gain: 2.2
    }, opts || {});
    var gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl) return null;
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('EXT_color_buffer_half_float');

    // programs
    var compile = function (type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var P = {};
    Object.keys(FRAG).forEach(function (k) {
      var p = gl.createProgram();
      gl.attachShader(p, vs); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, HEAD + FRAG[k])); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
      P[k] = { p: p, u: u };
    });
    var vao = gl.createVertexArray();

    // render targets (half float, linear filtered)
    var target = function (w, h) {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      var fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('ink: no float render targets');
      gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex: tex, fb: fb, w: w, h: h };
    };
    var pair = function (w, h) {
      var a = target(w, h), b = target(w, h);
      return { read: a, write: b, w: w, h: h, swap: function () { var t = this.read; this.read = this.write; this.write = t; } };
    };
    var free = function (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); };

    var W = 1, H = 1, dpr = 1, vel, dye, prs, div, crl;
    var size = function (base, aspect) { return aspect >= 1 ? [Math.round(base * aspect), base] : [base, Math.round(base / aspect)]; };
    var build = function () {
      [vel, dye, prs].forEach(function (p) { if (p) { free(p.read); free(p.write); } });
      [div, crl].forEach(function (t) { if (t) free(t); });
      var q = QUALITY[o.quality] || QUALITY.medium, aspect = W / H;
      var s = size(q[0], aspect), d = size(q[1], aspect);
      vel = pair(s[0], s[1]); prs = pair(s[0], s[1]); div = target(s[0], s[1]); crl = target(s[0], s[1]);
      dye = pair(d[0], d[1]);
    };

    var use = function (k) { gl.useProgram(P[k].p); return P[k].u; };
    var tex = function (unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t.tex); return unit; };
    var draw = function (t) {
      if (t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, t.w, t.h); }
      else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // input: real pointer points (normalised, y up) and the invisible cursor
    var pts = [], last = null, lastReal = -1e9, inside = false, touch = false, t = 0, auto = null;
    var reduced = !!o.reduced;
    var C = o.colors.map(hex);
    var splat = function (x, y, dx, dy, amount) {
      var aspect = W / H, r = o.size * dpr / (canvas.height || 1);
      gl.bindVertexArray(vao);
      var u = use('splat');
      gl.uniform1f(u.uAspect, aspect); gl.uniform2f(u.uPoint, x, y);
      gl.uniform1f(u.uRadius, r * r / Math.LN2 * 0.5);
      gl.uniform1i(u.uTarget, tex(0, vel.read)); gl.uniform3f(u.uValue, dx, dy, 0);
      draw(vel.write); vel.swap();
      gl.uniform1f(u.uRadius, r * r / Math.LN2);
      gl.uniform1i(u.uTarget, tex(0, dye.read)); gl.uniform3f(u.uValue, amount, 0, 0);
      draw(dye.write); dye.swap();
    };
    var stroke = function (a, b, boost) {
      var dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx * W / H, dy);
      if (dist < 1e-5) return;
      var k = 5200 * o.force;
      splat(b.x, b.y, dx * W / H * k, dy * k, o.intensity * Math.min(1, dist * 9 * (boost || 1)) * 0.55);
    };

    var step = function (dt) {
      gl.bindVertexArray(vao);
      var u, tv = [1 / vel.w, 1 / vel.h];
      u = use('curl'); gl.uniform2fv(u.uTexel, tv); gl.uniform1i(u.uVelocity, tex(0, vel.read)); draw(crl);
      u = use('vorticity'); gl.uniform2fv(u.uTexel, tv); gl.uniform1i(u.uVelocity, tex(0, vel.read)); gl.uniform1i(u.uCurl, tex(1, crl));
      gl.uniform1f(u.uCurlK, o.curl); gl.uniform1f(u.uDt, dt); draw(vel.write); vel.swap();
      u = use('divergence'); gl.uniform2fv(u.uTexel, tv); gl.uniform1i(u.uVelocity, tex(0, vel.read)); draw(div);
      u = use('fade'); gl.uniform1i(u.uTarget, tex(0, prs.read)); gl.uniform1f(u.uValue, 0.8); draw(prs.write); prs.swap();
      u = use('pressure'); gl.uniform2fv(u.uTexel, tv); gl.uniform1i(u.uDivergence, tex(1, div));
      for (var i = 0; i < 18; i++) { gl.uniform1i(u.uPressure, tex(0, prs.read)); draw(prs.write); prs.swap(); }
      u = use('gradient'); gl.uniform2fv(u.uTexel, tv); gl.uniform1i(u.uPressure, tex(0, prs.read)); gl.uniform1i(u.uVelocity, tex(1, vel.read));
      draw(vel.write); vel.swap();
      // fluid keeps moving for `drift` seconds, ink fades over `trail` seconds (≈2 % left)
      u = use('advect'); gl.uniform2fv(u.uTexel, tv); gl.uniform1f(u.uDt, dt);
      gl.uniform1i(u.uVelocity, tex(0, vel.read)); gl.uniform1i(u.uSource, tex(0, vel.read));
      gl.uniform1f(u.uDecay, 3.9 / Math.max(0.05, o.drift)); draw(vel.write); vel.swap();
      gl.uniform1i(u.uVelocity, tex(0, vel.read)); gl.uniform1i(u.uSource, tex(1, dye.read));
      gl.uniform1f(u.uDecay, 3.9 / Math.max(0.05, o.trail)); draw(dye.write); dye.swap();
    };
    var show = function () {
      gl.bindVertexArray(vao);
      var u = use('display');
      gl.uniform1i(u.uDye, tex(0, dye.read));
      gl.uniform2f(u.uBlur, o.blur * dpr / canvas.width * 0.7, o.blur * dpr / canvas.height * 0.7);
      gl.uniform1f(u.uGain, o.gain); gl.uniform1f(u.uOpacity, o.opacity);
      gl.uniform3fv(u.uThin, C[0]); gl.uniform3fv(u.uDense, C[1] || C[0]);
      draw(null);
    };

    var id = 0, prev = 0, running = false, visible = true;
    var frame = function (now) {
      id = 0;
      var dt = Math.min(1 / 30, Math.max(0, (now - prev) / 1000) || 1 / 60);
      prev = now; t += dt;
      // real strokes
      var n = Math.min(pts.length, 12);
      for (var i = 0; i < n; i++) { var p = pts[i]; if (last) stroke(last, p); last = p; }
      pts.length = 0;
      // invisible cursor: a slow wandering figure when nobody points (never for reduced motion)
      var idle = !inside && (now - lastReal) / 1000 > o.idleDelay;
      if (o.autoplay && !reduced && idle) {
        var s = t * 0.5 * o.autoplaySpeed;
        var q = { x: 0.5 + 0.34 * Math.sin(s * 1.0 + 0.6) + 0.06 * Math.sin(s * 3.1), y: 0.5 + 0.3 * Math.sin(s * 1.37) + 0.05 * Math.cos(s * 2.3) };
        if (auto) stroke(auto, q, 4);
        auto = q;
      } else auto = null;
      step(dt);
      show();
      if (running && visible) id = raf(frame);
    };
    var start = function () { if (!id && running && visible) { prev = performance.now(); id = raf(frame); } };

    return {
      resize: function (w, h, ratio) {
        W = Math.max(1, w); H = Math.max(1, h); dpr = Math.min(ratio || 1, 1.5);
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        build();
      },
      move: function (x, y, isTouch) {
        pts.push({ x: x, y: y }); lastReal = performance.now(); inside = true; touch = !!isTouch;
      },
      leave: function () { inside = false; last = null; },
      lift: function () { inside = false; last = null; },
      visible: function (on) { visible = on; if (on) start(); else if (id) { caf(id); id = 0; } },
      start: function () { running = true; start(); },
      destroy: function () { running = false; if (id) caf(id); id = 0; }
    };
  }

  var inWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
  if (inWorker) {
    var ink = null;
    self.onmessage = function (e) {
      var d = e.data;
      if (d.type === 'init') {
        try { ink = createInk(d.canvas, d.opts); } catch (err) { ink = null; }
        if (!ink) { self.postMessage({ type: 'fail' }); return; }
        ink.resize(d.w, d.h, d.dpr); ink.start(); self.postMessage({ type: 'ready' });
      } else if (ink && typeof ink[d.type] === 'function') ink[d.type](d.a, d.b, d.c);
    };
  } else self.GrafystaInk = createInk;
})();
