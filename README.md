<div align="center">

# audio-kit

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

Everything is generated in code or stored as pattern data. **No audio assets are shipped.**

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

## License

PolyForm Noncommercial — see [LICENSE](LICENSE). © 2026 Dr Sohil Momin.
