/* 02 · BLACKOUT POETRY
   A page from a classic book. Point to black out words; whatever survives
   is your poem. Thumbs-up to reveal it, Ctrl+S to keep it. */
(() => {
  const { clamp, lerp } = TF;

  const PAGES = [
    { book: 'Alice’s Adventures in Wonderland', author: 'Lewis Carroll', year: 1865, text:
      'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice, “without pictures or conversations?” So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.' },
    { book: 'A Tale of Two Cities', author: 'Charles Dickens', year: 1859, text:
      'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair, we had everything before us, we had nothing before us, we were all going direct to Heaven, we were all going direct the other way. In short, the period was so far like the present period, that some of its noisiest authorities insisted on its being received, for good or for evil, in the superlative degree of comparison only.' },
    { book: 'Little Women', author: 'Louisa May Alcott', year: 1868, text:
      '“Christmas won’t be Christmas without any presents,” grumbled Jo, lying on the rug. “It’s so dreadful to be poor!” sighed Meg, looking down at her old dress. “I don’t think it’s fair for some girls to have plenty of pretty things, and other girls nothing at all,” added little Amy, with an injured sniff. “We’ve got Father and Mother, and each other,” said Beth contentedly from her corner. The four young faces on which the firelight shone brightened at the cheerful words, but darkened again as Jo said sadly, “We haven’t got Father, and shall not have him for a long time.”' },
    { book: 'Pride and Prejudice', author: 'Jane Austen', year: 1813, text:
      'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters. “My dear Mr. Bennet,” said his lady to him one day, “have you heard that Netherfield Park is let at last?” Mr. Bennet replied that he had not. “But it is,” returned she; “for Mrs. Long has just been here, and she told me all about it.”' },
  ];

  TF.station({
    theme: 'blackout', num: '02', title: 'Blackout Poetry', sensors: ['Camera'],
    steps: [
      ['☝️', 'Point one finger to black out a word, like a marker.'],
      ['✊', 'Make a fist to move without marking.'],
      ['✋', 'Open your palm to wipe marks away.'],
      ['👍', 'Hold a thumbs-up to reveal your poem.'],
    ],
    lesson: 'Poems are hiding inside every page. Taking words away is a way of writing.',
    gestures: [['☝️', 'mark', 'point'], ['✊', 'move', 'fist'], ['✋', 'wipe', 'open'], ['👍', 'reveal', 'thumb']],
    keys: [['Space', 'Reveal'], ['N', 'New page'], ['Del', 'Start over'], ['Ctrl S', 'Save']],
    start,
  });

  async function start({ stage, status, toast, gesture, key, save }) {
    stage.innerHTML = `
      <div class="desk">
        <article class="sheet"><header class="src"></header><div class="page"></div><footer class="count"></footer></article>
        <aside class="yours"><div class="eyebrow">Your poem</div><div class="poem-out"></div></aside>
      </div>
      <canvas class="hands"></canvas>
      <div class="pen"><span></span></div>`;
    const desk = stage.querySelector('.desk');
    const sheet = stage.querySelector('.sheet');
    const pageEl = stage.querySelector('.page');
    const out = stage.querySelector('.poem-out');
    const count = stage.querySelector('.count');
    const pen = stage.querySelector('.pen');
    const ctx = TF.fitCanvas(stage.querySelector('canvas'));

    let pageIdx = Math.floor(Math.random() * PAGES.length), words = [], rects = [], revealed = false;

    function loadPage(i) {
      pageIdx = (i + PAGES.length) % PAGES.length;
      const p = PAGES[pageIdx];
      sheet.querySelector('.src').innerHTML = `<span>From</span> ${p.book} <span>· ${p.author}, ${p.year}</span>`;
      pageEl.innerHTML = '';
      words = p.text.split(/\s+/).map((t) => {
        const w = TF.el('span', 'w');
        w.textContent = t;
        w.style.setProperty('--r', TF.rand(-1.2, 1.2).toFixed(2) + 'deg');
        pageEl.append(w, ' ');
        return w;
      });
      setReveal(false);
      fit();
      update();
    }

    // largest 8pt-friendly size that fits the sheet on screen
    function fit() {
      const avail = desk.clientHeight;
      for (const size of [48, 40, 32, 28, 24, 20]) {
        sheet.style.setProperty('--size', size + 'px');
        sheet.style.setProperty('--lh', Math.ceil((size * 1.45) / 8) * 8 + 'px');
        if (sheet.scrollHeight <= avail) break;
      }
      cache();
    }
    const cache = () => { rects = words.map((w) => w.getBoundingClientRect()); };

    function update() {
      const kept = words.filter((w) => !w.classList.contains('out')).map((w) => w.textContent);
      const marked = words.length - kept.length;
      count.textContent = `${kept.length} words kept · ${marked} blacked out`;
      if (!marked) { out.innerHTML = '<p class="placeholder">Black out words.<br>What’s left becomes your poem.</p>'; return; }
      // break lines at punctuation, or every five words
      const lines = [[]];
      kept.forEach((t) => {
        const clean = t.replace(/[“”"()]/g, '');
        lines[lines.length - 1].push(clean);
        if (/[.,;:!?—]$/.test(clean) || lines[lines.length - 1].length >= 5) lines.push([]);
      });
      out.innerHTML = lines.filter((l) => l.length).map((l) => `<p>${l.join(' ')}</p>`).join('');
      // short poems get set big; long ones step down the type scale so they fit
      out.dataset.len = kept.length <= 14 ? 's' : kept.length <= 32 ? 'm' : 'l';
    }

    function setReveal(on) {
      revealed = on;
      sheet.classList.toggle('revealed', on);
      desk.classList.toggle('revealed', on);
      if (on) toast('Your poem ✦ Ctrl+S to save · N for a new page');
    }

    function paint(x, y, mode) {
      if (revealed) return;
      let changed = false;
      const r = mode === 'wipe' ? 56 : 4;
      rects.forEach((b, i) => {
        const dx = Math.max(b.left - x, 0, x - b.right), dy = Math.max(b.top - y, 0, y - b.bottom);
        if (dx * dx + dy * dy > r * r) return;
        const w = words[i], isOut = w.classList.contains('out');
        if (mode === 'mark' && !isOut) { w.classList.add('out'); changed = true; }
        if (mode === 'wipe' && isOut) { w.classList.remove('out'); changed = true; }
      });
      if (changed) update();
    }
    // sample along the stroke so fast moves don't skip words
    let prev = null;
    function stroke(x, y, mode) {
      if (!prev || !mode) { prev = mode ? { x, y } : null; if (mode) paint(x, y, mode); return; }
      const steps = Math.max(1, Math.ceil(Math.hypot(x - prev.x, y - prev.y) / 8));
      for (let s = 1; s <= steps; s++) paint(lerp(prev.x, x, s / steps), lerp(prev.y, y, s / steps), mode);
      prev = { x, y };
    }

    /* ---- mouse / trackpad (also handy for testing) */
    let mouseMode = null;
    stage.addEventListener('contextmenu', (e) => e.preventDefault());
    stage.addEventListener('pointerdown', (e) => { mouseMode = e.button === 2 || e.shiftKey ? 'wipe' : 'mark'; prev = null; stroke(e.clientX, e.clientY, mouseMode); });
    addEventListener('pointermove', (e) => { if (mouseMode) stroke(e.clientX, e.clientY, mouseMode); });
    addEventListener('pointerup', () => { mouseMode = null; prev = null; });

    key(' ', () => setReveal(!revealed));
    key('n', () => loadPage(pageIdx + 1));
    key('delete', () => { words.forEach((w) => w.classList.remove('out')); setReveal(false); update(); });
    key('save', () => save(desk, 'blackout-poem'));
    addEventListener('resize', () => setTimeout(fit, 50));

    await document.fonts.ready;
    loadPage(pageIdx);

    /* ---- hands */
    let track = null;
    try {
      const video = await TF.camera();
      track = TF.tracker(video, await TF.handTracker(1));
      status('Camera', 'live', 'Camera · hands');
    } catch (e) {
      status('Camera', 'warn', 'No camera · use mouse');
      toast(e && e.name === 'NotAllowedError' ? 'Camera is blocked: allow it in the address bar, then reload. Mouse works meanwhile.' : 'Hand tracking unavailable. Drag with the mouse to black out, right-drag to wipe.', 6000);
    }

    const steady = TF.steady(3);
    let cur = null, thumbHeld = 0;
    TF.loop((dt) => {
      const rect = stage.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      const res = track && track();
      const lm = res && res.landmarks && res.landmarks[0];
      if (!lm) {
        if (track) { pen.classList.remove('show'); gesture(''); steady('none'); prev = null; }
        return;
      }
      TF.drawHands(ctx, [lm], { left: 0, top: 0, width: rect.width, height: rect.height }, '#E5322D');
      const pose = steady(TF.pose(lm).name);
      const target = TF.toScreen(pose === 'open' ? lm[9] : lm[8], rect);
      cur = cur ? { x: lerp(cur.x, target.x, 0.5), y: lerp(cur.y, target.y, 0.5) } : target;

      const mode = pose === 'point' ? 'mark' : pose === 'open' ? 'wipe' : null;
      stroke(cur.x, cur.y, mode);
      gesture(pose);

      thumbHeld = pose === 'thumb' ? thumbHeld + dt : 0;
      if (thumbHeld >= 1) { setReveal(!revealed); thumbHeld = -1.5; }

      pen.classList.add('show');
      pen.dataset.mode = pose;
      pen.style.transform = `translate(${cur.x - rect.left}px, ${cur.y - rect.top}px)`;
      pen.style.setProperty('--p', clamp(thumbHeld) * 360 + 'deg');
      pen.firstChild.textContent = { point: '☝️', fist: '✊', open: '✋', thumb: '👍' }[pose] || '·';
    });
  }
})();
