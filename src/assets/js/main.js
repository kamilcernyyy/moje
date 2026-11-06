/* Grafysta — Depth Ribbon page */
(function () {
  'use strict';

  /* Original abstract artworks, painted at runtime (no image downloads).
     To use real images, give an item `src: 'assets/works/name.webp'` (square) instead of `draw`. */
  var P = { violet: '#2B0A6E', violet2: '#4A12B0', magenta: '#E0207F', pink: '#FF5DA2', coral: '#FF4B3A', orange: '#FF8A1F', yellow: '#FFE04A', red: '#B3123F' };

  function grad(c, x0, y0, x1, y1, stops) {
    var g = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    return g;
  }
  function radial(c, x, y, r, stops) {
    var g = c.createRadialGradient(x, y, 0, x, y, r);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    return g;
  }
  function grain(c, W, H) {
    var n = 2600, seed = 11;
    c.globalAlpha = .06;
    for (var i = 0; i < n; i++) {
      seed = (seed * 9301 + 49297) % 233280; var x = seed / 233280 * W;
      seed = (seed * 9301 + 49297) % 233280; var y = seed / 233280 * H;
      c.fillStyle = i % 2 ? '#fff' : '#000'; c.fillRect(x, y, 1.4, 1.4);
    }
    c.globalAlpha = 1;
  }

  var ART = [
    { title: 'Brána', subtitle: 'Oblouk otevřený do tepla', draw: function (c, W, H) {
      c.fillStyle = grad(c, 0, 0, W, H, [[0, P.violet2], [1, P.violet]]); c.fillRect(0, 0, W, H);
      c.fillStyle = grad(c, 0, H * .2, 0, H, [[0, P.pink], [1, P.magenta]]);
      c.beginPath(); c.moveTo(W * .2, H); c.lineTo(W * .2, H * .45); c.arc(W * .5, H * .45, W * .3, Math.PI, 0); c.lineTo(W * .8, H); c.fill();
      c.fillStyle = grad(c, 0, H * .3, 0, H * .9, [[0, P.yellow], [1, P.orange]]);
      c.beginPath(); c.moveTo(W * .33, H); c.lineTo(W * .33, H * .5); c.arc(W * .5, H * .5, W * .17, Math.PI, 0); c.lineTo(W * .67, H); c.fill();
      c.fillStyle = grad(c, 0, H * .7, W, H, [[0, 'rgba(74,18,176,.95)'], [1, 'rgba(43,10,110,.95)']]);
      c.beginPath(); c.moveTo(0, H * .86); c.lineTo(W, H * .7); c.lineTo(W, H); c.lineTo(0, H); c.fill(); grain(c, W, H);
    } },
    { title: 'Citron', subtitle: 'Žlutý bod v diagonále', draw: function (c, W, H) {
      c.fillStyle = P.violet; c.fillRect(0, 0, W, H);
      c.fillStyle = radial(c, W * .62, H * .42, W * .3, [[0, '#FFF27A'], [1, P.yellow]]); c.beginPath(); c.arc(W * .62, H * .42, W * .28, 0, Math.PI * 2); c.fill();
      c.fillStyle = grad(c, 0, 0, W, H, [[0, P.pink], [1, P.magenta]]);
      c.beginPath(); c.moveTo(0, H * .08); c.lineTo(W * .26, 0); c.lineTo(W, H * .78); c.lineTo(W, H); c.lineTo(W * .7, H); c.lineTo(0, H * .34); c.fill(); grain(c, W, H);
    } },
    { title: 'Okvětí', subtitle: 'Tři oblouky přes sebe', draw: function (c, W, H) {
      c.fillStyle = grad(c, 0, 0, 0, H, [[0, P.coral], [1, P.magenta]]); c.fillRect(0, 0, W, H);
      [[.3, '#FF9BC4'], [.5, P.pink], [.7, P.violet2]].forEach(function (k, i) {
        c.fillStyle = k[1]; c.globalAlpha = .9; c.beginPath(); c.ellipse(W * k[0], H * (.62 - i * .06), W * .26, H * .44, (i - 1) * .35, 0, Math.PI * 2); c.fill();
      });
      c.globalAlpha = 1; grain(c, W, H);
    } },
    { title: 'Spektrum', subtitle: 'Přechod z růžové do fialové', draw: function (c, W, H) {
      c.fillStyle = grad(c, 0, 0, W, H, [[0, P.pink], [.55, P.magenta], [1, P.violet2]]); c.fillRect(0, 0, W, H);
      c.fillStyle = radial(c, W * .35, H * .38, W * .45, [[0, 'rgba(255,224,74,.85)'], [1, 'rgba(255,224,74,0)']]); c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(43,10,110,.7)'; c.beginPath(); c.arc(W * .72, H * .75, W * .34, 0, Math.PI * 2); c.fill(); grain(c, W, H);
    } },
    { title: 'Posun', subtitle: 'Vlna směrem ke korálové', draw: function (c, W, H) {
      c.fillStyle = P.violet; c.fillRect(0, 0, W, H);
      c.fillStyle = grad(c, 0, 0, W, 0, [[0, P.magenta], [1, P.coral]]);
      c.beginPath(); c.moveTo(0, H * .55); c.bezierCurveTo(W * .3, H * .2, W * .6, H * .9, W, H * .35); c.lineTo(W, H); c.lineTo(0, H); c.fill();
      c.fillStyle = grad(c, 0, H * .6, W, H, [[0, P.orange], [1, P.yellow]]);
      c.beginPath(); c.moveTo(0, H * .82); c.bezierCurveTo(W * .35, H * .6, W * .65, H * 1.05, W, H * .7); c.lineTo(W, H); c.lineTo(0, H); c.fill(); grain(c, W, H);
    } },
    { title: 'Rovnováha', subtitle: 'Světlý bod na hraně', draw: function (c, W, H) {
      c.fillStyle = P.violet2; c.fillRect(0, 0, W, H);
      c.fillStyle = grad(c, 0, 0, 0, H, [[0, P.pink], [1, P.magenta]]);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, H * .3); c.quadraticCurveTo(W * .5, H * .75, 0, H * .52); c.fill();
      c.fillStyle = radial(c, W * .5, H * .5, W * .14, [[0, '#FFF6A8'], [1, P.yellow]]); c.beginPath(); c.arc(W * .5, H * .52, W * .12, 0, Math.PI * 2); c.fill(); grain(c, W, H);
    } },
    { title: 'Prstenec', subtitle: 'Teplo kolem prázdného středu', draw: function (c, W, H) {
      c.fillStyle = grad(c, 0, 0, W, H, [[0, P.red], [1, P.violet]]); c.fillRect(0, 0, W, H);
      c.lineWidth = W * .16; c.strokeStyle = grad(c, 0, 0, W, H, [[0, P.yellow], [.5, P.orange], [1, P.coral]]);
      c.beginPath(); c.arc(W * .5, H * .5, W * .27, 0, Math.PI * 2); c.stroke(); grain(c, W, H);
    } },
    { title: 'Ohyb', subtitle: 'Prudká změna směru', draw: function (c, W, H) {
      c.fillStyle = grad(c, 0, 0, 0, H, [[0, P.violet2], [1, P.violet]]); c.fillRect(0, 0, W, H);
      c.fillStyle = grad(c, 0, 0, W, H, [[0, P.coral], [1, P.magenta]]);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(W * .78, 0); c.lineTo(W * .42, H * .5); c.lineTo(W, H); c.lineTo(0, H); c.fill();
      c.fillStyle = 'rgba(255,138,31,.85)'; c.beginPath(); c.moveTo(W * .78, 0); c.lineTo(W, 0); c.lineTo(W, H * .2); c.lineTo(W * .56, H * .52); c.lineTo(W * .42, H * .5); c.fill(); grain(c, W, H);
    } }
  ];

  var items = ART.map(function (a, i) {
    return { alt: a.title, title: a.title, subtitle: a.subtitle, draw: a.draw,
      bg: ['#4A12B0', '#2B0A6E', '#E0207F', '#E0207F', '#2B0A6E', '#4A12B0', '#B3123F', '#4A12B0'][i],
      // flame colour of the headpage panel while this work is closest to the camera
      flame: ['#FF5DA2', '#FFD23F', '#FF6FB0', '#C04DFF', '#FF6A3D', '#FFD23F', '#FF8A1F', '#FF4B3A'][i] };
  });

  var stage = document.getElementById('depth-ribbon');
  var posterMode = /[?&]poster\b/.test(location.search);   // used once at build time to render the first frame
  function boot() {
    if (!window.DepthRibbon || !DepthRibbon.supported()) return;
    window.__ribbon = new DepthRibbon(stage, {
      items: items,
      count: 72,
      path: 'loop',
      tour: posterMode ? 'overview' : 'cycle',
      paused: posterMode,
      hq: posterMode,
      interval: 9,
      speed: 0.6,
      cardSize: 0.86,
      aspect: 1,
      radius: 0.12,
      offset: 0.8,
      fov: 60,
      fog: 1,
      thread: 0.3,
      shadow: 0.5,
      accentColor: '#B19EEF',
      backgroundColor: '#0a0a0a',
      seed: 0,
      dpr: 2,
      workerUrl: 'assets/js/ribbon-core.js',
      coreUrl: 'assets/js/ribbon-core.js',
      onReady: function () {
        document.documentElement.setAttribute('data-ribbon-ready', '');
        window.dispatchEvent(new Event('ribbon-ready'));
      },
      onTravel: function (item) { if (item) window.dispatchEvent(new CustomEvent('ribbon-travel', { detail: { color: item.flame } })); },
      onFocusChange: function (item) { document.documentElement.classList.toggle('ribbon-focus', !!item); }
    });
    if (!posterMode) frame();
  }
  // lens shift so the nearest cards travel clear of the button panel
  // desktop: picture moves left and up; mobile: up, above the floating panel
  function frame() {
    var r = window.__ribbon; if (!r || !r.setShift) return;
    if (matchMedia('(max-width: 760px)').matches) r.setShift(0, 0.26);
    else r.setShift(-0.24, 0.14);
  }
  addEventListener('resize', frame);

  // start WebGL after the page has loaded so it never competes with first paint
  var later = function () { if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 600 }); else setTimeout(boot, 100); };
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
})();
