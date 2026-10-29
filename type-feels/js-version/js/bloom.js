/* 03 · BLOOM
   Every letter you type sprouts vines, leaves and roses. The flowers turn
   toward your cursor, a click calls butterflies, backspace withers.
   After @art.akshat’s blooming type tool. */
(() => {
  const { clamp, lerp, rand, snap } = TF;
  const NS = 'http://www.w3.org/2000/svg';
  const TAU = Math.PI * 2;
  const BLUE = '#2340FF', RED = '#FF2B1C';
  const ATTRACT = ['let it grow', 'words are seeds', 'bloom', 'read, then grow', 'doubt is a seed'];

  const svgEl = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  // smooth curve through points (Catmull-Rom as cubic Béziers)
  const smooth = (p) => {
    let d = `M${p[0].x.toFixed(1)},${p[0].y.toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)},${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)},${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  };

  TF.station({
    theme: 'bloom', num: '03', title: 'Bloom', sensors: ['Keyboard', 'Trackpad'],
    steps: [
      ['⌨️', 'Type anything. Every letter grows vines, leaves and roses.'],
      ['🖱', 'Move the cursor and the flowers lean toward you. Click to call butterflies.'],
      ['⌫', 'Backspace withers a letter. Space cuts. Enter clears the garden.'],
    ],
    lesson: 'Type can be grown, not only set. A letter can become a place where things live.',
    privacy: 'Nothing typed here is stored. After @art.akshat’s blooming type tool.',
    gestures: [['⌨️', 'type to grow', 'type'], ['␣', 'space cuts', 'space'], ['⌫', 'backspace withers', 'back'], ['⏎', 'enter clears', 'enter'], ['🦋', 'click', 'click']],
    keys: [['Type', 'Grow letters'], ['Space', 'Cut'], ['⌫', 'Wither'], ['Enter', 'Clear'], ['Click', 'Call butterflies'], ['Tab', 'Type / Poster'], ['Ctrl S', 'Save PNG']],
    start,
  });

  async function start({ stage, toast, gesture, key, save }) {
    stage.innerHTML = `
      <div class="garden">
        <div class="meta top"><span>Type Feels</span><span>Bloom</span><span class="date"></span></div>
        <div class="line"><span class="caret"></span></div>
        <div class="placeholder">start typing…</div>
        <svg class="sky"></svg>
        <div class="meta bottom"><span>Design Club × Reading &amp; Writing Club</span><span class="count"></span></div>
      </div>
      <div class="modes"><button data-m="type" class="on">Type</button><button data-m="poster">Poster</button></div>
      <div class="export"><button data-f="png">PNG</button><button data-f="svg">SVG</button></div>`;
    const garden = stage.querySelector('.garden');
    const line = stage.querySelector('.line');
    const caret = stage.querySelector('.caret');
    const sky = stage.querySelector('.sky');
    const count = stage.querySelector('.count');
    stage.querySelector('.date').textContent = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    let letters = [], roses = [], blooms = [], flies = [], petals = [], fontSize = 160, dirty = true;
    let mouse = { x: -9999, y: -9999 }, lastKey = performance.now(), attract = null, demo = false;

    function fit() {
      const n = Math.max(5, letters.length);
      fontSize = snap(clamp((garden.clientWidth * 0.8) / (n * 0.5), 56, 208), 8);
      if (letters.length > 16) fontSize = snap(clamp(Math.sqrt((garden.clientWidth * garden.clientHeight * 0.45) / letters.length) * 1.2, 48, 160), 8);
      line.style.fontSize = fontSize + 'px';
      stage.classList.toggle('empty', !letters.length);
      count.textContent = `${letters.filter((l) => !l.space).length} letters · ${roses.length} roses`;
      dirty = true;
    }

    /* ---- growing */
    function rose(svg, p, r, delay, owner) {
      const pos = svgEl('g', { transform: `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})` }, svg);
      const head = svgEl('g', {}, pos);
      const bloom = svgEl('g', { class: 'bloom' }, head);
      bloom.style.transitionDelay = delay + 's';
      const k = 6 + Math.floor(rand(0, 3)), spin = rand(0, TAU);
      for (let i = 0; i < k; i++) {
        const a = (i / k) * TAU + spin + rand(-0.2, 0.2);
        svgEl('circle', { cx: (Math.cos(a) * r * 0.52).toFixed(1), cy: (Math.sin(a) * r * 0.52).toFixed(1), r: (r * rand(0.46, 0.6)).toFixed(1), fill: RED }, bloom);
      }
      svgEl('circle', { r: (r * 0.78).toFixed(1), fill: RED }, bloom);
      // the hand-drawn swirl of petals
      let d = '';
      const turns = rand(2.2, 3.2);
      for (let j = 0; j <= 64; j++) {
        const t = j / 64, a = t * turns * TAU + spin;
        const rr = r * 0.82 * (1 - t * 0.92) * (1 + Math.sin(a * 3) * 0.06);
        d += `${j ? 'L' : 'M'}${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`;
      }
      svgEl('path', { d, class: 'swirl' }, bloom);
      for (let i = 0; i < 2; i++) {
        const a = spin + rand(0, TAU);
        svgEl('path', { d: `M${(Math.cos(a) * r * 0.95).toFixed(1)},${(Math.sin(a) * r * 0.95).toFixed(1)} A${r} ${r} 0 0 1 ${(Math.cos(a + 0.9) * r * 0.95).toFixed(1)},${(Math.sin(a + 0.9) * r * 0.95).toFixed(1)}`, class: 'swirl' }, bloom);
      }
      const R = { pos, head, owner, x: 0, y: 0, ox: 0, oy: 0, s: 1, seed: rand(0, 99) };
      roses.push(R);
      owner.roses.push(R);
    }

    // vines start at a letter's top or bottom edge and grow away from the words,
    // so they frame the text instead of crossing it
    function vine(back, front, owner, wU, k, at) {
      const r = Math.random(), up = r < 0.58, down = !up && r < 0.92;
      const start = { x: rand(-wU * 0.3, wU * 0.3), y: up ? rand(-30, -14) : rand(22, 34) };
      let ang = up ? -90 + rand(-40, 40) : down ? 90 + rand(-35, 35) : (Math.random() < 0.5 ? -150 : -30) + rand(-15, 15);
      ang *= Math.PI / 180;
      const len = rand(60, 150), segs = 4, pts = [start];
      for (let i = 0; i < segs; i++) {
        ang += rand(-0.55, 0.55);
        const last = pts[pts.length - 1];
        pts.push({ x: last.x + (Math.cos(ang) * len) / segs, y: last.y + (Math.sin(ang) * len) / segs });
      }
      const svg = back;
      const path = svgEl('path', { d: smooth(pts), class: 'vine' }, svg);
      const L = path.getTotalLength(), delay = k * 0.18, grow = 1.4;
      path.style.strokeDasharray = L;
      path.style.strokeDashoffset = L;
      path.style.transitionDelay = delay + 's';

      let side = Math.random() < 0.5 ? 1 : -1;
      for (let s = rand(12, 20); s < L - 10; s += rand(20, 32)) {
        const p = path.getPointAtLength(s), q = path.getPointAtLength(s + 1);
        const deg = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
        const g = svgEl('g', { transform: `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${(deg + side * rand(40, 65)).toFixed(0)}) scale(${rand(0.6, 1.15).toFixed(2)})` }, svg);
        const leaf = svgEl('path', { d: 'M0 0 C6 -7 16 -7 24 0 C16 7 6 7 0 0Z', class: 'leaf' }, g);
        leaf.style.transitionDelay = (delay + grow * (s / L)).toFixed(2) + 's';
        side = -side;
      }
      const end = path.getPointAtLength(L);
      const size = rand(16, 30), here = { x: at.x + end.x, y: at.y + end.y, r: size };
      // no pile-ups: a rose only opens where there's room, otherwise a bud
      const room = blooms.every((b) => Math.hypot(b.x - here.x, b.y - here.y) > (b.r + here.r) * 1.15);
      if (room && Math.random() < 0.6 && roses.length < 4 + letters.length * 0.6) {
        rose(front, end, size, delay + grow * 0.85, owner);
        here.owner = owner;
        blooms.push(here);
      } else if (Math.random() < 0.6) {
        const g = svgEl('g', { transform: `translate(${end.x.toFixed(1)},${end.y.toFixed(1)})` }, svg);
        const b = svgEl('circle', { r: rand(3.5, 6).toFixed(1), fill: RED, class: 'bloom' }, g);
        b.style.transitionDelay = (delay + grow) + 's';
      }
    }

    function addLetter(ch) {
      if (ch === ' ') {
        const el = TF.el('span', 'lt sp');
        el.innerHTML = '&nbsp;';
        line.insertBefore(el, caret);
        letters.push({ el, roses: [], space: true });
        cut();
        fit();
        return;
      }
      const el = TF.el('span', 'lt');
      el.textContent = ch;
      // vines sit behind the letters, roses in front
      const back = svgEl('svg', { class: 'flora back', viewBox: '-200 -200 400 400' }, el);
      const front = svgEl('svg', { class: 'flora front', viewBox: '-200 -200 400 400' }, el);
      line.insertBefore(el, caret);
      const owner = { el, roses: [] };
      letters.push(owner);
      fit();
      const wU = (el.getBoundingClientRect().width / fontSize) * 100;
      const at = { x: ((el.offsetLeft + el.offsetWidth / 2) / fontSize) * 100, y: ((el.offsetTop + el.offsetHeight / 2) / fontSize) * 100 };
      // most letters get one vine; some none, a few two. Long phrases get sparser
      const r = Math.random();
      const vines = letters.length > 12 ? (r < 0.4 ? 0 : 1) : r < 0.15 ? 0 : r < 0.8 ? 1 : 2;
      for (let k = 0; k < vines; k++) vine(back, front, owner, wU, k, at);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        back.querySelectorAll('.vine').forEach((p) => { p.style.strokeDashoffset = 0; });
        back.classList.add('grown');
        front.classList.add('grown');
      }));
    }

    function forget(owner) { roses = roses.filter((r) => r.owner !== owner); blooms = blooms.filter((b) => b.owner !== owner); }

    function wither() {
      const owner = letters.pop();
      if (!owner) return;
      forget(owner);
      dropPetals(owner.roses, 3);
      owner.el.classList.add('wither');
      setTimeout(() => owner.el.remove(), 1000);
      fit();
    }

    function clearAll() {
      const all = letters;
      letters = [];
      dropPetals(roses, 2);
      roses = [];
      blooms = [];
      all.forEach((o, i) => setTimeout(() => o.el.classList.add('wither'), i * 40));
      setTimeout(() => all.forEach((o) => o.el.remove()), all.length * 40 + 1000);
      fit();
    }

    // space "cuts": the last word's roses shed a few petals
    function cut() {
      const word = [];
      for (let i = letters.length - 2; i >= 0 && !letters[i].space; i--) word.push(...letters[i].roses);
      dropPetals(word, 1);
    }

    /* ---- falling petals (screen space) */
    function dropPetals(list, each) {
      const g = garden.getBoundingClientRect();
      for (const R of list) {
        const b = R.pos.getBoundingClientRect();
        for (let i = 0; i < each; i++) {
          const el = svgEl('ellipse', { rx: rand(4, 8).toFixed(1), ry: rand(2, 4).toFixed(1), fill: RED }, sky);
          petals.push({ el, x: b.left - g.left + b.width / 2, y: b.top - g.top + b.height / 2, vx: rand(-40, 40), vy: rand(-60, 10), r: rand(0, 360), vr: rand(-200, 200), seed: rand(0, 9) });
        }
      }
    }

    /* ---- butterflies */
    function butterfly(tx, ty) {
      const g = garden.getBoundingClientRect();
      const fromLeft = Math.random() < 0.5;
      const el = svgEl('g', {}, sky);
      const wings = (flip) => {
        const outer = svgEl('g', flip ? { transform: 'scale(-1,1)' } : {}, el);
        const w = svgEl('g', { class: 'wing' }, outer);
        svgEl('path', { d: 'M0 -2 C-6 -20 -28 -26 -26 -8 C-25 2 -10 4 0 0Z', fill: BLUE }, w);
        svgEl('path', { d: 'M0 0 C-4 10 -18 20 -16 8 C-15 2 -7 0 0 0Z', fill: RED }, w);
        svgEl('circle', { cx: -16, cy: -12, r: 3, fill: '#F5F2EC' }, w);
        w.style.animationDelay = rand(0, 0.2) + 's';
      };
      wings(false);
      wings(true);
      svgEl('ellipse', { rx: 1.8, ry: 10, fill: '#F5F2EC' }, el);
      svgEl('path', { d: 'M0 -9 Q-3 -16 -6 -18 M0 -9 Q3 -16 6 -18', fill: 'none', stroke: '#F5F2EC', 'stroke-width': 1 }, el);
      flies.push({
        el, x: fromLeft ? -40 : g.width + 40, y: rand(0.1, 0.9) * g.height, vx: 0, vy: 0,
        tx, ty, mode: 'arrive', until: 0, born: performance.now() / 1000, seed: rand(0, 99), size: clamp(fontSize / 140, 0.7, 1.4),
      });
    }

    /* ---- input */
    const press = (k) => {
      lastKey = performance.now();
      // the self-written demo phrase makes way for the visitor's own words
      if (attract || demo) { clearInterval(attract); attract = null; demo = false; clearAll(); }
      if (k === 'Backspace') { wither(); gesture('back'); }
      else if (k === 'Enter') { clearAll(); gesture('enter'); }
      else if (k === ' ') { if (letters.length && !letters[letters.length - 1].space) addLetter(' '); gesture('space'); }
      else if (/\s/.test(k)) return;
      else if (letters.length < 40) { addLetter(k); gesture('type'); }
      else toast('The garden is full. Press Enter to clear it.');
    };
    TF.textInput(press, press);
    garden.addEventListener('pointermove', (e) => { const g = garden.getBoundingClientRect(); mouse = { x: e.clientX - g.left, y: e.clientY - g.top }; });
    garden.addEventListener('pointerleave', () => { mouse = { x: -9999, y: -9999 }; });
    garden.addEventListener('pointerdown', (e) => {
      const g = garden.getBoundingClientRect();
      if (flies.length < 10) { butterfly(e.clientX - g.left, e.clientY - g.top); butterfly(e.clientX - g.left, e.clientY - g.top); }
      gesture('click');
      lastKey = performance.now();
    });

    const setMode = (m) => {
      stage.classList.toggle('poster', m === 'poster');
      stage.querySelectorAll('.modes button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
      setTimeout(fit, 350);
    };
    stage.querySelector('.modes').addEventListener('click', (e) => { if (e.target.dataset.m) setMode(e.target.dataset.m); });
    stage.querySelector('.export').addEventListener('click', (e) => { if (e.target.dataset.f) save(garden, 'bloom', e.target.dataset.f); });
    key('tab', () => setMode(stage.classList.contains('poster') ? 'type' : 'poster'));
    key('save', () => save(garden, 'bloom'));
    addEventListener('resize', fit);

    // when nobody is playing, the garden writes to itself
    function autoType(text) {
      clearAll();
      demo = true;
      let i = 0;
      attract = setInterval(() => {
        if (i < text.length) addLetter(text[i++]);
        else { clearInterval(attract); attract = null; }
      }, 220);
    }

    await document.fonts.ready;
    fit();
    setTimeout(() => autoType(ATTRACT[0]), 400);
    let attractIdx = 1;

    TF.loop((dt, t) => {
      const g = garden.getBoundingClientRect();
      if (!attract && performance.now() - lastKey > 45000) { lastKey = performance.now(); autoType(ATTRACT[attractIdx++ % ATTRACT.length]); }

      // flowers lean and swell toward the cursor
      if (dirty || Math.floor(t * 60) % 20 === 0) {
        for (const R of roses) { const b = R.pos.getBoundingClientRect(); R.x = b.left - g.left + b.width / 2 - R.ox * (fontSize / 100); R.y = b.top - g.top + b.height / 2 - R.oy * (fontSize / 100); }
        dirty = false;
      }
      for (const R of roses) {
        const dx = mouse.x - R.x, dy = mouse.y - R.y, d = Math.hypot(dx, dy) || 1;
        const near = clamp(1 - d / 420);
        R.ox = lerp(R.ox, (dx / d) * near * 14, 0.12);
        R.oy = lerp(R.oy, (dy / d) * near * 14, 0.12);
        R.s = lerp(R.s, 1 + near * 0.3, 0.12);
        const sway = Math.sin(t * 1.3 + R.seed) * 4;
        R.head.setAttribute('transform', `translate(${R.ox.toFixed(2)},${R.oy.toFixed(2)}) scale(${R.s.toFixed(3)}) rotate(${(sway + near * 25).toFixed(1)})`);
      }

      // butterflies: arrive at the click, visit roses, perch, then leave
      const now = t;
      flies = flies.filter((F) => {
        if (F.mode === 'arrive' && Math.hypot(F.tx - F.x, F.ty - F.y) < 40) { F.mode = 'visit'; F.until = now + rand(0.8, 1.6); }
        if (F.mode === 'visit' && now > F.until) {
          if (roses.length && now - F.born < 25) { const R = roses[Math.floor(Math.random() * roses.length)]; F.rose = R; F.mode = 'toRose'; }
          else { F.mode = 'leave'; F.tx = F.x < g.width / 2 ? -80 : g.width + 80; F.ty = rand(-80, g.height * 0.3); }
        }
        if (F.mode === 'toRose') {
          F.tx = F.rose.x + F.rose.ox * (fontSize / 100); F.ty = F.rose.y + F.rose.oy * (fontSize / 100) - 6;
          if (!roses.includes(F.rose)) F.mode = 'visit';
          else if (Math.hypot(F.tx - F.x, F.ty - F.y) < 10) { F.mode = 'perch'; F.until = now + rand(2.5, 5); }
        }
        if (F.mode === 'perch') {
          F.x = lerp(F.x, F.tx, 0.2); F.y = lerp(F.y, F.ty, 0.2); F.vx *= 0.8; F.vy *= 0.8;
          if (now > F.until || !roses.includes(F.rose)) { F.mode = 'visit'; F.until = now; }
        } else {
          const dx = F.tx - F.x, dy = F.ty - F.y, d = Math.hypot(dx, dy) || 1, sp = F.mode === 'leave' ? 260 : 190;
          F.vx += ((dx / d) * sp - F.vx) * 0.05;
          F.vy += ((dy / d) * sp - F.vy) * 0.05 + Math.sin(now * 9 + F.seed) * 9;
          F.x += F.vx * dt; F.y += F.vy * dt;
        }
        const deg = (Math.atan2(F.vy, F.vx) * 180) / Math.PI + 90;
        F.el.classList.toggle('rest', F.mode === 'perch');
        F.el.setAttribute('transform', `translate(${F.x.toFixed(1)},${F.y.toFixed(1)}) rotate(${F.mode === 'perch' ? Math.sin(now * 2 + F.seed) * 10 : deg.toFixed(0)}) scale(${F.size.toFixed(2)})`);
        const gone = F.mode === 'leave' && (F.x < -60 || F.x > g.width + 60 || F.y < -60);
        if (gone) F.el.remove();
        return !gone;
      });

      petals = petals.filter((P) => {
        P.vy += 120 * dt; P.vx += Math.sin(now * 3 + P.seed) * 30 * dt;
        P.x += P.vx * dt; P.y += P.vy * dt; P.r += P.vr * dt;
        P.el.setAttribute('transform', `translate(${P.x.toFixed(1)},${P.y.toFixed(1)}) rotate(${P.r.toFixed(0)})`);
        if (P.y > g.height + 20) { P.el.remove(); return false; }
        return true;
      });
    });
  }
})();
