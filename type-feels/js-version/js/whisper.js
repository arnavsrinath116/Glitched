/* 01 · WHISPER / SHOUT
   Speak and the words appear on the wall. HOW you said them sets the type:
   loudness → weight, width, size and colour; pace → letter-spacing. */
(() => {
  const { clamp, lerp, snap, mix, axes } = TF;
  const SOFT = '#A9A4FF', FG = '#F4F1EA', HOT = '#FF4D2E';

  const api = TF.station({
    theme: 'whisper', num: '01', title: 'Whisper / Shout', sensors: ['Mic'],
    steps: [
      ['🎙', 'Say a word or a line, anything at all.'],
      ['🤫', 'Whisper it and the type goes thin, airy and pale.'],
      ['📣', 'Shout it and the type goes heavy, tight and red.'],
    ],
    lesson: 'Weight carries volume. Spacing carries pace. Type has a tone of voice.',
    privacy: 'Loudness is measured on this laptop. Speech-to-text uses Chrome’s built-in service. Nothing is saved.',
    gestures: [['🤫', 'whisper', 'w'], ['🗣', 'speak', 's'], ['📣', 'SHOUT', 'x']],
    keys: [['Ctrl S', 'Save'], ['Del', 'Clear'], ['[ ]', 'Mic sensitivity'], ['Type', 'No speech? type instead']],
    start,
  });

  async function start({ stage, status, toast, gesture, key, save }) {
    const mic = await TF.mic();
    status('Mic', 'live', 'Mic · listening');

    stage.innerHTML = `
      <div class="poem"><div class="empty">
        <span class="w-soft">whisper</span> <span class="w-mid">or</span> <span class="w-loud">SHOUT</span>
        <small>Say something. The wall is listening.</small>
      </div></div>
      <div class="meter"><span class="lab top">shout</span><span class="lab mid">speak</span><span class="lab bot">whisper</span><div class="cells"></div></div>`;
    const poem = stage.querySelector('.poem');
    const cells = [...Array(32)].map((_, i) => {
      const c = TF.el('i');
      const t = i / 31;
      c.style.setProperty('--c', t < 0.5 ? mix(SOFT, FG, t * 2) : mix(FG, HOT, (t - 0.5) * 2));
      return c;
    });
    stage.querySelector('.cells').append(...cells.reverse());
    cells.reverse();

    // a word takes the typical loudness of the voiced moments since the previous word,
    // not a single spike (pops and plosives made every word bold before)
    let vSum = 0, vN = 0, vMax = 0, lastWordAt = 0;
    const voiced = () => (vN ? (vSum / vN) * 0.75 + vMax * 0.25 : 0);
    const resetVoice = () => { vSum = vN = vMax = 0; };

    // only real shouting reaches the heavy end: whisper ≈ 0–0.2, talking ≈ 0.3–0.5
    function styleWord(s, l, pace) {
      const e = Math.pow(l, 1.6);
      const size = snap(lerp(32, 192, Math.pow(l, 1.6)), 8);
      s.style.fontSize = size + 'px';
      s.style.fontVariationSettings = axes({
        wght: lerp(100, 1000, e),
        wdth: l < 0.5 ? lerp(140, 100, l * 2) : lerp(100, 25, (l - 0.5) * 2),
        slnt: lerp(-10, 0, clamp(l * 2.5)),
        opsz: clamp(size, 8, 144),
      });
      s.style.letterSpacing = (lerp(0.22, -0.02, e) + lerp(0.12, -0.04, pace)).toFixed(3) + 'em';
      s.style.color = l < 0.5 ? mix(SOFT, FG, l * 2) : mix(FG, HOT, (l - 0.5) * 2);
      s.style.opacity = lerp(0.6, 1, clamp(l * 2)).toFixed(2);
      const loud = l > 0.82;
      s.style.textTransform = loud ? 'uppercase' : 'none';
      s.classList.toggle('shake', loud);
      s.style.setProperty('--k', ((l - 0.82) * 30).toFixed(1));
    }

    function addWord(text, pace) {
      poem.querySelector('.empty')?.remove();
      const s = TF.el('span', 'word new');
      s.textContent = text;
      styleWord(s, voiced(), pace);
      poem.appendChild(s);
      requestAnimationFrame(() => requestAnimationFrame(() => s.classList.remove('new')));
      trim();
      return s;
    }

    // drop the oldest words once the wall is full
    function trim() {
      const top = poem.getBoundingClientRect().top;
      while (poem.children.length > 1 && poem.firstElementChild.getBoundingClientRect().top < top) poem.firstElementChild.remove();
    }

    /* ---- speech → words. Each new word takes the loudest moment since the previous one. */
    let live = [];
    const sync = (words) => {
      const now = performance.now() / 1000;
      const fresh = words.length - live.length;
      const gap = now - lastWordAt;
      const per = fresh > 0 ? (gap > 1.5 ? 0.35 : gap / fresh) : 0;
      const pace = clamp(1 - (per - 0.15) / 0.6);
      words.forEach((w, i) => {
        if (live[i]) { if (live[i].textContent !== w) live[i].textContent = w; }
        else live[i] = addWord(w, pace);
      });
      live.splice(words.length).forEach((s) => s.remove());
      if (fresh > 0) { resetVoice(); lastWordAt = now; }
    };
    const commit = () => { live = []; };

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let dead = !SR;
    if (SR) {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = navigator.language || 'en-US';
      let done = new Set(), liveIdx = -1;
      rec.onstart = () => { done = new Set(); liveIdx = -1; };
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (done.has(i)) continue;
          if (i !== liveIdx) { commit(); liveIdx = i; }
          const r = e.results[i];
          sync(r[0].transcript.trim().split(/\s+/).filter(Boolean));
          if (r.isFinal) { done.add(i); commit(); liveIdx = -1; }
        }
      };
      rec.onerror = (e) => {
        if (['not-allowed', 'service-not-allowed', 'network', 'language-not-supported'].includes(e.error)) {
          dead = true;
          toast('Speech-to-text is unavailable here. Type instead and your voice still sets the style.', 5000);
        }
      };
      rec.onend = () => { if (!dead) setTimeout(() => { try { rec.start(); } catch (_) {} }, 150); };
      rec.start();
    } else {
      toast('This browser has no speech-to-text (use Chrome). Type instead and your voice still sets the style.', 5000);
    }

    /* ---- typing fallback: the word takes the loudness of the room while you type */
    let typed = null;
    addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ' || e.key === 'Enter') { typed = null; resetVoice(); e.preventDefault(); return; }
      if (e.key === 'Backspace' && typed) {
        typed.textContent = typed.textContent.slice(0, -1);
        if (!typed.textContent) { typed.remove(); typed = null; }
        return;
      }
      if (e.key.length !== 1) return;
      if (!typed) typed = addWord('', 0.5);
      typed.textContent += e.key;
      styleWord(typed, Math.max(voiced(), mic.value), 0.5);
    });

    key('[', () => { mic.setGain(mic.gain * 1.15); toast(`Mic sensitivity ${mic.sensitivity()}%`); });
    key(']', () => { mic.setGain(mic.gain / 1.15); toast(`Mic sensitivity ${mic.sensitivity()}%`); });
    key('delete', () => { poem.innerHTML = ''; live = []; typed = null; });
    key('save', () => save(stage, 'whisper-shout'));

    TF.loop(() => {
      const l = mic.read();
      if (l > 0.04) { vSum += l; vN++; vMax = Math.max(vMax, l); }
      const lit = Math.round(l * cells.length);
      cells.forEach((c, i) => c.classList.toggle('on', i < lit));
      gesture(l < 0.04 ? '' : l < 0.25 ? 'w' : l < 0.65 ? 's' : 'x');
    });
  }
})();
