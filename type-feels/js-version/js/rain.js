/* 03 · TEXT RAIN
   Letters of a poem fall from the sky and land on your silhouette.
   Catch a line on your arms and it becomes readable.
   After Camille Utterback & Romy Achituv, “Text Rain” (1999). */
(() => {
  const { clamp, snap } = TF;

  const POEMS = [
    { by: 'Emily Dickinson', lines: ['Hope is the thing with feathers', 'That perches in the soul', 'And sings the tune without the words', 'And never stops at all'] },
    { by: 'Rabindranath Tagore, Stray Birds', lines: ['Let life be beautiful', 'like summer flowers', 'and death like', 'autumn leaves'] },
    { by: 'Christina Rossetti', lines: ['Who has seen the wind?', 'Neither I nor you:', 'But when the leaves hang trembling,', 'The wind is passing through.'] },
    { by: 'Emily Dickinson', lines: ['I’m nobody! Who are you?', 'Are you nobody, too?', 'Then there’s a pair of us', 'Don’t tell!'] },
  ];
  const CELL = 8;

  TF.station({
    theme: 'rain', num: '03', title: 'Text Rain', sensors: ['Camera'], full: true,
    steps: [
      ['🧍', 'Stand two to three steps back so your whole upper body is in view.'],
      ['🙌', 'Hold out your arms and the falling letters land on you.'],
      ['📖', 'Lift them slowly. Can you catch a whole line and read it?'],
    ],
    lesson: 'Letters are physical things. Reading can happen with your whole body.',
    privacy: 'Your silhouette is worked out on this laptop and never saved. After Utterback & Achituv’s “Text Rain”, 1999.',
    gestures: [['🙌', 'catch', 'catch'], ['🌧', 'letters falling', 'rain']],
    keys: [['N', 'Next poem'], ['Ctrl S', 'Save']],
    start,
  });

  async function start({ stage, status, toast, gesture, key, save }) {
    stage.innerHTML = '<canvas class="rain"></canvas><div class="credit"></div>';
    const canvas = stage.querySelector('canvas');
    const ctx = TF.fitCanvas(canvas);
    const credit = stage.querySelector('.credit');

    /* ---- silhouette mask from the webcam */
    let video = null, seg = null, mask = null, mw = 0, mh = 0, invert = false, frames = 0;
    try {
      video = await TF.camera(640, 360);
      seg = await TF.segmenter();
      status('Camera', 'live', 'Camera · silhouette');
    } catch (e) {
      status('Camera', 'warn', 'No camera · use mouse');
      toast(e && e.name === 'NotAllowedError' ? 'Camera is blocked: allow it in the address bar, then reload. Your mouse is an umbrella meanwhile.' : 'Body tracking unavailable. Your mouse is an umbrella instead.', 6000);
    }

    let lastVideoTime = -1;
    function readMask() {
      if (!seg || video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;
      seg.segmentForVideo(video, performance.now(), (r) => {
        const m = r.confidenceMasks && r.confidenceMasks[0];
        if (!m) return;
        mw = m.width; mh = m.height;
        const data = m.getAsFloat32Array();
        if (!mask || mask.length !== data.length) mask = new Float32Array(data.length);
        mask.set(data); // masks are only valid inside this callback, so copy
      });
      // some model builds report background instead of person: compare centre vs corners
      if (mask && ++frames % 30 === 0) {
        const at = (u, v) => mask[Math.floor(v * mh) * mw + Math.floor(u * mw)];
        const centre = (at(0.5, 0.7) + at(0.45, 0.85) + at(0.55, 0.85)) / 3;
        const corner = (at(0.03, 0.05) + at(0.97, 0.05)) / 2;
        if (Math.abs(centre - corner) > 0.5) invert = corner > centre;
      }
    }

    // screen point → person confidence (webcam is shown mirrored and "cover"-fitted)
    let W = 0, H = 0, mouse = null;
    function personAt(x, y) {
      if (mouse && Math.abs(x - mouse.x) < 120 && y > mouse.y - 8 && y < mouse.y + 24) return 1;
      if (!mask || !video) return 0;
      const vw = video.videoWidth, vh = video.videoHeight;
      const s = Math.max(W / vw, H / vh);
      const u = 1 - (x - (W - vw * s) / 2) / (vw * s), v = (y - (H - vh * s) / 2) / (vh * s);
      if (u < 0 || u >= 1 || v < 0 || v >= 1) return 0;
      const c = mask[Math.floor(v * mh) * mw + Math.floor(u * mw)];
      return invert ? 1 - c : c;
    }
    stage.addEventListener('pointermove', (e) => { mouse = { x: e.clientX, y: e.clientY }; });
    stage.addEventListener('pointerleave', () => { mouse = null; });

    /* ---- poem waves */
    let poemIdx = 0, lineIdx = 0, letters = [], spawnIn = 0;
    function setPoem(i) {
      poemIdx = (i + POEMS.length) % POEMS.length;
      lineIdx = 0;
      const p = POEMS[poemIdx];
      credit.innerHTML = `${p.lines.map((l, j) => `<span data-l="${j}">${l}</span>`).join(' / ')}<b>· ${p.by}</b>`;
    }
    function spawnLine() {
      const p = POEMS[poemIdx], text = p.lines[lineIdx];
      const gap = Math.min(64, (W * 0.84) / text.length);
      const size = snap(clamp(gap * 1.35, 24, 56), 8);
      const x0 = (W - gap * (text.length - 1)) / 2;
      [...text].forEach((ch, i) => {
        if (ch === ' ') return;
        letters.push({ ch, x: x0 + i * gap, y: -TF.rand(0, 240) - size, vy: TF.rand(70, 130), size, rest: false, line: lineIdx });
      });
      credit.querySelectorAll('span').forEach((s) => s.classList.toggle('on', +s.dataset.l === lineIdx));
      lineIdx = (lineIdx + 1) % p.lines.length;
    }

    key('n', () => { setPoem(poemIdx + 1); letters = []; spawnIn = 0; });
    key('save', () => save(stage, 'text-rain'));

    await document.fonts.ready;
    setPoem(Math.floor(Math.random() * POEMS.length));

    TF.loop((dt) => {
      W = canvas.clientWidth; H = canvas.clientHeight;
      readMask();
      ctx.clearRect(0, 0, W, H);

      // silhouette as an 8pt dot matrix
      let caught = 0;
      if (mask || mouse) {
        ctx.fillStyle = '#3D7BFF';
        ctx.beginPath();
        for (let y = CELL / 2; y < H; y += CELL)
          for (let x = CELL / 2; x < W; x += CELL) {
            const c = personAt(x, y);
            if (c > 0.35) { const s = c > 0.7 ? 6 : 4; ctx.rect(x - s / 2, y - s / 2, s, s); }
          }
        ctx.fill();
      }

      spawnIn -= dt;
      if (spawnIn <= 0) { spawnLine(); spawnIn = 4.5; }

      // fall, rest on the body, get lifted when the body rises
      for (const L of letters) {
        if (personAt(L.x, L.y) > 0.5) {
          let n = 0;
          while (n++ < 40 && personAt(L.x, L.y - 4) > 0.5) L.y -= 4;
          L.rest = true;
        } else if (personAt(L.x, L.y + 4) > 0.5) {
          L.rest = true;
        } else {
          L.rest = false;
          L.y += L.vy * dt;
        }
        if (L.rest) caught++;
      }
      letters = letters.filter((L) => L.y < H + 64);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      for (const L of letters) {
        ctx.font = `${L.rest ? 800 : 600} ${L.rest ? L.size * 1.15 : L.size}px Fraunces`;
        ctx.fillStyle = L.rest ? '#FFFFFF' : '#FFD23F';
        ctx.globalAlpha = L.rest ? 1 : 0.9;
        ctx.fillText(L.ch, L.x, L.y);
      }
      ctx.globalAlpha = 1;
      gesture(caught > 2 ? 'catch' : 'rain');
    });
  }
})();
