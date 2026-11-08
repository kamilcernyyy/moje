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

  // the works (content/prace, injected at build time); the painted artworks only stand in when there are none
  var WORKS = window.__PRACE || [];
  var items = WORKS.length ? WORKS.map(function (w) {
    return { src: w.obal, alt: w.nazev + ', ' + w.typLabel, title: w.nazev, subtitle: w.typLabel + ' · ' + w.rok, bg: w.barva, slug: w.slug, typ: w.typ };
  }) : ART.map(function (a, i) {
    return { alt: a.title, title: a.title, subtitle: a.subtitle, draw: a.draw,
      bg: ['#4A12B0', '#2B0A6E', '#E0207F', '#E0207F', '#2B0A6E', '#4A12B0', '#B3123F', '#4A12B0'][i] };
  });

  // opening a work: the camera dives through its card into fog, the detail page clears out of the same fog (variant 2)
  var focused = null, opening = false;
  function open(item) {
    if (!item || !item.slug || opening) return;
    opening = true;
    var href = '/prace/' + item.slug + '/';
    try { sessionStorage.setItem('dive', item.slug); } catch (e) {}
    var r = window.__ribbon;
    if (!r || matchMedia('(prefers-reduced-motion: reduce)').matches) { location.href = href; return; }
    document.documentElement.classList.add('diving');
    r.dive();
    var go = function () { location.href = href; };
    window.__onDived = go;
    setTimeout(go, 1500);   // in case the renderer never reports back
  }
  var openBtn = document.querySelector('.pr-open');
  if (openBtn) openBtn.addEventListener('click', function () { open(focused); });
  addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && focused && !/^(A|BUTTON|INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName)) open(focused);
  });
  addEventListener('pageshow', function (e) { if (e.persisted) { opening = false; document.documentElement.classList.remove('diving'); if (window.__ribbon && window.__ribbon.undive) window.__ribbon.undive(); } });

  var stage = document.getElementById('depth-ribbon');
  var posterMode = /[?&]poster\b/.test(location.search);   // used once at build time to render the first frame
  // without WebGL there is no ribbon: the works are shown as the index instead
  function noRibbon() { document.documentElement.classList.add('no-gl'); setView('rejstrik'); }
  function boot() {
    if (!window.DepthRibbon || !DepthRibbon.supported()) { noRibbon(); return; }
    window.__ribbon = new DepthRibbon(stage, {
      onError: noRibbon,
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
      // the gallery sits below the hero: the mouse wheel scrolls the page, not the ribbon
      wheel: false,
      workerUrl: '/assets/js/ribbon-core.js',
      coreUrl: '/assets/js/ribbon-core.js',
      openOnFocusedClick: !!WORKS.length,
      onReady: function () {
        document.documentElement.setAttribute('data-ribbon-ready', '');
        window.dispatchEvent(new Event('ribbon-ready'));
        // back from a detail page: the ribbon comes back focused on that very card
        var k = (location.search.match(/[?&]k=([a-z0-9-]+)/) || [])[1];
        var i = k ? items.findIndex(function (it) { return it.slug === k; }) : -1;
        if (i >= 0) setTimeout(function () { window.__ribbon.focusItem(i); }, 900);
      },
      onFocusChange: function (item) {
        focused = item;
        document.documentElement.classList.toggle('ribbon-focus', !!item);
        if (openBtn) openBtn.querySelector('span').textContent = item ? item.title : '';
        if (!!item !== !!focusedShift) { focusedShift = !!item; frame(); }
      },
      onOpen: function (item) { open(item); },
      onDived: function () { if (window.__onDived) window.__onDived(); }
    });
    if (!posterMode) frame();
  }
  // lens shift so the nearest cards travel clear of the button panel
  // desktop: picture moves left and up; mobile: up, above the floating panel.
  // A focused card settles lower, between the switches on top and the open button below.
  var shiftNow = null, focusedShift = false;
  function frame() {
    var r = window.__ribbon; if (!r || !r.setShift) return;
    var t = matchMedia('(max-width: 760px)').matches ? (focused ? [0, 0.03] : [0, 0.26]) : (focused ? [-0.24, 0.06] : [-0.24, 0.14]);
    if (!shiftNow || !window.gsap) { shiftNow = { x: t[0], y: t[1] }; r.setShift(t[0], t[1]); return; }
    window.gsap.to(shiftNow, { x: t[0], y: t[1], duration: 0.9, ease: 'power2.inOut', overwrite: true, onUpdate: function () { r.setShift(shiftNow.x, shiftNow.y); } });
  }
  addEventListener('resize', frame);

  // view switch: the ribbon or the index of works (variant 17); the index is plain links with a preview that follows the pointer
  var viewBtns = document.querySelectorAll('.pr-view [data-view]');
  var index = document.getElementById('rejstrik');
  var preview = document.querySelector('.ix-preview');
  function setView(v) {
    viewBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === v)); });
    if (index) index.hidden = v !== 'rejstrik';
    document.documentElement.classList.toggle('index-open', v === 'rejstrik');
    if (window.__ribbon && window.__ribbon.release && v === 'rejstrik') window.__ribbon.release();
  }
  viewBtns.forEach(function (b) { b.addEventListener('click', function () { setView(b.getAttribute('data-view')); }); });
  if (/#rejstrik$/.test(location.hash)) setView('rejstrik');

  // service filter (variant 19): narrows the index to one kind of work
  var filterBtns = document.querySelectorAll('.pr-filter [data-typ]');
  function setFilter(t) {
    filterBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-typ') === t)); });
    document.querySelectorAll('.ix-list li[data-typ]').forEach(function (li) { li.hidden = !!t && li.getAttribute('data-typ') !== t; });
  }
  filterBtns.forEach(function (b) { b.addEventListener('click', function () { setFilter(b.getAttribute('data-typ')); }); });
  if (index && preview) {
    var px = 0, py = 0, qx = 0, qy = 0, praf = 0;
    var move = function () {
      qx += (px - qx) * 0.2; qy += (py - qy) * 0.2;
      preview.style.transform = 'translate3d(' + (qx + 24).toFixed(1) + 'px,' + (qy - 140).toFixed(1) + 'px,0) rotate(' + ((px - qx) * 0.04).toFixed(2) + 'deg)';
      praf = Math.abs(px - qx) + Math.abs(py - qy) > 0.5 ? requestAnimationFrame(move) : 0;
    };
    index.addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; if (!praf) praf = requestAnimationFrame(move); });
    index.addEventListener('pointerover', function (e) {
      var a = e.target.closest && e.target.closest('.ix-item');
      if (!a) return;
      if (preview.getAttribute('src') !== a.dataset.img) preview.src = a.dataset.img;
      preview.classList.add('is-on');
    });
    index.addEventListener('pointerout', function (e) { if (!(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.ix-item'))) preview.classList.remove('is-on'); });
  }

  // start WebGL after the page has loaded so it never competes with first paint
  var later = function () { if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 600 }); else setTimeout(boot, 100); };
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
})();
