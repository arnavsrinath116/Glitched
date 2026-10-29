/* 05 · WORDS THAT ACT
   Type a word and it behaves like what it means: rain drips, fire flickers,
   lonely drifts away, shy hides from your cursor. */
(() => {
  const { clamp, lerp, snap, rand } = TF;
  const S = Math.sin, A = Math.abs;

  // name: [trigger words, colour, font axes, per-letter motion (i, n, t, ctx) → {x,y,r,s,sx,sy,o}]
  const B = {
    drips:    [['rain', 'cry', 'tear', 'drip', 'wet', 'drown', 'sad', 'monsoon'], '#5CC8FF', { wght: 300, wdth: 90 },
      (i, n, t) => { const p = (t * 0.5 + i * 0.31) % 1.6; return p < 1 ? { y: p * p * 96, sy: 1 + p * 0.6, o: 1 - p * 0.7 } : { y: 0, o: 1 }; }],
    flickers: [['fire', 'burn', 'hot', 'flame', 'heat', 'light up', 'spark', 'diwali'], '#FF8A1F', { wght: 800, wdth: 100 },
      (i, n, t) => ({ y: -A(S(t * 13 + i * 2.1)) * 12, sy: 1 + S(t * 17 + i) * 0.12, o: 0.75 + S(t * 23 + i * 3) * 0.25 })],
    sinks:    [['heavy', 'weight', 'tired', 'sink', 'stone', 'lazy', 'exhausted', 'monday'], '#B9B4A7', { wght: 1000, wdth: 151 },
      (i, n) => { const k = n > 1 ? i / (n - 1) : 0.5; return { y: 40 + (1 - Math.pow(2 * k - 1, 2)) * 40, sy: 0.7, sx: 1.12 }; }],
    floats:   [['light', 'float', 'feather', 'fly', 'balloon', 'dream', 'air', 'cloud', 'free'], '#E8F1FF', { wght: 100, wdth: 110 },
      (i, n, t) => ({ y: -24 - S(t * 1.2 + i * 0.8) * 20, r: S(t + i) * 6 })],
    shivers:  [['cold', 'fear', 'scared', 'nervous', 'shiver', 'anxious', 'shake', 'exam'], '#A6F0FF', { wght: 400, wdth: 75 },
      () => ({ x: rand(-3, 3), y: rand(-3, 3) })],
    bounces:  [['happy', 'joy', 'jump', 'bounce', 'fun', 'yay', 'excited', 'party'], '#FFE14D', { wght: 900, wdth: 120 },
      (i, n, t) => ({ y: -A(S(t * 4 - i * 0.5)) * 48, sy: 1 + A(S(t * 4 - i * 0.5)) * 0.08 })],
    drifts:   [['lonely', 'alone', 'isolated', 'single', 'leave', 'lost', 'goodbye'], '#C9C3FF', { wght: 300, wdth: 100 },
      (i, n, t) => (i === n - 1 ? { x: 160 + S(t * 0.7) * 32, y: S(t * 0.5) * 24, o: 0.55 } : {})],
    gathers:  [['crowd', 'many', 'more', 'people', 'busy', 'together', 'friends', 'family'], '#FF7AC8', { wght: 700, wdth: 100 },
      () => ({}), 'crowd'],
    grows:    [['grow', 'big', 'bloom', 'huge', 'giant', 'rise', 'expand', 'plant'], '#7CFFB2', { wght: 700, wdth: 100 },
      (i, n, t) => { const g = 1 + (0.5 + 0.5 * S(t * 0.8 - i * 0.4)) * 0.7; return { s: g, y: -(g - 1) * 32 }; }],
    shrinks:  [['small', 'tiny', 'shrink', 'little', 'less', 'mini', 'ant'], '#F4F1EA', { wght: 300, wdth: 100 },
      (i, n, t) => ({ s: 0.35 + S(t * 2 + i) * 0.05 })],
    spins:    [['spin', 'dizzy', 'twist', 'turn', 'round', 'world', 'circle', 'dance'], '#FFB86B', { wght: 600, wdth: 100 },
      (i, n, t) => ({ r: (t * 120 + i * 40) % 360 })],
    waves:    [['wave', 'sea', 'ocean', 'water', 'river', 'flow', 'swim', 'beach'], '#3DD6FF', { wght: 500, wdth: 100 },
      (i, n, t) => ({ y: S(t * 2.4 - i * 0.6) * 28, r: S(t * 2.4 - i * 0.6 + 1) * 10 })],
    melts:    [['melt', 'ice', 'wax', 'ice cream', 'summer', 'candle'], '#FFD1F0', { wght: 600, wdth: 100 },
      (i, n, t) => { const p = (t * 0.25 + i * 0.07) % 1.2; return { sy: 1 + Math.min(1, p) * 1.4, y: Math.min(1, p) * 40, o: 1 - Math.min(1, p) * 0.8 }; }],
    beats:    [['love', 'heart', 'kiss', 'crush', 'adore', 'care', 'pyaar'], '#FF4D6D', { wght: 800, wdth: 100 },
      (i, n, t) => { const b = (t * 1.3) % 1; return { s: 1 + Math.max(0, S(b * Math.PI * 2)) * 0.18 * (b < 0.5 ? 1 : 0.5) }; }],
    rages:    [['angry', 'rage', 'mad', 'furious', 'hate', 'scream', 'loud', 'shout'], '#FF2E2E', { wght: 1000, wdth: 25 },
      () => ({ x: rand(-8, 8), y: rand(-8, 8), r: rand(-6, 6), s: 1.1 })],
    breathes: [['calm', 'sleep', 'slow', 'peace', 'breathe', 'quiet', 'whisper', 'soft', 'rest'], '#9FD8C8', { wght: 200, wdth: 100 },
      (i, n, t) => ({ o: 0.35 + (0.5 + 0.5 * S(t * 0.9)) * 0.65, s: 0.96 + (0.5 + 0.5 * S(t * 0.9)) * 0.06 })],
    races:    [['fast', 'run', 'quick', 'speed', 'rush', 'hurry', 'race', 'late'], '#FFF15C', { wght: 900, wdth: 110, slnt: -10 },
      (i, n, t) => ({ x: ((t * 900 + i * 0) % 2400) - 1200 })],
    hides:    [['shy', 'hide', 'secret', 'hidden', 'private', 'introvert', 'blush'], '#FFB3C7', { wght: 400, wdth: 90 },
      (i, n, t, c) => { const k = clamp(1 - c.near / 360); return { x: c.away.x * k * 120 * (1 + i * 0.1), y: c.away.y * k * 120, o: 1 - k * 0.85, r: k * 20 * (i % 2 ? 1 : -1) }; }],
    glitches: [['glitch', 'error', 'broken', 'bug', 'chaos', 'random', 'wifi', 'computer'], '#00FFC2', { wght: 700, wdth: 100 },
      () => (Math.random() < 0.08 ? { x: rand(-24, 24), sx: rand(0.6, 1.6), glitch: true } : {})],
    echoes:   [['echo', 'repeat', 'again', 'hello', 'memory', 'remember', 'hello?'], '#D6C2FF', { wght: 600, wdth: 100 },
      () => ({}), 'echo'],
    vanishes: [['ghost', 'invisible', 'gone', 'vanish', 'disappear', 'forget', 'fade'], '#F4F1EA', { wght: 300, wdth: 100 },
      (i, n, t) => ({ o: 0.05 + A(S(t * 1.7 + i * 1.9)) * 0.35, y: S(t + i) * 6 })],
    blows:    [['wind', 'blow', 'storm', 'breeze', 'wild', 'cyclone'], '#C8F7FF', { wght: 500, wdth: 100 },
      (i, n, t) => ({ x: i * 10 + S(t * 6 + i) * 12, r: 8 + S(t * 6 + i) * 10, sx: 1.08 })],
    flips:    [['upside', 'down', 'flip', 'reverse', 'opposite', 'backwards', 'fall'], '#FF9EF5', { wght: 700, wdth: 100 },
      (i, n, t) => ({ r: 180 * (0.5 - 0.5 * Math.cos(clamp(((t * 0.6 + i * 0.08) % 2) - 0.5) * Math.PI)) })],
    splits:   [['split', 'break', 'divide', 'crack', 'separate', 'broke', 'half'], '#FF6B3D', { wght: 800, wdth: 100 },
      (i, n, t) => { const g = Math.max(0, S(t * 1.2)) * 48; return { x: i < n / 2 ? -g : g, r: (i < n / 2 ? -1 : 1) * g * 0.08 }; }],
    stretches:[['tall', 'long', 'stretch', 'giraffe', 'tower', 'yawn'], '#B6FF5C', { wght: 600, wdth: 25 },
      (i, n, t) => ({ sy: 1.5 + S(t * 1.5 + i * 0.3) * 0.4, y: -32 })],
    types:    [['write', 'type', 'read', 'book', 'story', 'poem', 'word', 'letter', 'novel'], '#F4F1EA', { wght: 400, wdth: 100 },
      (i, n, t) => ({ o: i < Math.floor((t * 6) % (n + 8)) ? 1 : 0 }), 'caret'],
  };
  const LOOKUP = new Map();
  for (const [name, def] of Object.entries(B)) def[0].forEach((w) => LOOKUP.set(w, name));

  function behaviourFor(word) {
    const w = word.toLowerCase().replace(/[^\p{L}\s?]/gu, '').trim();
    if (LOOKUP.has(w)) return { name: LOOKUP.get(w), via: w };
    for (const suf of ['ing', 'ed', 'es', 's', 'y', 'ly', 'ness', 'er', 'ful']) {
      if (w.endsWith(suf)) {
        const stem = w.slice(0, -suf.length);
        for (const cand of [stem, stem + 'e', stem.slice(0, -1)]) if (LOOKUP.has(cand)) return { name: LOOKUP.get(cand), via: cand };
      }
    }
    for (const [k, v] of LOOKUP) if (k.length >= 3 && w.startsWith(k)) return { name: v, via: k };
    return null;
  }

  TF.station({
    theme: 'words', num: '05', title: 'Words That Act', sensors: ['Keyboard', 'Trackpad'],
    steps: [
      ['⌨️', 'Type a feeling, a thing or a weather word.'],
      ['⏎', 'Press Enter and the word acts out what it means.'],
      ['🖱', 'Some words react to your cursor. Try “shy”.'],
    ],
    lesson: 'Expressive typography: when form says the same thing as the word, meaning gets louder.',
    privacy: 'Nothing typed here is stored.',
    keys: [['Enter', 'Release word'], ['Del', 'Clear wall'], ['Ctrl S', 'Save']],
    start,
  });

  async function start({ stage, toast, key, save }) {
    const tryWords = ['rain', 'fire', 'lonely', 'heavy', 'shy', 'melt', 'crowd', 'echo', 'glitch', 'love', 'fast', 'whisper'];
    stage.innerHTML = `
      <div class="wall"></div>
      <form class="composer" autocomplete="off">
        <input class="field" maxlength="16" placeholder="Type a word…" spellcheck="false" aria-label="Word">
        <button class="btn" type="submit">Release ⏎</button>
        <div class="try"><span>Try</span>${tryWords.map((w) => `<button type="button" class="chip">${w}</button>`).join('')}</div>
      </form>`;
    const wall = stage.querySelector('.wall');
    const form = stage.querySelector('form');
    const field = stage.querySelector('.field');
    setTimeout(() => field.focus(), 300);
    addEventListener('keydown', (e) => { if (!e.ctrlKey && e.key.length === 1 && document.activeElement !== field) field.focus(); });

    const COLS = 3, ROWS = 3, live = [];
    let mouse = { x: -9999, y: -9999 };
    addEventListener('pointermove', (e) => { mouse = { x: e.clientX, y: e.clientY }; });

    function freeSlot() {
      const used = new Set(live.map((w) => w.slot));
      const free = [...Array(COLS * ROWS).keys()].filter((s) => !used.has(s));
      if (!free.length) { const old = live.shift(); old.el.classList.add('leaving'); setTimeout(() => old.el.remove(), 600); return old.slot; }
      return free[Math.floor(Math.random() * free.length)];
    }

    function release(text) {
      text = text.trim();
      if (!text) return;
      const hit = behaviourFor(text);
      const name = hit ? hit.name : 'breathes';
      const [, color, axes, motion, special] = B[name];
      const slot = freeSlot();
      const el = TF.el('div', 'actor entering');
      el.innerHTML = `<div class="type"></div><div class="tag"><b>${hit ? name : 'just breathes'}</b>${hit ? ` · because “${hit.via}”` : ' · no behaviour yet, try another'}</div>`;
      const type = el.querySelector('.type');
      const size = snap(clamp((wall.clientWidth / COLS) * 1.5 / Math.max(3, text.length), 40, 160), 8);
      type.style.cssText = `font-size:${size}px;color:${color};font-variation-settings:${TF.axes({ ...axes, opsz: Math.min(144, size) })}`;
      const letters = TF.letters(type, text);
      if (special === 'crowd') {
        for (let k = 0; k < 7; k++) {
          const c = TF.el('div', 'clone');
          c.textContent = text;
          c.style.cssText = `font-size:${size * rand(0.18, 0.32)}px;color:${color};left:${rand(-20, 100)}%;top:${rand(-40, 100)}%;--d:${rand(2, 5)}s`;
          type.appendChild(c);
        }
      }
      if (special === 'echo') type.classList.add('echo');
      if (special === 'caret') type.classList.add('caret');
      const col = slot % COLS, row = Math.floor(slot / COLS);
      el.style.left = (col + 0.5) / COLS * 100 + '%';
      el.style.top = (row + 0.5) / ROWS * 100 + '%';
      wall.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('entering')));
      live.push({ el, letters, motion, slot, born: performance.now() / 1000, text });
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); release(field.value); field.value = ''; });
    form.querySelector('.try').addEventListener('click', (e) => { if (e.target.matches('.chip')) { release(e.target.textContent); field.focus(); } });
    key('delete', () => { if (document.activeElement === field && field.value) return; live.splice(0).forEach((w) => w.el.remove()); });
    key('save', () => save(wall, 'words-that-act'));

    const GLYPHS = '!<>-_\\/[]{}—=+*^?#01';
    TF.loop((dt, t) => {
      for (const w of live) {
        const tt = t - w.born, n = w.letters.length;
        const box = w.el.getBoundingClientRect();
        const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
        const dx = cx - mouse.x, dy = cy - mouse.y, near = Math.hypot(dx, dy) || 1;
        const ctx = { near, away: { x: dx / near, y: dy / near } };
        w.letters.forEach((L, i) => {
          const m = w.motion(i, n, tt, ctx) || {};
          L.style.transform = `translate(${m.x || 0}px, ${m.y || 0}px) rotate(${m.r || 0}deg) scale(${(m.s || 1) * (m.sx || 1)}, ${(m.s || 1) * (m.sy || 1)})`;
          L.style.opacity = m.o == null ? 1 : clamp(m.o);
          const ch = w.text[i] === ' ' ? ' ' : w.text[i];
          L.textContent = m.glitch ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : ch;
        });
      }
    });
  }
})();
