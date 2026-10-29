/* ==========================================================================
   TYPE FEELS — shared core
   Station shell (intro, top bar, hint bar), laptop sensors (camera + mic),
   MediaPipe trackers and small helpers. Everything runs in the browser;
   nothing is recorded or uploaded.
   ========================================================================== */
(() => {
  'use strict';
  const TF = (window.TF = {});

  const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  const MODELS = {
    hand: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    segment: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
  };
  const SAVE_LIB = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js';

  /* ------------------------------------------------------------- math */
  TF.clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  TF.lerp = (a, b, t) => a + (b - a) * t;
  TF.snap = (v, step = 8) => Math.round(v / step) * step;
  TF.rand = (a, b) => a + Math.random() * (b - a);
  TF.ease = (t) => 1 - Math.pow(1 - TF.clamp(t), 3);
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  TF.mix = (a, b, t) => {
    const A = hex(a), B = hex(b);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * TF.clamp(t))).join(',')})`;
  };
  TF.axes = (o) => Object.entries(o).map(([k, v]) => `"${k}" ${Math.round(v * 10) / 10}`).join(', ');

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  TF.el = el;

  /** Split text into one span per letter (spaces kept as non-breaking). */
  TF.letters = (host, text) => {
    host.textContent = '';
    return [...text].map((ch) => {
      const s = el('span', 'ch');
      s.textContent = ch === ' ' ? ' ' : ch;
      s.style.display = 'inline-block';
      host.appendChild(s);
      return s;
    });
  };

  /** requestAnimationFrame loop: fn(dt seconds, t seconds). */
  TF.loop = (fn) => {
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      fn(dt, now / 1000);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /** Size a canvas to its box at device resolution; returns the 2D context. */
  TF.fitCanvas = (canvas) => {
    const fit = () => {
      const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1;
      canvas.width = Math.round(r.width * d);
      canvas.height = Math.round(r.height * d);
      canvas.getContext('2d').setTransform(d, 0, 0, d, 0, 0);
    };
    fit();
    addEventListener('resize', fit);
    return canvas.getContext('2d');
  };

  /* ---------------------------------------------------------- sensors */
  let camPromise = null;
  TF.camera = (w = 1280, h = 720) =>
    (camPromise ||= (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: w }, height: { ideal: h }, facingMode: 'user' },
        audio: false,
      });
      const v = el('video');
      v.muted = true;
      v.playsInline = true;
      v.srcObject = stream;
      await v.play();
      TF.aspect = v.videoWidth / v.videoHeight || 16 / 9;
      return v;
    })().catch((e) => { camPromise = null; throw e; }));

  /**
   * Microphone, self-calibrating:
   *   value 0..1  loudness between the room's noise floor and the loudest recent sound
   *   hit   0..1  a sudden onset (clap, shout, stamp), decays quickly
   *   hits        counts every onset, so stations never miss one between frames
   *   tone  0..1  brightness of the sound (low hum → 0, hiss / clap → 1)
   * Laptop mics vary a lot, so loudness is relative to what this mic has heard,
   * and the floor never trusts the digital silence some drivers produce.
   */
  TF.mic = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const ctx = new AudioContext();
    await ctx.resume();
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    an.smoothingTimeConstant = 0.6;
    const src = ctx.createMediaStreamSource(stream);
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    const freq = new Float32Array(an.frequencyBinCount);
    const binHz = ctx.sampleRate / an.fftSize;
    const m = { floor: -55, ref: -20, slow: -60, db: -90, raw: 0, value: 0, hit: 0, hits: 0, tone: 0.5, gain: 1 };
    let lastHit = 0;
    const onHit = (strength) => { m.hits++; m.hit = Math.max(m.hit, strength); };

    // Claps last ~10 ms, shorter than an animation frame, so onsets are found on
    // the audio thread every ~5 ms. A high-pass filter keeps voices from masking them.
    let onset = null;
    try {
      await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([ONSET_WORKLET], { type: 'application/javascript' })));
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1000;
      onset = new AudioWorkletNode(ctx, 'tf-onset');
      const mute = ctx.createGain();
      mute.gain.value = 0;
      src.connect(hp).connect(onset).connect(mute).connect(ctx.destination);
      onset.port.onmessage = (e) => onHit(e.data);
    } catch (e) {
      onset = null; // older browser: fall back to checking once per frame below
    }
    m.read = () => {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      m.db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-9);

      // floor: drops quickly to quiet moments, creeps up in loud halls, never below -70 dB
      m.floor = Math.max(-70, m.floor + (m.db < m.floor ? 0.2 : 0.002) * (m.db - m.floor));
      // ref: loudest recent sound, slowly relaxing, at least 30 dB above the floor
      m.ref = m.db > m.ref ? m.ref + 0.3 * (m.db - m.ref) : m.ref - 0.004;
      m.ref = Math.max(m.ref, m.floor + 30);

      m.raw = TF.clamp((m.db - m.floor - 6) / ((m.ref - m.floor) * m.gain));
      m.value += (m.raw - m.value) * (m.raw > m.value ? 0.45 : 0.07);

      const now = performance.now();
      m.slow += (m.db - m.slow) * 0.05;
      m.hit *= 0.86;
      if (!onset && m.db - m.slow > 9 && m.db > m.floor + 16 && now - lastHit > 160) {
        onHit(TF.clamp((m.db - m.slow) / 24 + 0.3));
        lastHit = now;
      }

      an.getFloatFrequencyData(freq);
      let pw = 0, cw = 0;
      const top = Math.min(freq.length, Math.round(8000 / binHz));
      for (let i = 2; i < top; i++) { const p = Math.pow(10, freq[i] / 10); pw += p; cw += p * i * binHz; }
      if (pw > 0 && m.raw > 0.05) m.tone += (TF.clamp((cw / pw - 300) / 3500) - m.tone) * 0.15;
      return m.value;
    };
    m.sensitivity = () => Math.round(100 / m.gain);
    // gain > 1 = less sensitive: louder sounds needed, and a sharper rise to count as a clap
    m.setGain = (g) => {
      m.gain = TF.clamp(g, 0.4, 2.5);
      if (onset) onset.port.postMessage({ rise: 7 * m.gain });
    };
    return m;
  };

  // Runs on the audio thread. Measures loudness in ~5 ms blocks and reports a hit
  // when a block jumps well above the recent average: a clap, a stamp, a shouted word.
  const ONSET_WORKLET = `
    class Onset extends AudioWorkletProcessor {
      constructor() {
        super();
        this.slow = -70; this.floor = -70; this.last = 0; this.rise = 7; this.acc = 0; this.n = 0;
        this.port.onmessage = (e) => { this.rise = e.data.rise; };
      }
      process(inputs) {
        const ch = inputs[0] && inputs[0][0];
        if (!ch) return true;
        for (let i = 0; i < ch.length; i++) {
          this.acc += ch[i] * ch[i];
          if (++this.n < 240) continue;
          const db = 10 * Math.log10(this.acc / this.n + 1e-12);
          this.acc = 0; this.n = 0;
          this.floor = Math.max(-80, this.floor + (db < this.floor ? 0.05 : 0.0005) * (db - this.floor));
          const jump = db - this.slow;
          if (jump > this.rise && db > this.floor + 10 && currentTime - this.last > 0.1) {
            this.last = currentTime;
            this.port.postMessage(Math.min(1, 0.4 + (jump - this.rise) / 20));
          }
          // the average follows rises slowly (so a clap stands out) and falls fast (ready for the next)
          this.slow += (db - this.slow) * (db > this.slow ? 0.03 : 0.12);
        }
        return true;
      }
    }
    registerProcessor('tf-onset', Onset);`;

  /* ------------------------------------------------------- MediaPipe */
  let visionPromise = null;
  const vision = () =>
    (visionPromise ||= (async () => {
      const mod = await import(`${VISION}/vision_bundle.mjs`);
      const fileset = await mod.FilesetResolver.forVisionTasks(`${VISION}/wasm`);
      return { mod, fileset };
    })().catch((e) => { visionPromise = null; throw e; }));

  async function createTask(kind, opts) {
    const { mod, fileset } = await vision();
    for (const delegate of ['GPU', 'CPU']) {
      try {
        return await mod[kind].createFromOptions(fileset, { ...opts, baseOptions: { ...opts.baseOptions, delegate } });
      } catch (e) {
        if (delegate === 'CPU') throw e;
      }
    }
  }
  TF.handTracker = (numHands = 2) =>
    createTask('HandLandmarker', {
      baseOptions: { modelAssetPath: MODELS.hand },
      runningMode: 'VIDEO', numHands,
      minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
  TF.faceTracker = () =>
    createTask('FaceLandmarker', {
      baseOptions: { modelAssetPath: MODELS.face },
      runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
    });
  TF.segmenter = () =>
    createTask('ImageSegmenter', {
      baseOptions: { modelAssetPath: MODELS.segment },
      runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false,
    });

  /** Run a task only when the webcam has a new frame; returns the latest result. */
  TF.tracker = (video, task) => {
    let lastTime = -1, result = null;
    return () => {
      if (video.readyState >= 2 && video.currentTime !== lastTime) {
        lastTime = video.currentTime;
        result = task.detectForVideo(video, performance.now());
      }
      return result;
    };
  };

  /* ---------------------------------------------------------- hands */
  // landmark space is squashed by the camera's aspect ratio, so undo that
  const D = (a, b) => Math.hypot((a.x - b.x) * (TF.aspect || 16 / 9), a.y - b.y);
  TF.handDist = D;

  /** Mirror a landmark onto a screen rect. `reach` lets small arm moves cover the screen. */
  TF.toScreen = (p, rect, reach = 0.12) => ({
    x: rect.left + TF.clamp((1 - p.x - reach) / (1 - 2 * reach)) * rect.width,
    y: rect.top + TF.clamp((p.y - reach) / (1 - 2 * reach)) * rect.height,
  });

  /** Classify a hand: point ☝ · open ✋ · fist ✊ · thumb 👍 · other. */
  TF.pose = (lm) => {
    const palm = D(lm[0], lm[9]);
    const ext = (tip, pip) => D(lm[tip], lm[0]) > D(lm[pip], lm[0]) * 1.12;
    const f = [ext(8, 6), ext(12, 10), ext(16, 14), ext(20, 18)];
    const n = f.filter(Boolean).length;
    const thumbUp = lm[4].y < lm[6].y && lm[2].y - lm[4].y > palm * 0.55;
    let name = 'other';
    if (n === 0) name = thumbUp ? 'thumb' : 'fist';
    else if (f[0] && n === 1) name = 'point';
    else if (n >= 4) name = 'open';
    return { name, pinch: D(lm[4], lm[8]) / palm, palm };
  };

  /** Debounce a label so a pose must hold for a few frames before it counts. */
  TF.steady = (frames = 4) => {
    let cur = 'none', cand = 'none', count = 0;
    return (v) => {
      if (v === cand) count++;
      else { cand = v; count = 1; }
      if (count >= frames) cur = cand;
      return cur;
    };
  };

  const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
  /** Draw hands as a quiet skeleton so visitors can see what the camera sees. */
  TF.drawHands = (ctx, hands, rect, color, reach) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    for (const lm of hands) {
      const p = lm.map((q) => TF.toScreen(q, rect, reach));
      ctx.beginPath();
      for (const [a, b] of BONES) { ctx.moveTo(p[a].x, p[a].y); ctx.lineTo(p[b].x, p[b].y); }
      ctx.stroke();
      for (const q of p) ctx.fillRect(q.x - 3, q.y - 3, 6, 6);
    }
    ctx.restore();
  };

  /* -------------------------------------------------------- keyboard */
  /**
   * Typing goes through a hidden text field that keeps focus. Browser extensions
   * with single-letter shortcuts (Vimium and friends) swallow keys on a plain page
   * but leave text fields alone, so every letter reaches the station.
   * onChar(ch) for each typed character, onKey('Backspace' | 'Enter').
   */
  TF.textInput = (onChar, onKey) => {
    const f = el('textarea', 'ghost-input');
    f.setAttribute('aria-label', 'Type here');
    f.setAttribute('autocomplete', 'off');
    f.setAttribute('autocapitalize', 'off');
    f.spellcheck = false;
    document.body.appendChild(f);
    const focus = () => {
      const a = document.activeElement;
      const typingElsewhere = a && a !== f && a.matches('input, textarea, [contenteditable]');
      if (document.body.classList.contains('started') && a !== f && !typingElsewhere) f.focus({ preventScroll: true });
    };
    f.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' || e.key === 'Enter') { e.preventDefault(); onKey(e.key); }
    });
    f.addEventListener('input', () => {
      for (const ch of f.value) onChar(ch);
      f.value = '';
    });
    f.addEventListener('blur', () => setTimeout(focus, 60));
    addEventListener('pointerup', () => setTimeout(focus, 0));
    setInterval(focus, 500);
    return { focus };
  };

  /** Live-typed word: typing after a pause starts a new word. */
  TF.typing = (initial, onChange, { max = 16, idle = 2500 } = {}) => {
    let word = initial, last = 0;
    const commit = (w) => { last = performance.now(); word = w.slice(0, max); onChange(word); };
    TF.textInput(
      (ch) => { if (/[\p{L}\p{N} !?'&.,-]/u.test(ch)) commit((performance.now() - last > idle ? '' : word) + ch); },
      (k) => { if (k === 'Backspace') commit(word.slice(0, -1)); },
    );
    return { get: () => word, set: (w) => { word = w; onChange(w); } };
  };

  /* ------------------------------------------------------------ save */
  let saveLib = null;
  const loadSaveLib = () =>
    (saveLib ||= new Promise((res, rej) => {
      const s = el('script');
      s.src = SAVE_LIB;
      s.onload = () => res(window.htmlToImage);
      s.onerror = rej;
      document.head.appendChild(s);
    }));

  /** The "?" in the bottom-right corner: hover (or tap) to see every shortcut. */
  TF.shortcuts = (keys) => {
    const help = el('div', 'help', `
      <button class="help-btn" aria-label="Keyboard shortcuts">?</button>
      <div class="help-pop" role="tooltip">
        <div class="eyebrow">Shortcuts</div>
        ${keys.map(([k, l]) => `<div class="row"><span class="key">${k}</span><span>${l}</span></div>`).join('')}
      </div>`);
    help.querySelector('.help-btn').onclick = () => help.classList.toggle('open');
    return help;
  };

  /* --------------------------------------------------- station shell */
  const friendly = (e) => {
    const n = e && e.name;
    if (n === 'NotAllowedError') return 'Permission was blocked. Click the camera/mic icon in the address bar, choose Allow, then press Start again.';
    if (n === 'NotFoundError') return 'No camera or microphone was found on this laptop.';
    if (n === 'NotReadableError') return 'The camera or mic is busy in another app or tab. Close it and try again.';
    return `Something went wrong: ${e && e.message ? e.message : e}. Check the internet connection (the tracking model loads from the web) and try again.`;
  };

  /**
   * Build a station page.
   * cfg: { theme, num, title, sensors, steps, lesson, privacy, gestures, keys, full, start(api) }
   */
  TF.station = (cfg) => {
    const body = document.body;
    body.dataset.theme = cfg.theme;
    document.title = `${cfg.num} ${cfg.title} · Type Feels`;

    const bar = el('header', 'bar', `
      <a class="chip" href="index.html">← All</a>
      <span class="num">${cfg.num}</span><h1>${cfg.title}</h1>
      <span class="gestures">${(cfg.gestures || []).map(([ico, label, id]) => `<span class="gesture" data-g="${id || ''}"><b>${ico}</b>${label}</span>`).join('')}</span>
      ${cfg.sensors.map((s) => `<span class="chip" data-sensor="${s}">${s}</span>`).join('')}
      <button class="chip" data-act="help">How to</button>
      <button class="chip" data-act="full">Fullscreen</button>`);
    const stage = el('main', 'stage' + (cfg.full ? ' full' : ''));
    const hint = TF.shortcuts([...(cfg.keys || []), ['Esc', 'All stations']]);
    const intro = el('section', 'intro', `
      <div class="big-num">${cfg.num}</div>
      <div class="body">
        <div class="eyebrow">Type Feels · ${cfg.sensors.join(' + ')}</div>
        <h2>${cfg.title}</h2>
        <ol>${cfg.steps.map(([ico, t]) => `<li><span class="ico">${ico}</span><span>${t}</span></li>`).join('')}</ol>
        <div class="actions"><button class="btn" data-act="start">Start</button><span class="keys"><span class="key">Enter</span></span></div>
        <div class="error"></div>
        <div class="lesson"><b>Design note</b>${cfg.lesson}</div>
        <div class="privacy">${cfg.privacy || 'Everything happens on this laptop. Nothing is recorded or uploaded.'}</div>
      </div>`);
    const toastEl = el('div', 'toast');
    body.append(stage, bar, hint, intro, toastEl);

    let started = false, toastTimer = 0;
    const startBtn = intro.querySelector('[data-act="start"]');
    const errBox = intro.querySelector('.error');

    const api = {
      stage, hint,
      keys: {},
      toast(msg, ms = 2200) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
      },
      status(sensor, state, text) {
        const c = bar.querySelector(`[data-sensor="${sensor}"]`);
        if (!c) return;
        c.className = 'chip' + (state ? ' ' + state : '');
        c.textContent = text || sensor;
      },
      gesture(id) {
        bar.querySelectorAll('.gesture').forEach((g) => g.classList.toggle('on', g.dataset.g === id));
      },
      key(k, fn) { api.keys[k.toLowerCase()] = fn; },
      async save(node, name, format = 'png') {
        api.toast('Saving…');
        try {
          const lib = await loadSaveLib();
          let bg = getComputedStyle(node).backgroundColor;
          if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') bg = getComputedStyle(body).backgroundColor;
          const url = await (format === 'svg' ? lib.toSvg : lib.toPng)(node, { pixelRatio: 2, backgroundColor: bg });
          const a = el('a');
          a.href = url;
          a.download = `type-feels-${name}-${Date.now()}.${format}`;
          a.click();
          api.toast('Saved to Downloads ✓');
        } catch (e) {
          api.toast('Could not save. Press Win+Shift+S to screenshot instead.', 3500);
        }
      },
    };

    const showIntro = (on) => {
      intro.classList.toggle('gone', !on);
      if (started) startBtn.textContent = 'Back to it';
    };

    const start = async () => {
      if (started) return showIntro(false);
      startBtn.disabled = true;
      startBtn.textContent = 'Loading…';
      errBox.textContent = '';
      try {
        await cfg.start(api);
        started = true;
        body.classList.add('started');
        showIntro(false);
      } catch (e) {
        console.error(e);
        errBox.textContent = friendly(e);
        startBtn.textContent = 'Try again';
      }
      startBtn.disabled = false;
    };

    startBtn.onclick = start;
    bar.querySelector('[data-act="help"]').onclick = () => showIntro(true);
    bar.querySelector('[data-act="full"]').onclick = () =>
      document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();

    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (e.ctrlKey && k === 's') { e.preventDefault(); api.keys['save'] && api.keys['save'](); return; }
      if (k === 'escape') {
        if (started && !intro.classList.contains('gone')) showIntro(false);
        else location.href = 'index.html';
        return;
      }
      const introOpen = !intro.classList.contains('gone');
      if (introOpen) { if (k === 'enter') { e.preventDefault(); start(); } return; }
      if (!e.ctrlKey && !e.metaKey && api.keys[k]) { e.preventDefault(); api.keys[k](e); }
    });

    return api;
  };
})();
