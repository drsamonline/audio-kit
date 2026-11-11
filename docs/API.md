# audio-kit — API reference

**Version 1.1.0.** <div align="center">

Generated from the source in this repository: every name, argument and
note below is read out of the kit file, so it cannot describe a function
that is not there.

```js
<script src="audio-kit.js"></script>
AudioKit.palette  // or: const AudioKit = require('./audio-kit.js')
```

## The surface (30 entries)

| Name | Arguments | What it does |
|---|---|---|
| `AudioKit.Music.freq` | `(midi)` | — |
| `AudioKit.Music.parse` | `(name)` | — |
| `AudioKit.Music.midi` | `(name)` | — |
| `AudioKit.Music.name` | `(midi)` | — |
| `AudioKit.Music.transpose` | `(x, semitones)` | — |
| `AudioKit.Music.interval` | `(a, b)` | — |
| `AudioKit.Music.scales` | `()` | — |
| `AudioKit.Music.scale` | `(root, name)` | — |
| `AudioKit.Music.chords` | `()` | — |
| `AudioKit.Music.chord` | `(root, quality)` | — |
| `AudioKit.Music.step` | `(p)` | the diatonic step of a note, for placing it on a staff (letter + 7*octave) */ |
| `AudioKit.Synth.harmonics` | `(sampleRate, freq, wanted)` | Nothing above Nyquist: harmonics that cross it fold back as aliasing, which is what "static" usually is. Ask before you add partials. |
| `AudioKit.Synth.softClipCurve` | `(size)` | A master safety curve: unity at low level, soft knee near full scale. tanh, not a clamp — a clamp is a corner, and a corner is a click. |
| `AudioKit.Synth.softClip` | `(ctx, oversample)` | — |
| `AudioKit.Synth.adsr` | `(env, t, dur)` | — |
| `AudioKit.Synth.applyAdsr` | `(gain, t0, dur, env)` | Schedule that envelope on a gain node, from `t0`, for `dur` seconds. */ |
| `AudioKit.Synth.voice` | `(ctx, opts)` | — |
| `AudioKit.Synth.noise` | `(ctx, seconds, rng)` | A noise source (white noise buffer, looping). */ |
| `AudioKit.Synth.mixer` | `(ctx, opts)` | A small mixer: a master gain and named channel gains. */ |
| `AudioKit.Seq.pattern` | `(rows, opts)` | — |
| `AudioKit.Seq.events` | `(pattern, opts)` | — |
| `AudioKit.Seq.play` | `(ctx, pattern, opts)` | Schedule the events through WebAudio from a start time. */ |
| `AudioKit.Notation.layout` | `(notes, opts)` | — |
| `AudioKit.sonify` | `(bytes, opts)` | — |
| `AudioKit.master` | `()` | — |
| `AudioKit.Time.seeded` | `(seed)` | mulberry32: small, fast, good enough, and identical everywhere. |
| `AudioKit.Time.map` | `(segments, base)` | A tempo map: [{ beat, bpm }, ...]. Everything that converts beats to seconds goes through secondsAt, so rubato and ritardando stay coherent. |
| `AudioKit.Time.humane` | `(rng, bpm)` | How much a human drifts off the grid, in seconds, at a given tempo. |
| `AudioKit.sched` | `(ctx, opts)` | — |
| `AudioKit.texture` | `(ctx, dest, o)` | — |

## Notes

- Zero dependencies, one file, no build step: it works from `file://`, from a
  `<script>` tag and from Node.
- The version above is the `VERSION` file in this repository; a pinned copy is
  what an app vendors.
