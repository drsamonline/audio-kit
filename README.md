<div align="center">

# audio-kit

[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-2e7d32)](LICENSE)

**Synthesis, theory, patterns and notation.** Zero dependencies, one file, no audio assets.

synthesis · ADSR · filters · noise · mixer · music theory · patterns · notation · sonification · mastering

</div>

---

## The rule this kit exists to state

**Game music is PATTERNS, NOT FILES.** A Forge game ships as one file with no assets. A
pattern is a few kilobytes of data and plays through WebAudio; an audio file is
megabytes. `game-kit` should adopt this rule: generate the music, do not ship it.

## What's in it

| | |
|---|---|
| `music` | notes, intervals, transposition, 12 scales, 11 chords — the arithmetic every musical feature needs |
| `synth` | a pure **ADSR** envelope, an oscillator voice with an optional filter, a noise source, and a small mixer |
| `seq` | a **pattern sequencer**: rows × channels of notes, flattened to timed events and scheduled through WebAudio |
| `notation` | a staff **layout** — each note's position, so a renderer just draws it |
| `sonify` | map the bytes of any file to sound |
| `master` | **honest** mastering helpers: a loudness measure, a match gain, and a peak limiter |
| `time` | **deterministic time**: a seeded PRNG with stable forks, a tempo **map** (rubato, ritardando), and human timing jitter |
| `sched` | a lookahead **scheduler with a watchdog** — a throttled tab must not end a song halfway |
| `texture` | seven synthesised **ambient beds** (rain, wind, fire, vinyl, ocean, stream, hum) |
| — | `synth.harmonics()` keeps partials under Nyquist; `synth.softClip()` is a master safety curve |

Everything is generated in code or stored as pattern data. **No audio assets are shipped.**

## What changed in 1.1.0

Four things learnt building a full generative composer on this kit:

1. **Determinism is a feature, not a detail.** `A.time.seeded(seed)` gives the same stream everywhere, and `fork("drums")` is stable per label — so one track can be locked while the rest is re-rolled.
2. **Tempo moves.** `A.time.map([{beat:0,bpm:80},{beat:16,bpm:90}])` with `secondsAt`/`beatAt`/`bpmAt`. Every beat→second conversion in a real piece has to go through it, or note *lengths* drift the moment the tempo changes.
3. **Static is usually aliasing, and clicks are usually corners.** `synth.harmonics()` clamps partials under Nyquist; `synth.softClip()` is a `tanh` curve for the master, because a hard clamp is a corner and a corner is a click.
4. **A scheduler needs a watchdog.** `setInterval` stops in a throttled tab; `A.sched()` notices and keeps ticking.

## Usage

```js
var A = require("./audio-kit.js");        // Node; in a browser it is window.AudioKit

// Theory — no audio needed
A.music.scale("C4", "major");             // -> [60, 62, 64, 65, 67, 69, 71]
A.music.chord("A4", "minor");             // -> [69, 72, 76]
A.music.parse("A4").freq;                 // -> 440

// Synthesis — on a user gesture (the browser rule)
var ctx = new AudioContext();
var v = A.synth.voice(ctx, { type: "square", freq: 440, filter: "lowpass", cutoff: 900 });
v.play(ctx.currentTime, 0.5, { a: 0.01, d: 0.1, s: 0.7, r: 0.3 });

// A pattern: a few KB of data, not a file
var pat = A.seq.pattern([
  ["C4", null, null, "E4"],
  ["G4", null, "B4", null]
], { bpm: 120, rowsPerBeat: 4 });
A.seq.play(ctx, pat, { type: "square" });

// Notation layout
A.notation.layout(["C4", "D4", "E4"]);    // -> { notes: [{x, step, ...}], width }
```

## Notes

- **No autoplay.** Every node is built from a context you create on a user gesture.
- **Everything is reimplemented.** References (the tracker tradition, Orca, MuseScore, matchering, binary-synth, Neothesia) are named in comments; **no code is copied**, and the copyleft ones are technique only.
- **The mastering helpers are a matching aid, not a replacement for an engineer** — say so in any app that uses them.

## Tests

```
node test-node.js
42 passed, 0 failed
```

Covers the spec's required cases — an **ADSR envelope shape**, a **scale/chord construction**, a **sequencer scheduling** case (notes land on the right beats), and a **notation layout** — plus note parsing, transposition, sonification and the mastering helpers. All headless: the theory, the envelope maths and the scheduling are pure, so they test with no audio context.

## Support

<img src="docs/assets/support-portrait.jpg" width="72" height="72" alt="Dr. Sohil Momin" align="left" style="border-radius:50%;margin-right:1rem">

Free, offline, accountless — and staying that way. If it earned its keep:

| | |
|---|---|
| UPI (India) | `drsohilboi@ybl` — payee Dr. Sohil Momin, open amount, or scan [the QR](docs/assets/upi-qr.svg) |
| GitHub Sponsors | [github.com/sponsors/drsamonline](https://github.com/sponsors/drsamonline) |
| Ko-fi | [ko-fi.com/matneo](https://ko-fi.com/matneo) |
| PayPal | [paypal.me/drsohilmomin](https://paypal.me/drsohilmomin?locale.x=en_GB&country.x=IN) |
| My books | [Amazon author store](https://www.amazon.com/stores/author/B08ZT331LY/allbooks?ccs_id=aed72b9f-71d9-41dc-adee-e9368a317acc) |
| More apps | [drsamonline.github.io](https://drsamonline.github.io/) |
| Email | [sohilmomin2000@gmail.com](mailto:sohilmomin2000@gmail.com) |

Nothing is gated behind it: no accounts, no tracking, no network requests.

## License

PolyForm Noncommercial — see [LICENSE](LICENSE). © 2026 Dr Sohil Momin.
