/* Grafysta — headpage controller */
(function () {
  'use strict';

  var D = document;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gsap = window.gsap;

  /* ------------------------------------------------------------------
   * Práce. Každá položka může mít `src` (screenshot / foto, poměr 4:5),
   * pak se místo vygenerovaného plakátu použije obrázek.
   * ------------------------------------------------------------------ */
  var WORKS = [
    { title: 'Kamstav', sub: 'Web & logo · kamenné stavby', tag: 'Web', bg: '#1E3BB3', fg: '#F2EEE6', ac: '#9FB0F0', motif: 'cairn', face: 'sans' },
    { title: 'Kavárna Paulus', sub: 'Web · Svatý Kopeček', tag: 'Web', bg: '#2E211A', fg: '#F1E6D6', ac: '#C98B5B', motif: 'cup', face: 'serif' },
    { title: 'Bistro Paulus', sub: 'Redesign webu · Olomouc', tag: 'Web', bg: '#F5F0E6', fg: '#1A1512', ac: '#B8502A', motif: 'plates', face: 'serif' },
    { title: 'ŠEBELA TOOL', sub: 'Firemní web', tag: 'Web', bg: '#23272B', fg: '#E9E6DF', ac: '#F2B705', motif: 'grid', face: 'sans' },
    { title: 'Kadeřnictví\nTOM', sub: 'Web · barber, Olomouc', tag: 'Web', bg: '#121212', fg: '#F4F1EC', ac: '#C8322B', motif: 'stripes', face: 'sans' },
    { title: 'U Brzusků', sub: 'Web · pivnice, Olomouc', tag: 'Web', bg: '#1B130B', fg: '#F3E2C0', ac: '#D99A2B', motif: 'bubbles', face: 'serif' },
    { title: 'SF Welding', sub: 'Web · svářečské práce', tag: 'Web', bg: '#0F0F11', fg: '#F2F2F2', ac: '#FF6A00', motif: 'sparks', face: 'sans' },
    { title: 'DD Sirup', sub: 'Brand & produktová stránka', tag: 'Brand', bg: '#6A1222', fg: '#F4E9DC', ac: '#E7A8A0', motif: 'bottle', face: 'serif' },
    { title: 'Škola Populo', sub: 'Kampaň & motion grafika', tag: 'Motion', bg: '#0B1FD4', fg: '#FFFFFF', ac: '#FFD600', motif: 'dots', face: 'sans' },
    { title: 'Salzerova\nreduta', sub: 'Audit webu · PDF report', tag: 'Audit', bg: '#EDE6DA', fg: '#1D1A16', ac: '#2F6B4F', motif: 'gauge', face: 'serif' },
    { title: 'HP Domy', sub: 'Motion & prodejní landing', tag: 'Motion', bg: '#E7ECF1', fg: '#14233A', ac: '#2E7D5B', motif: 'bars', face: 'sans' },
    { title: 'JK Santé', sub: 'Redesign webu · kosmetika', tag: 'Web', bg: '#16130F', fg: '#EFE7DA', ac: '#B8955A', motif: 'arch', face: 'serif' },
    { title: 'Navždy spolu', sub: 'Vizuální identita', tag: 'Identita', bg: '#F0ECE4', fg: '#1E1C19', ac: '#9B8255', ac2: '#64B9AF', motif: 'vein', face: 'italic' },
    { title: 'Street Bar', sub: 'Brand & maskot', tag: 'Brand', bg: '#1E2421', fg: '#ECEFE9', ac: '#F2A541', motif: 'chalk', face: 'sans' },
    { title: 'Dračí doupě', sub: 'Kronika · sazba pro tisk', tag: 'Tisk', bg: '#E3D2AC', fg: '#2A1B12', ac: '#8E1F1A', motif: 'rune', face: 'serif' },
    { title: 'P+Sch catering', sub: 'Cenová nabídka · tisk', tag: 'Tisk', bg: '#F4F2EE', fg: '#1C1C1C', ac: '#C76B3B', motif: 'table', face: 'sans' }
  ];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function plain(t) { return t.replace(/\n/g, ' '); }

  /* ---------------- procedurální plakáty ---------------- */
  var FACES = {
    sans: '600 {s}px Geist, system-ui, sans-serif',
    serif: '400 {s}px "Instrument Serif", Georgia, serif',
    italic: 'italic 400 {s}px "Instrument Serif", Georgia, serif',
    mono: '500 {s}px "Geist Mono", ui-monospace, monospace'
  };
  function font(face, s) { return FACES[face].replace('{s}', s); }

  var MOTIFS = {
    cairn: function (c, w, h, it) {
      var stones = [[0.5, 0.52, 0.3, 0.07], [0.47, 0.42, 0.22, 0.06], [0.53, 0.33, 0.16, 0.05], [0.49, 0.255, 0.1, 0.04]];
      stones.forEach(function (s, i) {
        c.fillStyle = i % 2 ? it.ac : it.fg; c.beginPath();
        c.ellipse(s[0] * w, s[1] * h, s[2] * w, s[3] * h, (i - 1.5) * 0.05, 0, Math.PI * 2); c.fill();
      });
    },
    cup: function (c, w, h, it) {
      c.strokeStyle = it.fg; c.lineWidth = 3;
      c.beginPath(); c.ellipse(w * 0.5, h * 0.38, w * 0.26, h * 0.07, 0, 0, Math.PI * 2); c.stroke();
      c.fillStyle = it.ac; c.beginPath(); c.ellipse(w * 0.5, h * 0.38, w * 0.22, h * 0.055, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(w * 0.24, h * 0.38); c.bezierCurveTo(w * 0.26, h * 0.56, w * 0.74, h * 0.56, w * 0.76, h * 0.38); c.stroke();
      c.beginPath(); c.arc(w * 0.8, h * 0.44, w * 0.06, -1.2, 1.4); c.stroke();
      for (var i = 0; i < 3; i++) { c.beginPath(); c.moveTo(w * (0.42 + i * 0.08), h * 0.27); c.bezierCurveTo(w * (0.38 + i * 0.08), h * 0.22, w * (0.46 + i * 0.08), h * 0.19, w * (0.42 + i * 0.08), h * 0.14); c.stroke(); }
    },
    plates: function (c, w, h, it) {
      [[0.34, 0.33, 0.2], [0.68, 0.42, 0.16], [0.42, 0.56, 0.12]].forEach(function (p, i) {
        c.strokeStyle = it.fg; c.lineWidth = 2; c.beginPath(); c.arc(p[0] * w, p[1] * h, p[2] * w, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.arc(p[0] * w, p[1] * h, p[2] * w * 0.7, 0, Math.PI * 2); c.stroke();
        c.fillStyle = it.ac; c.beginPath(); c.arc(p[0] * w + (i - 1) * 6, p[1] * h, p[2] * w * 0.32, 0, Math.PI * 2); c.fill();
      });
    },
    grid: function (c, w, h, it) {
      c.strokeStyle = it.fg; c.globalAlpha = 0.18; c.lineWidth = 1;
      for (var x = 0; x <= w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (var y = 0; y <= h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      c.globalAlpha = 1; c.strokeStyle = it.ac; c.lineWidth = 10;
      var cx = w * 0.5, cy = h * 0.38, r = w * 0.2;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
      for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; c.beginPath(); c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); c.lineTo(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35); c.stroke(); }
      c.fillStyle = it.fg; c.beginPath(); c.arc(cx, cy, r * 0.35, 0, Math.PI * 2); c.fill();
    },
    stripes: function (c, w, h, it) {
      c.save(); c.beginPath(); c.rect(w * 0.36, h * 0.08, w * 0.28, h * 0.52); c.clip();
      c.fillStyle = it.fg; c.fillRect(0, 0, w, h);
      c.translate(w / 2, h * 0.34); c.rotate(-0.5);
      for (var i = -12; i < 12; i++) { c.fillStyle = i % 2 ? it.ac : '#1F3A93'; if (i % 3 === 0) continue; c.fillRect(-w, i * 26, w * 2, 12); }
      c.restore();
      c.fillStyle = it.fg; c.fillRect(w * 0.33, h * 0.06, w * 0.34, 14); c.fillRect(w * 0.33, h * 0.6, w * 0.34, 14);
    },
    bubbles: function (c, w, h, it) {
      c.fillStyle = it.ac; c.fillRect(w * 0.3, h * 0.16, w * 0.4, h * 0.44);
      c.fillStyle = it.fg; c.beginPath(); c.ellipse(w * 0.5, h * 0.16, w * 0.24, h * 0.06, 0, 0, Math.PI * 2); c.fill();
      var seed = 7; function r() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
      c.fillStyle = it.fg; c.globalAlpha = 0.55;
      for (var i = 0; i < 26; i++) { c.beginPath(); c.arc(w * (0.33 + r() * 0.34), h * (0.24 + r() * 0.34), 2 + r() * 5, 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = 1;
    },
    sparks: function (c, w, h, it) {
      var seed = 3; function r() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
      var cx = w * 0.32, cy = h * 0.5;
      for (var i = 0; i < 60; i++) {
        var a = -Math.PI * 0.95 + r() * Math.PI * 0.9, L = 40 + r() * w * 0.6;
        c.strokeStyle = r() > 0.3 ? it.ac : it.fg; c.lineWidth = 1 + r() * 2.5; c.globalAlpha = 0.4 + r() * 0.6;
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); c.stroke();
      }
      c.globalAlpha = 1; c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, 9, 0, Math.PI * 2); c.fill();
    },
    bottle: function (c, w, h, it) {
      var x = w * 0.5, t = h * 0.08;
      c.fillStyle = it.fg;
      c.fillRect(x - 18, t, 36, 46);
      c.beginPath(); c.moveTo(x - 22, t + 46); c.lineTo(x + 22, t + 46); c.bezierCurveTo(x + 30, t + 90, x + 86, t + 100, x + 86, t + 150);
      c.lineTo(x + 86, h * 0.6); c.lineTo(x - 86, h * 0.6); c.lineTo(x - 86, t + 150); c.bezierCurveTo(x - 86, t + 100, x - 30, t + 90, x - 22, t + 46); c.fill();
      c.fillStyle = it.ac; c.fillRect(x - 64, h * 0.33, 128, h * 0.17);
      c.strokeStyle = it.bg; c.lineWidth = 2; c.strokeRect(x - 56, h * 0.345, 112, h * 0.14);
      c.fillStyle = it.bg; c.font = font('italic', 26); c.textAlign = 'center'; c.fillText('Grenadine', x, h * 0.43);
      c.textAlign = 'left';
    },
    dots: function (c, w, h, it) {
      c.fillStyle = it.fg; c.globalAlpha = 0.35;
      for (var x = 24; x < w; x += 24) for (var y = 24; y < h * 0.62; y += 24) { c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = 1; c.fillStyle = it.ac; c.beginPath();
      c.moveTo(w * 0.28, h * 0.22); c.bezierCurveTo(w * 0.5, h * 0.08, w * 0.86, h * 0.2, w * 0.78, h * 0.4);
      c.bezierCurveTo(w * 0.7, h * 0.6, w * 0.32, h * 0.58, w * 0.24, h * 0.44); c.bezierCurveTo(w * 0.18, h * 0.34, w * 0.2, h * 0.26, w * 0.28, h * 0.22); c.fill();
      c.fillStyle = it.bg; c.font = font('sans', 150); c.fillText('P', w * 0.42, h * 0.48);
    },
    gauge: function (c, w, h, it) {
      [[0.3, 54, 'Výkon'], [0.7, 50, 'SEO']].forEach(function (g) {
        var cx = w * g[0], cy = h * 0.36, r = w * 0.15;
        c.lineWidth = 12; c.strokeStyle = 'rgba(0,0,0,.1)'; c.beginPath(); c.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25); c.stroke();
        c.strokeStyle = '#C0392B'; c.beginPath(); c.arc(cx, cy, r, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * g[1] / 100)); c.stroke();
        c.fillStyle = it.fg; c.font = font('serif', 54); c.textAlign = 'center'; c.fillText(String(g[1]), cx, cy + 16);
        c.font = font('mono', 14); c.fillText(g[2].toUpperCase(), cx, cy + r + 26); c.textAlign = 'left';
      });
    },
    bars: function (c, w, h, it) {
      var hs = [0.3, 0.42, 0.5, 0.38, 0.46];
      hs.forEach(function (v, i) {
        var x = w * 0.14 + i * w * 0.15, top = h * (0.6 - v);
        c.fillStyle = it.fg; c.fillRect(x, top, w * 0.11, h * v);
        c.fillStyle = it.bg; for (var y = top + 14; y < h * 0.58; y += 22) { c.fillRect(x + 8, y, 10, 10); c.fillRect(x + w * 0.11 - 18, y, 10, 10); }
      });
      for (var i = 0; i < 10; i++) { c.fillStyle = i < 7 ? it.ac : 'rgba(20,35,58,.2)'; c.beginPath(); c.arc(w * 0.14 + i * 38, h * 0.08, 8, 0, Math.PI * 2); c.fill(); }
    },
    arch: function (c, w, h, it) {
      var g = c.createLinearGradient(0, h * 0.1, 0, h * 0.6); g.addColorStop(0, it.ac); g.addColorStop(1, '#5A4630');
      c.fillStyle = g; c.beginPath(); c.moveTo(w * 0.28, h * 0.6); c.lineTo(w * 0.28, h * 0.3); c.arc(w * 0.5, h * 0.3, w * 0.22, Math.PI, 0); c.lineTo(w * 0.72, h * 0.6); c.fill();
      c.strokeStyle = it.ac; c.lineWidth = 1.5; c.beginPath(); c.moveTo(w * 0.22, h * 0.6); c.lineTo(w * 0.22, h * 0.3); c.arc(w * 0.5, h * 0.3, w * 0.28, Math.PI, 0); c.lineTo(w * 0.78, h * 0.6); c.stroke();
    },
    vein: function (c, w, h, it) {
      c.strokeStyle = it.ac; c.globalAlpha = 0.55; c.lineWidth = 1.4;
      for (var k = 0; k < 4; k++) { c.beginPath(); c.moveTo(-10, h * (0.1 + k * 0.12)); c.bezierCurveTo(w * 0.3, h * (0.2 + k * 0.05), w * 0.6, h * (0.02 + k * 0.14), w + 10, h * (0.18 + k * 0.1)); c.stroke(); }
      c.globalAlpha = 1; c.fillStyle = it.ac; c.fillRect(w * 0.42, h * 0.46, w * 0.16, 2);
      c.fillStyle = it.ac2; c.font = font('mono', 13); c.textAlign = 'center'; c.fillText('NAVŽDY SPOLU', w / 2, h * 0.42); c.textAlign = 'left';
      c.strokeStyle = it.ac; c.lineWidth = 1.5; c.beginPath(); c.arc(w / 2, h * 0.27, 40, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(w / 2 + 22, h * 0.27, 40, 0, Math.PI * 2); c.stroke();
    },
    chalk: function (c, w, h, it) {
      c.fillStyle = it.fg; c.globalAlpha = 0.55; c.font = font('serif', 30);
      [['E = mc²', 0.08, 0.12], ['π ≈ 3,14159', 0.46, 0.2], ['∫ x dx', 0.12, 0.34], ['√2', 0.7, 0.36], ['a² + b² = c²', 0.2, 0.5]].forEach(function (f) { c.fillText(f[0], w * f[1], h * f[2]); });
      c.globalAlpha = 1; c.strokeStyle = it.ac; c.lineWidth = 4; c.beginPath();
      c.moveTo(w * 0.62, h * 0.06); c.lineTo(w * 0.52, h * 0.24); c.lineTo(w * 0.62, h * 0.24); c.lineTo(w * 0.5, h * 0.44); c.stroke();
    },
    rune: function (c, w, h, it) {
      c.strokeStyle = it.fg; c.lineWidth = 2; c.strokeRect(w * 0.08, h * 0.06, w * 0.84, h * 0.56);
      c.strokeRect(w * 0.1, h * 0.075, w * 0.8, h * 0.53);
      c.fillStyle = it.ac; c.beginPath(); c.moveTo(w * 0.5, h * 0.14); c.lineTo(w * 0.66, h * 0.34); c.lineTo(w * 0.5, h * 0.54); c.lineTo(w * 0.34, h * 0.34); c.fill();
      c.fillStyle = it.bg; c.font = font('serif', 96); c.textAlign = 'center'; c.fillText('D', w * 0.5, h * 0.4); c.textAlign = 'left';
    },
    table: function (c, w, h, it) {
      c.fillStyle = it.fg; c.font = font('mono', 15);
      var rows = [['Položka', 'Kč'], ['Návrh webu', '—'], ['Vývoj', '—'], ['Fotografie', '—'], ['Celkem', '—']];
      rows.forEach(function (r, i) {
        var y = h * 0.14 + i * 44;
        c.globalAlpha = i === 0 ? 0.55 : 1; c.fillText(r[0], w * 0.1, y); c.textAlign = 'right'; c.fillText(r[1], w * 0.9, y); c.textAlign = 'left';
        c.globalAlpha = 0.2; c.fillRect(w * 0.1, y + 14, w * 0.8, 1);
      });
      c.globalAlpha = 1; c.fillStyle = it.ac; c.fillRect(w * 0.1, h * 0.14 + 4 * 44 + 18, w * 0.8, 4);
    }
  };

  function drawPoster(c, W, H, it, i) {
    c.fillStyle = it.bg; c.fillRect(0, 0, W, H);
    c.textBaseline = 'alphabetic';
    if (MOTIFS[it.motif]) { c.save(); c.translate(0, 26); MOTIFS[it.motif](c, W, H, it); c.restore(); }
    // slug line
    c.fillStyle = it.fg; c.globalAlpha = 0.72; c.font = font('mono', 14);
    c.fillText('№ ' + pad(i + 1), 28, 40);
    c.textAlign = 'right'; c.fillText(it.tag.toUpperCase(), W - 28, 40); c.textAlign = 'left';
    c.globalAlpha = 1;
    // title, auto-fit
    var lines = it.title.split('\n'), size = 76, maxW = W - 56;
    c.font = font(it.face, size);
    while (size > 30 && Math.max.apply(null, lines.map(function (l) { return c.measureText(l).width; })) > maxW) { size -= 2; c.font = font(it.face, size); }
    var lh = size * (it.face === 'sans' ? 0.98 : 0.92), y = H - 64 - (lines.length - 1) * lh;
    if (it.face === 'sans') c.letterSpacing = '-1px';
    lines.forEach(function (l, k) { c.fillText(l, 26, y + k * lh); });
    c.letterSpacing = '0px';
    c.globalAlpha = 0.72; c.font = font('mono', 14); c.fillText(it.sub.toUpperCase(), 28, H - 30); c.globalAlpha = 1;
    // crop marks
    c.strokeStyle = it.fg; c.globalAlpha = 0.35; c.lineWidth = 1;
    [[10, 10, 1, 1], [W - 10, 10, -1, 1], [10, H - 10, 1, -1], [W - 10, H - 10, -1, -1]].forEach(function (m) {
      c.beginPath(); c.moveTo(m[0], m[1] + m[3] * 8); c.lineTo(m[0], m[1]); c.lineTo(m[0] + m[2] * 8, m[1]); c.stroke();
    });
    c.globalAlpha = 1;
  }

  /* ---------------- UI refs ---------------- */
  var stage = D.getElementById('ribbon');
  var counter = D.getElementById('frame-count');
  var counterTitle = D.getElementById('frame-title');
  var caption = D.getElementById('caption');
  var capNum = D.getElementById('cap-num'), capTitle = D.getElementById('cap-title'), capSub = D.getElementById('cap-sub');
  var panel = D.getElementById('index-panel');
  var root = D.documentElement;
  var ribbon = null;

  // the index list is static HTML (crawlable); wire it to the ribbon
  D.querySelectorAll('#work-list .work').forEach(function (b) {
    b.addEventListener('click', function () {
      if (ribbon) { closePanel(); ribbon.focusItem(+b.getAttribute('data-work')); }
    });
  });

  function setCaption(item, idx) {
    if (!item) { root.classList.remove('is-focus'); caption.setAttribute('aria-hidden', 'true'); return; }
    capNum.textContent = '№ ' + pad(idx + 1) + ' · ' + item.tag;
    capTitle.textContent = plain(item.title);
    capSub.textContent = item.sub;
    root.classList.add('is-focus');
    caption.setAttribute('aria-hidden', 'false');
    if (gsap && !reduced) gsap.fromTo(caption.querySelectorAll('.cap-line'), { yPercent: 105 }, { yPercent: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06, delay: 0.35, overwrite: true });
  }

  /* ---------------- index panel ---------------- */
  var opener = D.getElementById('open-index');
  var lastFocus = null;
  function openPanel() {
    lastFocus = D.activeElement;
    panel.hidden = false; opener.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () { root.classList.add('is-index'); });
    var first = panel.querySelector('button.work'); first && first.focus({ preventScroll: true });
  }
  function closePanel() {
    root.classList.remove('is-index'); opener.setAttribute('aria-expanded', 'false');
    setTimeout(function () { if (!root.classList.contains('is-index')) panel.hidden = true; }, 320);
    lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }
  opener.addEventListener('click', function () { root.classList.contains('is-index') ? closePanel() : openPanel(); });
  D.getElementById('close-index').addEventListener('click', closePanel);
  D.querySelectorAll('[data-open-index]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); openPanel(); }); });
  D.getElementById('cap-close').addEventListener('click', function () { ribbon && ribbon.release(); });
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root.classList.contains('is-index')) closePanel();
    if (!ribbon || e.target.closest('input,textarea,#index-panel')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { ribbon.travel(1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { ribbon.travel(-1); }
  });

  /* ---------------- boot ribbon after first paint ---------------- */
  function boot() {
    if (!window.DepthRibbon || !DepthRibbon.supported()) { root.classList.add('no-webgl'); return; }
    var css = getComputedStyle(root);
    var items = WORKS.map(function (w) { return Object.assign({}, w, { draw: drawPoster }); });
    try {
      ribbon = new DepthRibbon(stage, {
        items: items,
        count: 64,
        path: 'loop',
        tour: 'cycle',
        interval: 9,
        speed: 0.6,
        cardSize: 0.74,
        aspect: 0.8,
        radius: 0.06,
        offset: 1,
        fov: 55,
        fog: 1,
        thread: 0.55,
        shadow: 0.5,
        accentColor: css.getPropertyValue('--magenta').trim(),
        backgroundColor: css.getPropertyValue('--paper').trim(),
        inkColor: css.getPropertyValue('--ink').trim(),
        dpr: 2,
        workerUrl: 'assets/js/ribbon-core.js',
        coreUrl: 'assets/js/ribbon-core.js',
        onError: function (err) { root.classList.add('no-webgl'); if (window.console) console.warn('[DepthRibbon]', err); },
        onFocusChange: setCaption,
        onTravel: function (item, idx) {
          counter.textContent = pad(idx + 1);
          counterTitle.textContent = plain(item.title);
        },
        onModeChange: function (mode) { root.setAttribute('data-mode', mode); }
      });
      window.__ribbon = ribbon;
      if (gsap && !reduced) gsap.to(stage, { opacity: 1, duration: 1.4, ease: 'power2.out' });
      else stage.style.opacity = 1;
    } catch (err) {
      root.classList.add('no-webgl');
      if (window.console) console.warn('[DepthRibbon]', err);
    }
  }

  var fontsReady = D.fonts && D.fonts.load ? Promise.all([
    D.fonts.load('400 40px "Instrument Serif"', 'Aa ŠčřžýáíéůĚ'),
    D.fonts.load('italic 400 40px "Instrument Serif"', 'Aa ž'),
    D.fonts.load('600 40px Geist', 'Aa ŠčřžýáíéůĚ'),
    D.fonts.load('500 14px "Geist Mono"', 'Aa ŠčřžýáíéůĚ№')
  ]).catch(function () {}) : Promise.resolve();

  /* ---------------- intro ---------------- */
  // the intro (headline, copy, crop marks) runs as CSS keyframes from first paint,
  // so the largest paint never waits for JavaScript. GSAP drives the ribbon and captions.

  // start WebGL after the page has loaded and painted, so it never competes with first render
  var start = function () { fontsReady.then(boot); };
  var later = function () {
    if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 900 });
    else setTimeout(start, 200);
  };
  if (D.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
})();
