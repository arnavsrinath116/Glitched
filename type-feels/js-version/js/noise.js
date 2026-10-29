/* 01 · MAKE SOME NOISE
   The words are a grid of little strokes tied together with springs.
   Sound pushes them around: loudness swirls them, claps blow them apart,
   and the springs pull every letter back into shape.
   After r.osie.l’s audio-reactive type + physics sketch. */
(() => {
  const { clamp, rand } = TF;
  const PALETTES = [
    { name: 'Riso blue', bg: '#C9D6F2', ink: '#1F3DFF' },
    { name: 'Poster red', bg: '#F3EEE3', ink: '#E5322D' },
    { name: 'Acid', bg: '#0E0E0E', ink: '#D4FF3A' },
    { name: 'Signal', bg: '#FFC93C', ink: '#111111' },
  ];
  const SX = 7, SY = 10;                       // stroke grid
  const K_HOME = 0.035, K_LINK = 0.12, DAMP = 0.88;

  TF.station({
    theme: 'noise', num: '01', title: 'Make Some Noise', sensors: ['Mic'],
    steps: [
      ['📣', 'Shout, and the letters swirl and stretch.'],
      ['👏', 'Clap, and the letters burst apart, then spring back.'],
      ['🎵', 'Hum or sing: low notes pull the type sideways, high notes pull it up and down.'],
    ],
    lesson: 'These letters are elastic. Hundreds of strokes on springs bend under sound and bounce back, still readable.',
    privacy: 'Sound is measured on this laptop and never recorded. After r.osie.l’s audio-reactive type sketch.',
    gestures: [['🤫', 'calm', 'calm'], ['🎵', 'hum / sing', 'hum'], ['📣', 'shout', 'shout'], ['👏', 'clap', 'clap']],
    keys: [['Type', 'Change the words'], ['Tab', 'Change colours'], ['[ ]', 'Mic sensitivity'], ['Click', 'Clap with the mouse'], ['Ctrl S', 'Save']],
    start,
  });

  async function start({ stage, status, toast, gesture, key, save }) {
    stage.innerHTML = `
      <canvas class="noise"></canvas>
      <div class="level"><span>Level</span><div class="cells">${'<i></i>'.repeat(16)}</div><em class="sens"></em></div>`;
    const canvas = stage.querySelector('canvas');
    const ctx = TF.fitCanvas(canvas);
    const cells = [...stage.querySelectorAll('.level i')];
    const sens = stage.querySelector('.sens');

    let mic = null;
    try {
      mic = await TF.mic();
      status('Mic', 'live', 'Mic · listening');
    } catch (e) {
      status('Mic', 'warn', 'No mic · click to clap');
      toast(e && e.name === 'NotAllowedError' ? 'Mic is blocked: allow it in the address bar, then reload. Click to clap meanwhile.' : 'No microphone found. Click to clap instead.', 6000);
    }

    /* ---- words → particles */
    let n = 0, hx, hy, x, y, vx, vy, links, rest, pal = 0, box = { x: 0, y: 0, w: 1, h: 1 };
    function build(text) {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      const words = (text || ' ').toUpperCase().trim().split(/\s+/).filter(Boolean);
      const lines = [];
      for (const w of words) {
        const last = lines[lines.length - 1];
        if (last && words.length > 4 && (last + ' ' + w).length <= 10) lines[lines.length - 1] = last + ' ' + w;
        else lines.push(w);
      }
      if (!lines.length) lines.push(' ');

      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const g = off.getContext('2d', { willReadFrequently: true });
      const font = (s) => `1000 ${s}px "Roboto Flex"`;
      g.fontStretch = 'extra-condensed';
      g.font = font(100);
      const widest = Math.max(...lines.map((l) => g.measureText(l).width), 1);
      const size = Math.min((H * 0.8) / (lines.length * 0.84), (100 * W * 0.78) / widest);
      g.font = font(size);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#000';
      lines.forEach((l, i) => g.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * size * 0.84 + size * 0.04));

      const px = g.getImageData(0, 0, W, H).data;
      const cols = Math.floor(W / SX), rows = Math.floor(H / SY);
      const grid = new Int32Array(cols * rows).fill(-1);
      const pts = [];
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const X = c * SX + SX / 2, Y = r * SY + SY / 2;
          if (px[(Math.floor(Y) * W + Math.floor(X)) * 4 + 3] > 128) {
            grid[r * cols + c] = pts.length / 2;
            pts.push(X, Y);
            x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
          }
        }
      box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      n = pts.length / 2;
      hx = new Float32Array(n); hy = new Float32Array(n);
      x = new Float32Array(n); y = new Float32Array(n);
      vx = new Float32Array(n); vy = new Float32Array(n);
      for (let i = 0; i < n; i++) { hx[i] = x[i] = pts[i * 2]; hy[i] = y[i] = pts[i * 2 + 1]; }

      // each stroke is tied to its right and lower neighbours: that's the "cloth"
      const L = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const a = grid[r * cols + c];
          if (a < 0) continue;
          if (c + 1 < cols && grid[r * cols + c + 1] >= 0) L.push(a, grid[r * cols + c + 1]);
          if (r + 1 < rows && grid[(r + 1) * cols + c] >= 0) L.push(a, grid[(r + 1) * cols + c]);
        }
      links = new Int32Array(L);
      rest = new Float32Array(L.length / 2);
      for (let s = 0; s < rest.length; s++) rest[s] = Math.hypot(hx[links[s * 2 + 1]] - hx[links[s * 2]], hy[links[s * 2 + 1]] - hy[links[s * 2]]);
    }

    function blast(cx, cy, power) {
      for (let i = 0; i < n; i++) {
        const dx = x[i] - cx, dy = y[i] - cy, d = Math.hypot(dx, dy) + 1;
        const s = power * 22 * Math.exp(-d / 320);
        vx[i] += (dx / d) * s;
        vy[i] += (dy / d) * s;
      }
    }

    await document.fonts.load('1000 100px "Roboto Flex"');
    const words = TF.typing('MAKE SOME NOISE', build, { max: 24 });
    build(words.get());
    addEventListener('resize', () => setTimeout(() => build(words.get()), 60));

    /* ---- mouse: click = clap at that spot, drag = wind */
    let drag = null;
    stage.addEventListener('pointerdown', (e) => { const r = canvas.getBoundingClientRect(); blast(e.clientX - r.left, e.clientY - r.top, 0.8); drag = { x: e.clientX, y: e.clientY }; });
    addEventListener('pointermove', (e) => {
      if (!drag) return;
      const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      const wx = (e.clientX - drag.x) * 0.15, wy = (e.clientY - drag.y) * 0.15;
      for (let i = 0; i < n; i++) { const d = Math.hypot(x[i] - mx, y[i] - my); if (d < 160) { const f = 1 - d / 160; vx[i] += wx * f; vy[i] += wy * f; } }
      drag = { x: e.clientX, y: e.clientY };
    });
    addEventListener('pointerup', () => { drag = null; });

    const showSens = () => { sens.textContent = mic ? `Sensitivity ${mic.sensitivity()}%` : 'Mouse mode'; };
    showSens();
    key('[', () => { if (mic) { mic.setGain(mic.gain * 1.15); showSens(); } });
    key(']', () => { if (mic) { mic.setGain(mic.gain / 1.15); showSens(); } });
    key('tab', () => { pal = (pal + 1) % PALETTES.length; toast(PALETTES[pal].name); });
    key('save', () => save(stage, 'make-some-noise'));

    let seenHits = 0, hitGlow = 0;
    TF.loop((dt, t) => {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      const L = mic ? mic.read() : 0, tone = mic ? mic.tone : 0.5;

      // every onset (clap, stamp, shout start) since last frame bursts the words, none skipped
      if (mic && mic.hits !== seenHits) {
        const fresh = Math.min(3, mic.hits - seenHits);
        seenHits = mic.hits;
        for (let h = 0; h < fresh; h++) blast(box.x + rand(0.2, 0.8) * box.w, box.y + rand(0.2, 0.8) * box.h, Math.max(0.5, mic.hit));
        hitGlow = 1;
      }
      hitGlow *= 0.9;

      // loudness drives a swirling flow field; tone decides sideways vs up-down
      const push = L * L * 2.6, jitter = Math.max(0, L - 0.6) * 3;
      const fx = 1.5 - tone, fy = 0.5 + tone;
      for (let i = 0; i < n; i++) {
        let ax = (hx[i] - x[i]) * K_HOME, ay = (hy[i] - y[i]) * K_HOME;
        if (push > 0.002) {
          const a = (Math.sin(x[i] * 0.009 + t * 1.1) + Math.sin(y[i] * 0.012 - t * 0.8) + Math.sin((x[i] - y[i]) * 0.006 + t * 1.6)) * 2.1;
          ax += Math.cos(a) * push * fx;
          ay += Math.sin(a) * push * fy;
        }
        if (jitter) { ax += rand(-jitter, jitter); ay += rand(-jitter, jitter); }
        vx[i] = (vx[i] + ax) * DAMP;
        vy[i] = (vy[i] + ay) * DAMP;
      }
      for (let s = 0; s < rest.length; s++) {
        const a = links[s * 2], b = links[s * 2 + 1];
        const dx = x[b] - x[a], dy = y[b] - y[a], d = Math.hypot(dx, dy) || 1;
        const f = ((d - rest[s]) / d) * K_LINK;
        vx[a] += dx * f; vy[a] += dy * f;
        vx[b] -= dx * f; vy[b] -= dy * f;
      }
      for (let i = 0; i < n; i++) { x[i] += vx[i]; y[i] += vy[i]; }

      // draw: short vertical strokes that smear along their motion
      const P = PALETTES[pal];
      ctx.fillStyle = P.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        ctx.moveTo(x[i] - vx[i] * 2.2, y[i] - 4 - vy[i] * 2.2);
        ctx.lineTo(x[i], y[i] + 4);
      }
      ctx.stroke();

      const lit = Math.round(L * cells.length);
      cells.forEach((c, i) => c.classList.toggle('on', i < lit));
      stage.style.setProperty('--glow', hitGlow.toFixed(2));
      gesture(hitGlow > 0.3 ? 'clap' : L > 0.55 ? 'shout' : L > 0.12 ? 'hum' : 'calm');
    });
  }
})();
