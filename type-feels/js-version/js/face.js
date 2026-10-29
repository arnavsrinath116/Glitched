/* 04 · FACE → FONT
   One word, five typefaces stacked on top of each other. Your expression
   decides how much of each one you see, so the type wears your mood. */
(() => {
  const { clamp, lerp, snap } = TF;

  const EMO = {
    neutral:  { label: 'Neutral',  bg: '#161616', fg: '#F2F2F2', spec: 'Roboto Flex 400 · wdth 100' },
    joy:      { label: 'Joy',      bg: '#FFC93C', fg: '#2A1A00', spec: 'Fraunces 900 · SOFT 100' },
    sad:      { label: 'Sad',      bg: '#14305A', fg: '#CFE0FF', spec: 'Fraunces 200 Italic' },
    angry:    { label: 'Angry',    bg: '#B3001B', fg: '#FFE8E8', spec: 'UnifrakturMaguntia (blackletter)' },
    surprise: { label: 'Surprise', bg: '#FF5FD2', fg: '#1B0030', spec: 'Roboto Flex 1000 · wdth 151' },
  };
  const NAMES = Object.keys(EMO);
  const RANGE = { joy: 0.45, sad: 0.22, angry: 0.32, surprise: 0.45 };

  TF.station({
    theme: 'face', num: '04', title: 'Face → Font', sensors: ['Camera'],
    steps: [
      ['🙂', 'Look at the camera and relax for a second while it learns your face.'],
      ['😄', 'Smile, frown, scowl or gasp and watch the letters change mood.'],
      ['⌨️', 'Type your name to put it in the spotlight.'],
    ],
    lesson: 'Typefaces have personalities. The same word reads differently in a different face.',
    gestures: [['😐', 'neutral', 'neutral'], ['😄', 'joy', 'joy'], ['😢', 'sad', 'sad'], ['😠', 'angry', 'angry'], ['😮', 'surprise', 'surprise']],
    keys: [['Type', 'Change word'], ['Tab', 'Re-learn face'], ['Ctrl S', 'Save']],
    start,
  });

  async function start({ stage, status, toast, gesture, key, save }) {
    const video = await TF.camera();
    const tracker = TF.tracker(video, await TF.faceTracker());
    status('Camera', 'live', 'Camera · face');

    stage.innerHTML = `
      <div class="bgs">${NAMES.map((n) => `<i class="bg-${n}" style="background:${EMO[n].bg}"></i>`).join('')}</div>
      <div class="layers">${NAMES.map((n) => `<div class="layer ${n}" style="color:${EMO[n].fg}"></div>`).join('')}</div>
      <div class="spec"><span class="eyebrow">Set in</span><span class="spec-name"></span></div>
      <aside class="readout">
        <div class="cam"></div>
        ${NAMES.map((n) => `<div class="row" data-e="${n}"><span>${EMO[n].label}</span><b><i></i></b><em>0</em></div>`).join('')}
        <div class="look">👀 Look at the camera</div>
      </aside>`;
    stage.querySelector('.cam').appendChild(video);
    const bgs = Object.fromEntries(NAMES.map((n) => [n, stage.querySelector('.bg-' + n)]));
    const layers = Object.fromEntries(NAMES.map((n) => [n, stage.querySelector('.layer.' + n)]));
    const rows = Object.fromEntries(NAMES.map((n) => [n, stage.querySelector(`.row[data-e="${n}"]`)]));
    const specName = stage.querySelector('.spec-name');
    const look = stage.querySelector('.look');

    let spans = {};
    const setWord = (w) => {
      const text = w || ' ';
      NAMES.forEach((n) => { spans[n] = TF.letters(layers[n], text); });
      const size = snap(Math.min(stage.clientHeight * 0.42, (stage.clientWidth * 1.3) / Math.max(4, text.length)), 8);
      stage.style.setProperty('--size', size + 'px');
    };
    const word = TF.typing('feel', setWord, { max: 12 });
    setWord(word.get());
    addEventListener('resize', () => setWord(word.get()));

    /* ---- expressions from blendshapes, relative to this visitor's resting face */
    let base = null, calib = [], dominant = 'neutral';
    const w = Object.fromEntries(NAMES.map((n) => [n, n === 'neutral' ? 1 : 0]));
    const raw = (b) => ({
      joy: (b.mouthSmileLeft + b.mouthSmileRight) / 2,
      sad: ((b.mouthFrownLeft + b.mouthFrownRight) / 2) * 0.8 + b.browInnerUp * 0.5 * (1 - b.jawOpen),
      angry: (b.browDownLeft + b.browDownRight) / 2 + ((b.noseSneerLeft + b.noseSneerRight) / 2) * 0.5,
      surprise: b.jawOpen * 0.5 + ((b.browOuterUpLeft + b.browOuterUpRight) / 2) * 0.5 + ((b.eyeWideLeft + b.eyeWideRight) / 2) * 0.3,
    });
    key('tab', () => { base = null; calib = []; toast('Relax your face… learning it again'); });
    key('save', () => save(stage, 'face-font'));

    TF.loop((dt, t) => {
      const res = tracker();
      const cats = res && res.faceBlendshapes && res.faceBlendshapes[0];
      const target = { neutral: 1, joy: 0, sad: 0, angry: 0, surprise: 0 };
      look.classList.toggle('show', !cats);

      if (cats) {
        const b = {};
        cats.categories.forEach((c) => { b[c.categoryName] = c.score; });
        const r = raw(b);
        if (!base) {
          calib.push(r);
          if (calib.length >= 45) {
            base = {};
            for (const k in RANGE) base[k] = calib.reduce((s, x) => s + x[k], 0) / calib.length;
            toast('Got it. Now pull a face!');
          }
        } else {
          let sum = 0;
          for (const k in RANGE) { target[k] = Math.pow(clamp((r[k] - base[k]) / RANGE[k]), 1.4); sum += target[k]; }
          if (sum > 1) for (const k in RANGE) target[k] /= sum;
          target.neutral = 1 - Math.min(1, sum);
        }
      }

      let best = 'neutral';
      NAMES.forEach((n) => {
        w[n] += (target[n] - w[n]) * 0.12;
        if (w[n] > w[best]) best = n;
        bgs[n].style.opacity = n === 'neutral' ? 1 : w[n].toFixed(3);
        layers[n].style.opacity = w[n].toFixed(3);
        rows[n].style.setProperty('--v', w[n].toFixed(3));
        rows[n].querySelector('em').textContent = Math.round(w[n] * 100);
        rows[n].classList.toggle('on', n === best);
      });
      if (best !== dominant) { dominant = best; specName.textContent = EMO[best].spec; gesture(best); }
      if (!specName.textContent) specName.textContent = EMO.neutral.spec;
      document.body.classList.toggle('light', ['joy', 'surprise'].includes(best));

      // each mood also moves its letters, scaled by how strongly you show it
      const n = spans.neutral.length, mid = (n - 1) / 2;
      for (let i = 0; i < n; i++) {
        const k = i / Math.max(1, n - 1);
        spans.joy[i].style.transform =
          `translateY(${-Math.abs(Math.sin(t * 5 - i * 0.6)) * 48 * w.joy}px) rotate(${Math.sin(t * 5 - i) * 6 * w.joy}deg)`;
        spans.sad[i].style.transform =
          `translateY(${(Math.pow(k, 1.5) * 96 + Math.sin(t * 0.8 + i) * 4) * w.sad}px) rotate(${k * 14 * w.sad}deg)`;
        spans.angry[i].style.transform =
          `translate(${TF.rand(-8, 8) * w.angry}px, ${TF.rand(-8, 8) * w.angry}px) rotate(${TF.rand(-5, 5) * w.angry}deg)`;
        spans.surprise[i].style.transform =
          `translateX(${(i - mid) * 48 * w.surprise}px) translateY(${-Math.abs(Math.sin(t * 9 + i)) * 12 * w.surprise}px) scale(${1 + 0.2 * w.surprise})`;
      }
    });
  }
})();
