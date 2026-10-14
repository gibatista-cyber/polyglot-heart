(function () {
  var PHRASES = [
    ['Português', 'Eu te amo'], ['Inglês', 'I love you'], ['Espanhol', 'Te quiero'],
    ['Francês', "Je t'aime"], ['Italiano', 'Ti amo'], ['Alemão', 'Ich liebe dich'],
    ['Holandês', 'Ik hou van je'], ['Sueco', 'Jag älskar dig'], ['Polonês', 'Kocham cię'],
    ['Romeno', 'Te iubesc'], ['Russo', 'Я тебя люблю'], ['Grego', "Σ' αγαπώ"],
    ['Turco', 'Seni seviyorum'], ['Árabe', 'أحبك'], ['Hebraico', 'אני אוהב אותך'],
    ['Hindi', 'मुझे तुमसे प्यार है'], ['Chinês', '我爱你'], ['Japonês', '愛してる'],
    ['Coreano', '사랑해'], ['Tailandês', 'ฉันรักเธอ'], ['Vietnamita', 'Tôi yêu bạn'],
    ['Indonésio', 'Aku cinta kamu'], ['Suaíli', 'Nakupenda'], ['Catalão', "T'estimo"]
  ];
  var NP = PHRASES.length;

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MONO = '"JetBrains Mono", "Noto Sans Mono", ui-monospace, "Noto Sans", system-ui, sans-serif';

  var body = document.body;
  var terminal = document.getElementById('terminal');
  var stage = document.getElementById('stage');
  var canvas = document.getElementById('heart');
  var ctx = canvas.getContext('2d');
  var langEl = document.getElementById('lang');
  var btn = document.getElementById('decrypt');
  var btnLabel = document.getElementById('decrypt-label');

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Textos prontos como imagens, com brilho neon vermelho ---------- */
  var VARIANTS = [
    { c: '#ff2e4f', g: 'rgba(255,46,79,0.95)', b: 6 },
    { c: '#c41438', g: 'rgba(200,20,56,0.8)', b: 4 },
    { c: '#ffb3c2', g: 'rgba(255,110,140,0.95)', b: 6 },
    { c: '#fff2f5', g: 'rgba(255,70,115,1)', b: 11 }
  ];
  var SPR_FS = 16, SPR_RATIO = 2, sprites = [];
  function buildSprites() {
    sprites = [];
    var m = document.createElement('canvas').getContext('2d');
    for (var i = 0; i < NP; i++) {
      var text = PHRASES[i][1];
      m.font = '700 ' + SPR_FS + 'px ' + MONO;
      var tw = m.measureText(text).width;
      var fit = clamp(6.3 * SPR_FS / tw, 0.55, 1);   // frases muito longas encolhem um pouco
      var pad = 14, w = Math.ceil(tw) + pad * 2, h = Math.ceil(SPR_FS * 1.4) + pad;
      var row = [];
      for (var v = 0; v < VARIANTS.length; v++) {
        var c = document.createElement('canvas');
        c.width = w * SPR_RATIO; c.height = h * SPR_RATIO;
        var x = c.getContext('2d');
        x.scale(SPR_RATIO, SPR_RATIO);
        x.font = '700 ' + SPR_FS + 'px ' + MONO;
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.shadowColor = VARIANTS[v].g; x.shadowBlur = VARIANTS[v].b;
        x.fillStyle = VARIANTS[v].c;
        x.fillText(text, w / 2, h / 2);
        row.push(c);
      }
      sprites.push({ v: row, w: w, h: h, fit: fit, tw: tw });
    }
  }

  /* ---------- Contorno do coração (curva clássica, centrada) ---------- */
  function hx(th) { return Math.pow(Math.sin(th), 3); }
  function hy(th) { return (13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)) / 16; }
  var CT = [], CL = [0], YMID = 0, AREA = 0;
  (function () {
    var N = 1400, i, mx = -9, mn = 9;
    for (i = 0; i <= 720; i++) { var yy = hy(2 * Math.PI * i / 720); mx = Math.max(mx, yy); mn = Math.min(mn, yy); }
    YMID = (mx + mn) / 2;
    for (i = 0; i <= N; i++) {
      var th = 2 * Math.PI * i / N;
      CT.push([hx(th), hy(th) - YMID]);
      if (i > 0) CL.push(CL[i - 1] + Math.hypot(CT[i][0] - CT[i - 1][0], CT[i][1] - CT[i - 1][1]));
    }
    for (i = 0; i < N; i++) AREA += CT[i][0] * CT[i + 1][1] - CT[i + 1][0] * CT[i][1];
    AREA = Math.abs(AREA) / 2;
  })();
  var CLEN = CL[CL.length - 1];
  function contourAt(s) {
    s = ((s % CLEN) + CLEN) % CLEN;
    var lo = 0, hi = CL.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (CL[mid] <= s) lo = mid; else hi = mid; }
    var f = (s - CL[lo]) / ((CL[hi] - CL[lo]) || 1);
    return [lerp(CT[lo][0], CT[hi][0], f), lerp(CT[lo][1], CT[hi][1], f)];
  }
  function inside(x, y) {
    var c = false;
    for (var i = 0, j = CT.length - 1; i < CT.length; j = i++) {
      var xi = CT[i][0], yi = CT[i][1], xj = CT[j][0], yj = CT[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
    }
    return c;
  }
  function distContour(x, y) {
    var d = 9;
    for (var i = 0; i < CT.length; i += 5) {
      var dd = Math.hypot(CT[i][0] - x, CT[i][1] - y);
      if (dd < d) d = dd;
    }
    return d;
  }

  /* ---------- Partículas ---------- */
  var W = 0, H = 0, dpr = 1, CX = 0, CY = 0, UNIT = 100, BASE = 10;
  var parts = [], started = false, startMs = 0;
  var FOCAL = 4.5;

  function layout() {
    var r = stage.getBoundingClientRect();
    W = Math.max(1, Math.floor(r.width)); H = Math.max(1, Math.floor(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    CX = W / 2; CY = H / 2;
    BASE = clamp(W * 0.025, 7, 11.5);
    var m = BASE * 2.7;
    UNIT = Math.min((W - 2 * m) / 2, (H - 2 * m) / 1.82);
    var textW = BASE * 6.1 / UNIT, rowH = BASE * 1.75 / UNIT;

    var rand = rng(5), i, pool = [];
    for (i = 0; i < NP; i++) pool.push(i);
    pool.push(0, 0, 1, 1);
    for (i = pool.length - 1; i > 0; i--) { var k = Math.floor(rand() * (i + 1)), tmp = pool[i]; pool[i] = pool[k]; pool[k] = tmp; }
    var pi = 0;
    function phrase() { return pool[(pi++) % pool.length]; }
    var sxr = (W / 2) / UNIT + 0.1, syr = (H / 2) / UNIT + 0.1;
    parts = [];

    function add(o) {
      o.ph = (o.phFixed != null) ? o.phFixed : phrase();
      o.fl = rand() * 6.28;
      o.px = o.py = o.pz = 0; o.sc = 1; o.al = 0;
      parts.push(o);
    }

    var tipY = CT[Math.round(CT.length / 2)][1];
    var shortIdx = [];
    for (i = 0; i < NP; i++) shortIdx.push(i);
    shortIdx.sort(function (a, b) { return sprites[a].tw * sprites[a].fit - sprites[b].tw * sprites[b].fit; });

    // 1) Borda: palavras ao longo do contorno, primeiro soltas pela tela e depois se juntando
    var nShell = Math.round(CLEN * UNIT / (BASE * 0.85));
    for (i = 0; i < nShell; i++) {
      var s = (i + rand() * 0.8) / nShell * CLEN;
      var p = contourAt(s), p1 = contourAt(s - 0.012), p2 = contourAt(s + 0.012);
      if (p[1] < tipY + 0.24) continue;                                  // a ponta fica só com a pilha pequena
      if (Math.abs(p[0]) < 0.3 && p[1] > 0.25 && i % 3) continue;        // menos palavras no vão entre os dois lados
      if (p[1] < -0.2 && i % 2) continue;                                // diagonais de baixo mais leves
      var ang = Math.atan2(-(p2[1] - p1[1]), p2[0] - p1[0]);
      if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
      var vr = rand();
      add({
        x: p[0] + (rand() - 0.5) * 0.035, y: p[1] + (rand() - 0.5) * 0.035, z: (rand() - 0.5) * 0.3,
        sx: (rand() * 2 - 1) * sxr, sy: (rand() * 2 - 1) * syr, sz: (rand() - 0.5) * 1.2,
        ax: rand() * 1.7, ad: 0.9, mv: 2.0 + rand() * 1.5, md: 1.7,
        a0: 0.3, a1: 0.8 + rand() * 0.2, v: vr < 0.62 ? 0 : (vr < 0.76 ? 2 : 1),
        rot: clamp(ang * 0.8, -1.05, 1.05), size: 0.92 + rand() * 0.16
      });
    }

    // 2) Ponta de baixo: poucas palavras curtas, uma sobre a outra mas sem se tocar
    for (i = 0; i < 4; i++) {
      var ty = tipY + 0.035 + i * 0.088, tx = (i % 2 ? 0.025 : -0.025);
      add({
        x: tx, y: ty, z: 0,
        sx: tx + (rand() - 0.5) * 0.2, sy: ty + (rand() - 0.5) * 0.2, sz: 0,
        ax: 0.9 + rand() * 0.9, ad: 0.8, mv: 1.0 + rand() * 1.0, md: 1.4,
        a0: 0.45, a1: 1, v: 0, rot: 0, size: 0.92, phFixed: shortIdx[i % shortIdx.length]
      });
    }

    // 3) Miolo: depois que a borda fecha, o interior se enche de palavras em linhas
    var nFill = Math.round(AREA * UNIT * UNIT / (BASE * 6.1 * BASE * 1.75) * 1.4), rows = {}, tries = 0, placed = 0;
    while (placed < nFill && tries < nFill * 60) {
      tries++;
      var fx = (rand() * 2 - 1), fy = (rand() * 1.9 - 0.95);
      if (!inside(fx, fy) || distContour(fx, fy) < 0.07) continue;
      if (Math.abs(fx) < 0.46 && fy > -0.22 && fy < 0.46) continue;       // faixa do centro, reservada ao núcleo
      if (Math.abs(fx) < 0.46 && fy < tipY + 0.42) continue;              // região da ponta
      var rk = Math.round(fy / rowH); fy = rk * rowH + (rand() - 0.5) * rowH * 0.25;
      if (!inside(fx, fy)) continue;
      var list = rows[rk] || (rows[rk] = []), ok = true;
      for (var q = 0; q < list.length; q++) if (Math.abs(list[q] - fx) < textW * 0.72) { ok = false; break; }
      if (!ok) continue;
      list.push(fx); placed++;
      var vf = rand();
      add({
        x: fx, y: fy, z: (rand() - 0.5) * 0.8,
        sx: fx + (rand() - 0.5) * 0.5, sy: fy + (rand() - 0.5) * 0.5, sz: 0,
        ax: 3.2 + rand() * 3.6, ad: 1.1, mv: 3.2 + rand() * 3.6, md: 1.6,
        a0: 0, a1: 0.5 + rand() * 0.5, v: vf < 0.45 ? 1 : (vf < 0.9 ? 0 : 2),
        rot: (rand() - 0.5) * 0.05, size: 0.78 + rand() * 0.3
      });
    }

    // 4) Núcleo no centro: uma coluna de 5 palavras bem separadas, a última a acender
    var coreIdx = [shortIdx[4], shortIdx[5], 0, shortIdx[6], shortIdx[7]];
    for (i = 0; i < 5; i++) {
      var cy2 = 0.3 - i * 0.1, cx2 = (i % 2 ? 0.05 : -0.05);
      add({
        x: cx2, y: cy2, z: 0.02,
        sx: cx2 + (rand() - 0.5) * 0.2, sy: cy2 + (rand() - 0.5) * 0.2, sz: 0,
        ax: 6.0 + rand() * 1.6, ad: 1.2, mv: 6.0 + rand() * 1.6, md: 1.3,
        a0: 0, a1: i === 2 ? 1 : 0.9, v: i === 2 ? 2 : 0, rot: 0, size: i === 2 ? 1.2 : 1.0, phFixed: coreIdx[i]
      });
    }
  }

  var lastSpot = -1;
  function frame(now) {
    ctx.clearRect(0, 0, W, H);
    if (!started) { requestAnimationFrame(frame); return; }
    var t = reduce ? 99 : (now - startMs) / 1000;

    var pulse = 0;
    if (!reduce && t > 9.2) {
      var ph = ((t - 9.2) % 1.6) / 1.6;
      pulse = Math.exp(-Math.pow((ph - 0.08) * 12, 2)) + 0.6 * Math.exp(-Math.pow((ph - 0.3) * 12, 2));
    }
    var u = UNIT * (1 + 0.025 * pulse);

    var gl = clamp((t - 2) / 6, 0, 1);
    var g = ctx.createRadialGradient(CX, CY, u * 0.1, CX, CY, u * 1.4);
    g.addColorStop(0, 'rgba(255,30,70,' + (0.03 + 0.12 * gl + 0.04 * pulse) + ')');
    g.addColorStop(1, 'rgba(255,30,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var yaw = reduce ? 0 : 0.42 * Math.sin(0.55 * Math.max(0, t - 3)) * clamp((t - 3) / 3, 0, 1);
    var cy = Math.cos(yaw), sy = Math.sin(yaw);

    var spot = -1, boost = 0;
    if (t > 9) {
      var kk = (t - 9) / 1.3;
      spot = Math.floor(kk) % NP;
      boost = Math.sin(Math.PI * (kk - Math.floor(kk)));
      if (spot !== lastSpot) {
        lastSpot = spot;
        langEl.innerHTML = '<b>' + PHRASES[spot][0] + '</b><span></span>';
        langEl.lastChild.textContent = PHRASES[spot][1];
      }
    } else if (reduce && lastSpot !== 0) {
      lastSpot = 0;
      langEl.innerHTML = '<b>' + PHRASES[0][0] + '</b><span></span>';
      langEl.lastChild.textContent = PHRASES[0][1];
    }

    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var m = ease(clamp((t - p.mv) / p.md, 0, 1));
      var fade = clamp((t - p.ax) / p.ad, 0, 1);
      var tx = p.x * cy - p.z * sy, tz = p.x * sy + p.z * cy;
      var dr = (1 - m) * 0.03;
      var x = lerp(p.sx, tx, m) + dr * Math.sin(t * 0.9 + p.fl);
      var y = lerp(p.sy, p.y, m) + dr * Math.cos(t * 0.8 + p.fl);
      var z = lerp(p.sz, tz, m);
      var sc = FOCAL / (FOCAL - z);
      p.px = CX + x * u * sc; p.py = CY - y * u * sc; p.pz = z; p.sc = sc;
      p.al = fade * (p.a0 + (p.a1 - p.a0) * m);
      p.m = m;
    }
    parts.sort(function (a, b) { return a.pz - b.pz; });

    for (var j = 0; j < parts.length; j++) {
      var q = parts[j];
      if (q.al <= 0.01) continue;
      var depth = clamp((q.pz + 0.45) / 0.9, 0, 1);
      var a = q.al * (0.6 + 0.4 * depth) * (0.9 + 0.1 * Math.sin(t * 2 + q.fl));
      var v = q.v, size = q.size * (0.85 + 0.15 * q.m);
      if (q.ph === spot && boost > 0.12 && q.m > 0.9) { v = 3; size *= 1 + 0.35 * boost; a = Math.min(1, a + 0.5 * boost); }
      var s = sprites[q.ph];
      var k2 = BASE / SPR_FS * q.sc * size * s.fit;
      var dw = s.w * k2, dh = s.h * k2;
      ctx.globalAlpha = Math.min(1, a);
      if (q.rot) {
        ctx.save(); ctx.translate(q.px, q.py); ctx.rotate(q.rot);
        ctx.drawImage(s.v[v], -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
      } else {
        ctx.drawImage(s.v[v], q.px - dw / 2, q.py - dh / 2, dw, dh);
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  /* ---------- Terminal ---------- */
  function typeInto(el, text, cls, speed) {
    return new Promise(function (resolve) {
      var span = document.createElement('span');
      if (cls) span.className = cls;
      el.appendChild(span);
      if (reduce || !speed) { span.textContent = text; resolve(); return; }
      var i = 0;
      (function step() {
        i++; span.textContent = text.slice(0, i);
        if (i < text.length) setTimeout(step, speed); else resolve();
      })();
    });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); }

  function runTerminal() {
    var l1 = document.getElementById('l1'), l2 = document.getElementById('l2'), l3 = document.getElementById('l3');
    l1.classList.add('caret');
    return typeInto(l1, '[sistema] ', 'dim', 26)
      .then(function () { return typeInto(l1, 'Iniciando coração.PROTOCOLO_v2.0 ...', 'hot', 26); })
      .then(function () { l1.classList.remove('caret'); return wait(350); })
      .then(function () { l2.classList.add('caret'); return typeInto(l2, '[status] ', 'dim', 26); })
      .then(function () { return typeInto(l2, 'PRONTO', 'ok', 40); })
      .then(function () { l2.classList.remove('caret'); return wait(450); })
      .then(function () { l3.classList.add('caret'); return typeInto(l3, '> Um pacote criptografado foi encontrado para você.', 'soft', 24); })
      .then(function () { l3.classList.remove('caret'); return wait(300); })
      .then(function () { btn.classList.add('ready'); });
  }

  function start() {
    started = true;
    startMs = performance.now();
    setTimeout(function () { body.classList.add('s-header'); }, reduce ? 0 : 1500);
    setTimeout(function () { body.classList.add('s-name'); }, reduce ? 0 : 7800);
    setTimeout(function () { body.classList.add('s-vow'); }, reduce ? 0 : 9000);
  }

  btn.addEventListener('click', function () {
    btn.disabled = true;
    var total = reduce ? 1 : 1500, t0 = performance.now();
    (function tick(now) {
      var pct = Math.min(100, Math.round((now - t0) / total * 100));
      btnLabel.textContent = 'Decifrando ' + pct + '%';
      if (pct < 100) { requestAnimationFrame(tick); return; }
      btnLabel.textContent = 'Mensagem decifrada';
      terminal.classList.add('gone');
      setTimeout(start, reduce ? 0 : 500);
    })(t0);
  });

  /* ---------- Início ---------- */
  function boot() {
    buildSprites();
    layout();
    requestAnimationFrame(frame);
    runTerminal();
    if (window.ResizeObserver) {
      var timer = null;
      new ResizeObserver(function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          var r = stage.getBoundingClientRect();
          if (Math.floor(r.width) !== W || Math.floor(r.height) !== H) layout();
        }, 120);
      }).observe(stage);
    }
  }
  var fontsReady = (document.fonts && document.fonts.load)
    ? Promise.all([document.fonts.load('700 16px "JetBrains Mono"'), document.fonts.load('500 13px "JetBrains Mono"')]).catch(function () {})
    : Promise.resolve();
  var guard = new Promise(function (res) { setTimeout(res, 1500); });
  Promise.race([fontsReady, guard]).then(boot);
})();
