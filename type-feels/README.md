# Type Feels: interactive typography stall

Six stations that only use the laptop's own sensors (webcam, mic, keyboard, trackpad).

| # | Station | Sensor | What happens |
|---|---------|--------|--------------|
| 01 | Make Some Noise | Mic | Words made of springy strokes. Loudness swirls them, claps blow them apart, and they spring back |
| 02 | Blackout Poetry | Camera | ☝️ point to black out words, ✊ move, ✋ wipe, 👍 reveal your poem |
| 03 | Bloom | Keyboard + trackpad | Letters grow vines and roses that lean toward the cursor; click for butterflies; Poster mode exports PNG/SVG |
| 04 | Face → Font | Camera | Your expression blends five typefaces |
| 05 | Words That Act | Keyboard | Typed words act out their meaning (rain drips, shy hides…) |
| 06 | Stretch the Word | Camera | Pinch with both hands to stretch; turn an open palm like a dial (or use the slider) for weight |

Two older stations are still in the folder but not on the menu: `whisper.html` (Whisper / Shout, with the fixed mic levels) and `rain.html` (Text Rain).

## Two versions
- `js-version/`: separate HTML, CSS (`css/`) and JavaScript (`js/`) files. Edit this one.
- `inline-version/`: every page is a single self-contained `.html` with inline `<style>` and `<script>`.
  Regenerate it after editing with `node build-inline.js`.

## Running it
Use **Google Chrome**. Serve the folder over localhost (camera and mic need it):

```
python -m http.server 8765
```

Then open http://localhost:8765/js-version/ (or `/inline-version/`), allow the camera and mic, and press F11.

**Internet is needed on first load**: fonts, the MediaPipe tracking models and Chrome's speech-to-text all come from the web.

## Shortcuts
Hover the **?** in the bottom-right corner of any screen. On the hub, `1–6` opens a station; `Esc` always returns to the hub.
On the mic stations, `[` / `]` adjusts sensitivity for a noisy hall.

## Stall tips
- Use a dark corner and a 3000+ lumen projector. Light faces and hands from the front.
- If the camera or mic is blocked, most stations fall back to the mouse (click = clap on Make Some Noise).
- Inspired by r.osie.l (audio-reactive type + physics) and @art.akshat (blooming type). Credit them at the stall.
