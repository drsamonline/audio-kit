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
 * PolyForm Noncommercial 1.0.0. (c) 2026 Dr Sohil Momin.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AudioKit = factory();
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var A = { version: "1.1.0" };

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

  // Nothing above Nyquist: harmonics that cross it fold back as aliasing,
  // which is what "static" usually is. Ask before you add partials.
  Synth.harmonics = function (sampleRate, freq, wanted) {
    var limit = (sampleRate || 44100) * 0.45;
    return Math.max(1, Math.min(wanted, Math.floor(limit / Math.max(20, freq))));
  };

  // A master safety curve: unity at low level, soft knee near full scale.
  // tanh, not a clamp — a clamp is a corner, and a corner is a click.
  Synth.softClipCurve = function (size) {
    var n = size || 2048;
    var curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x);
    }
    return curve;
  };

  Synth.softClip = function (ctx, oversample) {
    var ws = ctx.createWaveShaper();
    ws.curve = Synth.softClipCurve(2048);
    if (oversample) ws.oversample = "2x";
    return ws;
  };

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


  /* ============================================================== time */
  /* Deterministic time and randomness. Every generative feature in an
   * offline app should be reproducible from a seed — that is what makes a
   * shareable link honest. */

  var Time = {};
  A.time = Time;

  // mulberry32: small, fast, good enough, and identical everywhere.
  Time.seeded = function (seed) {
    var s = (typeof seed === "number" ? seed : hash(seed)) >>> 0;
    function next() {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    var api = {
      float: next,
      int: function (n) { return Math.floor(next() * n); },
      range: function (a, b) { return a + next() * (b - a); },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      chance: function (p) { return next() < p; },
      // a fork is stable per label, so changing one track cannot shift another
      fork: function (label) { return Time.seeded(hash(String(seed) + "|" + label)); },
    };
    return api;
  };

  function hash(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }
  Time.hash = hash;

  // A tempo map: [{ beat, bpm }, ...]. Everything that converts beats to
  // seconds goes through secondsAt, so rubato and ritardando stay coherent.
  Time.map = function (segments, base) {
    var clean = (segments || []).map(function (s) {
      return { beat: Math.max(0, s.beat), bpm: clampBpm(s.bpm) };
    }).sort(function (a, b) { return a.beat - b.beat; });
    if (!clean.length || clean[0].beat > 0) clean.unshift({ beat: 0, bpm: clampBpm(base || 100) });

    var starts = [0];
    for (var i = 1; i < clean.length; i++) {
      starts[i] = starts[i - 1] + (clean[i].beat - clean[i - 1].beat) * 60 / clean[i - 1].bpm;
    }

    function find(arr, value) {
      var lo = 0, hi = arr.length - 1;
      while (lo < hi) {
        var mid = (lo + hi + 1) >> 1;
        if (arr[mid] <= value) lo = mid; else hi = mid - 1;
      }
      return lo;
    }

    return {
      segments: clean,
      secondsAt: function (beat) {
        var b = Math.max(0, beat);
        var i = find(clean.map(function (s) { return s.beat; }), b);
        return starts[i] + (b - clean[i].beat) * 60 / clean[i].bpm;
      },
      beatAt: function (sec) {
        var s = Math.max(0, sec);
        var i = find(starts, s);
        return clean[i].beat + (s - starts[i]) * clean[i].bpm / 60;
      },
      bpmAt: function (beat) {
        var b = Math.max(0, beat), bpm = clean[0].bpm;
        for (var j = 0; j < clean.length; j++) if (clean[j].beat <= b) bpm = clean[j].bpm;
        return bpm;
      },
      min: Math.min.apply(null, clean.map(function (s) { return s.bpm; })),
      max: Math.max.apply(null, clean.map(function (s) { return s.bpm; })),
    };
  };

  function clampBpm(bpm) { return Math.max(20, Math.min(500, Math.round(bpm * 100) / 100)); }

  // How much a human drifts off the grid, in seconds, at a given tempo.
  Time.humane = function (rng, bpm) {
    var beatSec = 60 / (bpm || 100);
    var scale = Math.max(0.0015, Math.min(0.012, beatSec * 0.02));
    return (rng.float() * 2 - 1) * scale;
  };

  /* ========================================================= scheduling */
  /* A lookahead scheduler with a watchdog. setInterval jitters when the main
   * thread is busy, and a throttled tab stops it entirely — the watchdog is
   * what stops a song from simply ending halfway through. */

  A.sched = function (ctx, opts) {
    var o = opts || {};
    var horizon = o.horizon || 0.2;
    var interval = o.interval || 0.025;
    var onTick = o.onTick;
    var onLate = o.onLate || null;
    var timer = null, watchdog = null, last = 0, running = false;

    function tick() {
      if (!running) return;
      last = Date.now();
      onTick(ctx.currentTime, horizon, onLate);
    }

    return {
      start: function () {
        if (running) return;
        running = true;
        last = Date.now();
        timer = setInterval(tick, interval * 1000);
        watchdog = setInterval(function () {
          if (running && Date.now() - last > 700) tick();
        }, 500);
        tick();
      },
      stop: function () {
        running = false;
        if (timer) clearInterval(timer);
        if (watchdog) clearInterval(watchdog);
        timer = watchdog = null;
      },
      get running() { return running; },
    };
  };

  /* ============================================================ textures */
  /* Beds for ambient work: filtered noise with a slow LFO and sparse events.
   * Same idea as a full ambient mixer, small enough to live in a kit. */

  var TEXTURES = {
    rain:     { level: 0.5,  lp: 5200, hp: 420, events: 6,  decay: 0.09 },
    wind:     { level: 0.55, lp: 1400, hp: 120, lfo: [0.07, 900] },
    fire:     { level: 0.4,  lp: 2200, hp: 90,  events: 14, decay: 0.06 },
    vinyl:    { level: 0.32, lp: 9000, hp: 700, events: 3,  decay: 0.05 },
    ocean:    { level: 0.6,  lp: 900,  hp: 60,  lfo: [0.045, 600] },
    stream:   { level: 0.45, lp: 4200, hp: 500, lfo: [0.3, 300] },
    hum:      { level: 0.3,  lp: 300,  hp: 40 },
  };
  A.textures = TEXTURES;

  A.texture = function (ctx, dest, o) {
    var spec = TEXTURES[o.kind] || TEXTURES.rain;
    var when = o.when || ctx.currentTime;
    var dur = Math.max(0.5, o.dur || 8);
    var rng = Time.seeded(o.seed || 1);

    var out = ctx.createGain();
    out.gain.value = 0;
    out.connect(dest);

    var src = ctx.createBufferSource();
    src.buffer = o.noise || A.synth.noiseBuffer(ctx, 3);
    src.loop = true;

    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = spec.lp;
    var hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = spec.hp;
    src.connect(lp); lp.connect(hp); hp.connect(out);

    var peak = Math.max(0.01, spec.level * (o.level == null ? 1 : o.level));
    var attack = Math.min(2.5, Math.max(0.4, dur * 0.2));
    var release = Math.min(2.5, Math.max(0.6, dur * 0.25));
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(peak, when + attack);
    out.gain.setValueAtTime(peak, Math.max(when + attack, when + dur - release));
    out.gain.linearRampToValueAtTime(0, when + dur);

    if (spec.lfo) {
      var lfo = ctx.createOscillator();
      var depth = ctx.createGain();
      lfo.frequency.value = spec.lfo[0];
      depth.gain.value = spec.lfo[1];
      lfo.connect(depth); depth.connect(lp.frequency);
      lfo.start(when); lfo.stop(when + dur + 0.1);
    }

    if (spec.events) {
      for (var i = 0; i < spec.events; i++) {
        var at = when + 0.3 + rng.float() * Math.max(0.1, dur - 0.6);
        var g = ctx.createGain();
        var bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 1200 + rng.float() * 3600;
        bp.Q.value = 2 + rng.float() * 4;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(peak * (0.5 + rng.float() * 0.8), at + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, at + spec.decay + rng.float() * 0.12);
        var tickSrc = ctx.createBufferSource();
        tickSrc.buffer = o.noise || A.synth.noiseBuffer(ctx, 0.2);
        tickSrc.connect(bp); bp.connect(g); g.connect(out);
        tickSrc.start(at); tickSrc.stop(at + 0.3);
      }
    }

    src.start(when);
    src.stop(when + dur + 0.2);
    return out;
  };

  return A;
}));
