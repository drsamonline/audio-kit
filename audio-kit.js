/* audio-kit — synthesis, theory, patterns and notation. Zero dependencies.
 *
 * WebAudio synthesis (oscillator, ADSR, filter, noise, mixer), music theory
 * (notes, intervals, scales, chords, transposition), a pattern sequencer, a
 * notation layout, data sonification and honest mastering helpers. No audio
 * assets — everything is generated in code or stored as pattern data.
 *
 * THE RULE: game music is PATTERNS, NOT FILES. A Forge game ships as one file with
 * no assets; a pattern is a few KB of data and plays through WebAudio.
 *
 * Audio must not autoplay: the browser starts it on a user gesture. Every node
 * here is created from a context you pass in, on that gesture.
 *
 * MIT License. (c) 2026 Dr Sohil Momin.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AudioKit = factory();
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var A = { version: "0.1.0" };

  /* ============================================================ theory */

  var LETTERS = "CDEFGAB";
  var SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  var Music = {};
  A.music = Music;

  Music.freq = function (midi) { return 440 * Math.pow(2, (midi - 69) / 12); };

  Music.parse = function (name) {
    var m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(String(name).trim());
    if (!m) return null;
    var letter = m[1].toUpperCase();
    var acc = m[2] === "#" ? 1 : (m[2] === "b" ? -1 : 0);
    var oct = parseInt(m[3], 10);
    var midi = 12 * (oct + 1) + SEMI[letter] + acc;
    return { name: letter + m[2] + oct, letter: letter, accidental: acc, octave: oct, midi: midi, freq: Music.freq(midi) };
  };

  Music.midi = function (name) { var p = Music.parse(name); return p ? p.midi : null; };
  Music.name = function (midi) {
    var names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    return names[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  };
  Music.transpose = function (x, semitones) {
    var midi = (typeof x === "string") ? Music.midi(x) : x;
    return midi + semitones;
  };
  Music.interval = function (a, b) {
    var x = (typeof a === "string") ? Music.midi(a) : a, y = (typeof b === "string") ? Music.midi(b) : b;
    return y - x;
  };

  Music.scales = {
    major: [0, 2, 4, 5, 7, 9, 11],
    naturalMinor: [0, 2, 3, 5, 7, 8, 10],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    melodicMinor: [0, 2, 3, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    majorPentatonic: [0, 2, 4, 7, 9],
    minorPentatonic: [0, 3, 5, 7, 10],
    blues: [0, 3, 5, 6, 7, 10],
    wholeTone: [0, 2, 4, 6, 8, 10]
  };
  Music.scale = function (root, name) {
    var iv = Music.scales[name] || Music.scales.major;
    var r = (typeof root === "string") ? Music.midi(root) : root;
    return iv.map(function (s) { return r + s; });
  };

  Music.chords = {
    major: [0, 4, 7], minor: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
    sus2: [0, 2, 7], sus4: [0, 5, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10],
    dom7: [0, 4, 7, 10], dim7: [0, 3, 6, 9], add9: [0, 4, 7, 14]
  };
  Music.chord = function (root, quality) {
    var iv = Music.chords[quality] || Music.chords.major;
    var r = (typeof root === "string") ? Music.midi(root) : root;
    return iv.map(function (s) { return r + s; });
  };

  /* the diatonic step of a note, for placing it on a staff (letter + 7*octave) */
  Music.step = function (p) { return LETTERS.indexOf(p.letter) + 7 * p.octave; };

  /* ============================================================= synth */

  var Synth = {};
  A.synth = Synth;

  /* The ADSR gain at time t, for a note held `dur` seconds. A pure function, so
     the envelope's SHAPE can be tested with no audio context. */
  Synth.adsr = function (env, t, dur) {
    env = env || {};
    var a = env.a == null ? 0.01 : env.a;
    var d = env.d == null ? 0.10 : env.d;
    var s = env.s == null ? 0.70 : env.s;
    var r = env.r == null ? 0.20 : env.r;
    if (t < 0) return 0;
    if (a > 0 && t < a) return t / a;                                  // attack
    if (d > 0 && t < a + d) return 1 - (1 - s) * ((t - a) / d);        // decay
    if (t < dur) return s;                                             // sustain
    if (r > 0 && t < dur + r) return s * (1 - (t - dur) / r);          // release
    return 0;
  };

  /* Schedule that envelope on a gain node, from `t0`, for `dur` seconds. */
  Synth.applyAdsr = function (gain, t0, dur, env) {
    env = env || {};
    var a = env.a == null ? 0.01 : env.a, d = env.d == null ? 0.10 : env.d;
    var s = env.s == null ? 0.70 : env.s, r = env.r == null ? 0.20 : env.r;
    var g = gain.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.linearRampToValueAtTime(1, t0 + a);
    g.linearRampToValueAtTime(s, t0 + a + d);
    g.setValueAtTime(s, t0 + Math.max(a + d, dur));
    g.linearRampToValueAtTime(0.0001, t0 + Math.max(a + d, dur) + r);
    return gain;
  };

  /* An oscillator voice: osc -> [filter] -> gain -> dest. Everything from the
     context you pass in; nothing starts until you call .start(t). */
  Synth.voice = function (ctx, opts) {
    opts = opts || {};
    var osc = ctx.createOscillator();
    osc.type = opts.type || "sine";
    osc.frequency.value = opts.freq || 440;
    var gain = ctx.createGain();
    gain.gain.value = 0;
    var tail = osc;
    if (opts.filter) {
      var f = ctx.createBiquadFilter();
      f.type = opts.filter;
      f.frequency.value = opts.cutoff || 1200;
      f.Q.value = opts.q || 1;
      osc.connect(f); tail = f;
    }
    tail.connect(gain);
    gain.connect(opts.dest || ctx.destination);
    return {
      osc: osc, gain: gain,
      start: function (t) { osc.start(t || 0); return this; },
      stop: function (t) { osc.stop(t || 0); return this; },
      play: function (t0, dur, env) { Synth.applyAdsr(gain, t0 || 0, dur || 0.5, env); this.start(t0); this.stop((t0 || 0) + (dur || 0.5) + (env && env.r != null ? env.r : 0.2)); return this; }
    };
  };

  /* A noise source (white noise buffer, looping). */
  Synth.noise = function (ctx, seconds, rng) {
    var rate = ctx.sampleRate || 44100;
    var len = Math.max(1, Math.floor(rate * (seconds || 1)));
    var buf = ctx.createBuffer(1, len, rate);
    var d = buf.getChannelData(0);
    var r = rng || Math.random;
    for (var i = 0; i < len; i++) d[i] = r() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    return src;
  };

  /* A small mixer: a master gain and named channel gains. */
  Synth.mixer = function (ctx, opts) {
    opts = opts || {};
    var master = ctx.createGain();
    master.gain.value = opts.master == null ? 0.8 : opts.master;
    master.connect(ctx.destination);
    var channels = {};
    return {
      master: master,
      channel: function (name, vol) {
        var g = ctx.createGain();
        g.gain.value = vol == null ? 1 : vol;
        g.connect(master);
        channels[name] = g;
        return g;
      },
      set: function (name, vol) { if (channels[name]) channels[name].gain.value = vol; return this; },
      channels: function () { return Object.keys(channels); }
    };
  };

  /* ============================================================== seq */

  var Seq = {};
  A.seq = Seq;

  /* A pattern: rows of cells across channels, a note name (or null/"."/"").
     Played at bpm with rowsPerBeat rows to the beat. A few KB, not megabytes. */
  Seq.pattern = function (rows, opts) {
    opts = opts || {};
    return {
      name: opts.name || "pattern",
      bpm: opts.bpm || 120,
      rowsPerBeat: opts.rowsPerBeat || 4,
      rows: rows.map(function (r) { return Array.isArray(r) ? r.slice() : [r]; })
    };
  };

  /* Flatten a pattern to timed events. Pure arithmetic — the beats a note lands
     on, with no audio context — so scheduling can be tested. */
  Seq.events = function (pattern, opts) {
    opts = opts || {};
    var rowsPerBeat = pattern.rowsPerBeat || 4;
    var spb = 60 / (pattern.bpm || 120);        // seconds per beat
    var rowDur = spb / rowsPerBeat;             // seconds per row
    var out = [];
    pattern.rows.forEach(function (row, r) {
      row.forEach(function (cell, ch) {
        if (cell == null || cell === "" || cell === ".") return;
        var p = Music.parse(cell);
        if (!p) return;
        out.push({ row: r, channel: ch, note: cell, midi: p.midi, freq: p.freq, beat: r / rowsPerBeat, time: r * rowDur, dur: rowDur });
      });
    });
    return out;
  };

  /* Schedule the events through WebAudio from a start time. */
  Seq.play = function (ctx, pattern, opts) {
    opts = opts || {};
    var t0 = opts.at == null ? ctx.currentTime : opts.at;
    var dest = opts.dest || ctx.destination;
    var voices = [];
    Seq.events(pattern, opts).forEach(function (e) {
      var v = Synth.voice(ctx, { type: opts.type || "square", freq: e.freq, dest: dest, filter: opts.filter, cutoff: opts.cutoff });
      v.play(t0 + e.time, e.dur * (opts.hold == null ? 0.9 : opts.hold), opts.env);
      voices.push(v);
    });
    return voices;
  };

  /* ========================================================= notation */

  var Notation = {};
  A.notation = Notation;

  /* Lay notes out on a staff. y is in staff steps from the clef's middle line
     (negative is up the page), so a renderer only multiplies by its own spacing. */
  Notation.layout = function (notes, opts) {
    opts = opts || {};
    var clef = opts.clef || "treble";
    var ref = Music.step(Music.parse(clef === "bass" ? "D3" : "B4"));
    var spacing = opts.spacing == null ? 20 : opts.spacing;
    var out = notes.map(function (n, i) {
      var p = (typeof n === "string") ? Music.parse(n) : n;
      var step = Music.step(p) - ref;
      return { index: i, x: i * spacing, step: step, y: -step, midi: p.midi, letter: p.letter, octave: p.octave, accidental: p.accidental };
    });
    return { clef: clef, notes: out, width: notes.length * spacing, middleLine: ref };
  };

  /* ============================================================ sonify */
  /* Map bytes to sound — the binary of any file, played. (Reference:
     MaxAlyokhin/binary-synth, MIT.) */
  A.sonify = function (bytes, opts) {
    opts = opts || {};
    var base = opts.base == null ? 57 : opts.base;   // A3
    var range = opts.range == null ? 36 : opts.range;
    var step = opts.step == null ? 0.1 : opts.step;
    var arr = (bytes && bytes.length != null) ? Array.prototype.slice.call(bytes) : [];
    return arr.map(function (b, i) {
      var semi = Math.round((b / 255) * range);
      return { index: i, byte: b, midi: base + semi, freq: Music.freq(base + semi), time: i * step, dur: step };
    });
  };

  /* =========================================================== master */
  /* Honest mastering HELPERS: a loudness measure, a match gain and a peak
     limiter. This is a MATCHING AID, not a replacement for an engineer.
     (Technique only; reference sergree/matchering, GPL-3.0.) */
  A.master = {
    rms: function (samples) {
      var s = 0;
      for (var i = 0; i < samples.length; i++) s += samples[i] * samples[i];
      return samples.length ? Math.sqrt(s / samples.length) : 0;
    },
    peak: function (samples) {
      var m = 0;
      for (var i = 0; i < samples.length; i++) { var v = Math.abs(samples[i]); if (v > m) m = v; }
      return m;
    },
    matchGain: function (source, reference) {
      var rs = A.master.rms(source), rr = A.master.rms(reference);
      return rs > 0 ? rr / rs : 1;
    },
    limit: function (samples, ceiling) {
      ceiling = ceiling == null ? 0.98 : ceiling;
      var out = new Float32Array(samples.length);
      for (var i = 0; i < samples.length; i++) out[i] = Math.max(-ceiling, Math.min(ceiling, samples[i]));
      return out;
    }
  };

  return A;
}));
