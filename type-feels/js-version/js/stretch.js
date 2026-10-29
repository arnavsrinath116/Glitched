/* 06 · STRETCH THE WORD
   Pinch both ends of a word and pull it like taffy. Your hands drive the
   axes of a variable font: distance → width, tilt → angle. Weight has its own
   controls: turn an open palm like a dial, or use the slider, scroll or arrows. */
(() => {
  const { clamp, lerp } = TF;
  const REACH = 0.1;

  TF.station({
    theme: 'stretch', num: '06', title: 'Stretch the Word', sensors: ['Camera'],
    steps: [
      ['🤏', 'Pinch with both hands, thumb and finger together, like grabbing the ends of the word.'],
      ['↔️', 'Pull apart to widen it. Tilt your hands to rotate it.'],
      ['🖐️', 'Show one open palm and turn it like a dial: clockwise is bolder, anticlockwise is thinner.'],
      ['✋', 'Let go and the word keeps its new shape. Type to change the word.'],
    ],
    lesson: 'This is a variable font: one file, endless styles. You just moved its axes with your hands.',
    gestures: [['🤏🤏', 'stretch', 'two'], ['🤏', 'move', 'one'], ['🖐️↻', 'turn = weight', 'dial'], ['✋', 'let go', 'none']],
    keys: [['Type', 'Change word'], ['↑ ↓', 'Bolder / thinner'], ['Scroll', 'Weight'], ['Drag', 'Stretch with the mouse'], ['Del', 'Reset'], ['Ctrl S', 'Save']],
    start,
  });

  async function start({ stage, status, toast, gesture, key, save }) {
    stage.innerHTML = `
      <canvas class="hands"></canvas>
      <div class="word"><span class="txt"></span><i class="h tl"></i><i class="h tr"></i><i class="h bl"></i><i class="h br"></i></div>
      <aside class="axes">
        ${['wdth', 'wght', 'rotate', 'size'].map((a) => `<div class="ax" data-a="${a}"><span>${a}</span><b><i></i></b><em></em></div>`).join('')}
        <code></code>
      </aside>
      <div class="wslider"><span>Black</span><div class="rail"><i class="fill"></i><i class="knob"></i></div><span>Thin</span></div>`;
    const ctx = TF.fitCanvas(stage.querySelector('canvas'));
    const wordEl = stage.querySelector('.word');
    const txt = stage.querySelector('.txt');
    const code = stage.querySelector('code');
    const ax = Object.fromEntries(['wdth', 'wght', 'rotate', 'size'].map((a) => [a, stage.querySelector(`.ax[data-a="${a}"]`)]));

    const word = TF.typing('STRETCH', (w) => { txt.textContent = w || ' '; }, { max: 14 });
    txt.textContent = word.get();

    const home = () => ({ x: stage.clientWidth / 2, y: stage.clientHeight / 2, wdth: 100, wght: 600, rot: 0, span: stage.clientWidth * 0.5 });
    let goal = home(), now = { ...goal };
    key('delete', () => { goal = home(); });
    key('save', () => save(stage, 'stretch'));

    // font-size that makes the word exactly as wide as the hands are apart
    function sizeFor(span, wdth, wght) {
      txt.style.fontSize = '100px';
      txt.style.fontVariationSettings = TF.axes({ wdth, wght, opsz: 144 });
      return clamp((100 * span) / Math.max(1, txt.offsetWidth), 24, 640);
    }

    function grab(A, B, rect) {
      const span = Math.hypot(B.x - A.x, B.y - A.y);
      goal.x = (A.x + B.x) / 2;
      goal.y = (A.y + B.y) / 2;
      goal.span = Math.max(48, span);
      goal.rot = clamp((Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI, -60, 60);
      goal.wdth = lerp(25, 151, clamp((span / rect.width - 0.12) / 0.6));
    }

    /* ---- mouse fallback: drag from one end to the other */
    let drag = null, mouseB = null;
    stage.addEventListener('pointerdown', (e) => { if (e.target.closest('.wslider')) return; const r = stage.getBoundingClientRect(); drag = { x: e.clientX - r.left, y: e.clientY - r.top }; mouseB = drag; });
    addEventListener('pointermove', (e) => { if (drag) { const r = stage.getBoundingClientRect(); mouseB = { x: e.clientX - r.left, y: e.clientY - r.top }; } });
    addEventListener('pointerup', () => { drag = null; });

    /* ---- weight, separate from stretching: slider, scroll wheel, arrow keys */
    const rail = stage.querySelector('.rail');
    let sliding = false;
    const slideTo = (e) => { const r = rail.getBoundingClientRect(); goal.wght = lerp(1000, 100, clamp((e.clientY - r.top) / r.height)); };
    rail.addEventListener('pointerdown', (e) => { sliding = true; slideTo(e); });
    addEventListener('pointermove', (e) => { if (sliding) slideTo(e); });
    addEventListener('pointerup', () => { sliding = false; });
    stage.addEventListener('wheel', (e) => { e.preventDefault(); goal.wght = clamp(goal.wght - e.deltaY * 0.6, 100, 1000); }, { passive: false });
    key('arrowup', () => { goal.wght = clamp(goal.wght + 50, 100, 1000); });
    key('arrowdown', () => { goal.wght = clamp(goal.wght - 50, 100, 1000); });

    let track = null;
    try {
      const video = await TF.camera();
      track = TF.tracker(video, await TF.handTracker(2));
      status('Camera', 'live', 'Camera · hands');
    } catch (e) {
      status('Camera', 'warn', 'No camera · use mouse');
      toast(e && e.name === 'NotAllowedError' ? 'Camera is blocked: allow it in the address bar, then reload. Mouse works meanwhile.' : 'Hand tracking unavailable. Drag with the mouse to stretch.', 6000);
    }

    await document.fonts.ready;
    const pinched = [false, false];
    const steady = [TF.steady(4), TF.steady(4)];
    let dial = null;

    TF.loop(() => {
      const W = stage.clientWidth, H = stage.clientHeight, rect = { left: 0, top: 0, width: W, height: H };
      ctx.clearRect(0, 0, W, H);

      let grips = [];
      const res = track && track();
      const hands = (res && res.landmarks) || [];
      if (hands.length) TF.drawHands(ctx, hands, rect, '#D4FF3A', REACH);
      let dialHand = null;
      hands.forEach((lm, i) => {
        const pose = TF.pose(lm), p = pose.pinch;
        if (steady[i](pose.name) === 'open' && p > 0.6) dialHand = lm;
        pinched[i] = pinched[i] ? p < 0.55 : p < 0.35; // hysteresis so grips don't flicker
        if (pinched[i]) {
          const a = TF.toScreen(lm[4], rect, REACH), b = TF.toScreen(lm[8], rect, REACH);
          grips.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        }
      });
      if (drag && mouseB) grips = [drag, mouseB];
      grips.sort((a, b) => a.x - b.x);

      if (grips.length >= 2) grab(grips[0], grips[1], rect);
      else if (grips.length === 1) { goal.x = grips[0].x; goal.y = grips[0].y; }

      // an open palm turned like a dial: the line across the knuckles is the pointer
      if (dialHand) {
        const a = Math.atan2(dialHand[17].y - dialHand[5].y, -(dialHand[17].x - dialHand[5].x) * (TF.aspect || 16 / 9));
        if (!dial) dial = { prev: a, acc: 0, from: goal.wght };
        let da = a - dial.prev;
        if (da > Math.PI) da -= Math.PI * 2;
        if (da < -Math.PI) da += Math.PI * 2;
        dial.prev = a;
        dial.acc += da;
        goal.wght = clamp(dial.from + (dial.acc * 180 / Math.PI) * 6, 100, 1000);
        const c = TF.toScreen(dialHand[9], rect, REACH);
        ctx.save();
        ctx.lineWidth = 8;
        ctx.strokeStyle = 'rgba(212,255,58,.18)';
        ctx.beginPath(); ctx.arc(c.x, c.y, 64, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#FF3AF2';
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(c.x, c.y, 64, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ((now.wght - 100) / 900)); ctx.stroke();
        ctx.fillStyle = '#D4FF3A';
        ctx.font = '700 16px "Space Mono"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('wght ' + Math.round(now.wght), c.x, c.y + 88);
        ctx.restore();
      } else dial = null;
      gesture(grips.length >= 2 ? 'two' : grips.length === 1 ? 'one' : dialHand ? 'dial' : 'none');

      const k = 0.3;
      for (const p of ['x', 'y', 'wdth', 'wght', 'rot', 'span']) now[p] = lerp(now[p], goal[p], k);
      const size = sizeFor(now.span, now.wdth, now.wght);
      txt.style.fontSize = size + 'px';
      wordEl.style.transform = `translate(${now.x}px, ${now.y}px) rotate(${now.rot}deg) translate(-50%, -50%)`;
      wordEl.classList.toggle('held', grips.length > 0);

      // designer-style measurement between the two grips
      if (grips.length >= 2) {
        const [A, B] = grips;
        ctx.save();
        ctx.strokeStyle = '#FF3AF2';
        ctx.fillStyle = '#FF3AF2';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        ctx.setLineDash([]);
        for (const P of [A, B]) { ctx.beginPath(); ctx.arc(P.x, P.y, 16, 0, Math.PI * 2); ctx.stroke(); ctx.fillRect(P.x - 4, P.y - 4, 8, 8); }
        const label = `${Math.round(now.span)} px`;
        ctx.font = '700 16px "Space Mono"';
        const tw = ctx.measureText(label).width;
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 - 40;
        ctx.fillRect(mx - tw / 2 - 8, my - 16, tw + 16, 32);
        ctx.fillStyle = '#0E0E0E';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, mx, my + 1);
        ctx.restore();
      } else if (grips.length === 1) {
        ctx.strokeStyle = '#FF3AF2';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(grips[0].x, grips[0].y, 16, 0, Math.PI * 2); ctx.stroke();
      }

      const set = (a, v, t, txtV) => { ax[a].style.setProperty('--v', clamp(t)); ax[a].querySelector('em').textContent = txtV ?? Math.round(v); };
      set('wdth', now.wdth, (now.wdth - 25) / 126);
      set('wght', now.wght, (now.wght - 100) / 900);
      stage.style.setProperty('--w', ((now.wght - 100) / 900).toFixed(3));
      set('rotate', now.rot, (now.rot + 60) / 120, Math.round(now.rot) + '°');
      set('size', size, (size - 24) / 616, Math.round(size) + 'px');
      code.textContent = `font-variation-settings: "wdth" ${Math.round(now.wdth)}, "wght" ${Math.round(now.wght)};`;
    });
  }
})();
