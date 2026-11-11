# audio-kit — API reference

**Version 1.1.0.** <div align="center">

Generated from the source in this repository: every name, argument and
note below is read out of the kit file, so it cannot describe a function
that is not there.

```js
<script src="audio-kit.js"></script>
AudioKit.freq(...)
// or: const AudioKit = require('./audio-kit.js')
```

## The surface (11 entries)

| Name | Arguments | What it does |
|---|---|---|
| `AudioKit.freq` | `(midi)` | — |
| `AudioKit.parse` | `(name)` | — |
| `AudioKit.midi` | `(name)` | — |
| `AudioKit.name` | `(midi)` | — |
| `AudioKit.transpose` | `(x, semitones)` | — |
| `AudioKit.interval` | `(a, b)` | — |
| `AudioKit.scales` | `()` | — |
| `AudioKit.scale` | `(root, name)` | — |
| `AudioKit.chords` | `()` | — |
| `AudioKit.chord` | `(root, quality)` | — |
| `AudioKit.step` | `(p)` | the diatonic step of a note, for placing it on a staff (letter + 7*octave) |

## Notes

- Zero dependencies, one file, no build step: it works from `file://`, from a
  `<script>` tag and from Node.
- The version above is the `VERSION` file in this repository; a pinned copy is
  what an app vendors.
