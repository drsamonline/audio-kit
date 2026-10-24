/* Tests for audio-kit. Run: node test-node.js */
"use strict";
var A = require("./audio-kit.js");
var M = A.music;
var pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log("PASS  " + name); } else { fail++; console.log("FAIL  " + name); } }
function near(a, b, t) { return Math.abs(a - b) <= (t || 1e-9); }

/* ---- theory: notes, intervals, transposition ---- */
ok("note: C4 is midi 60", M.parse("C4").midi === 60);
ok("note: A4 is midi 69 at 440 Hz", M.parse("A4").midi === 69 && near(M.parse("A4").freq, 440, 1e-9));
ok("note: C4 is ~261.63 Hz", near(M.parse("C4").freq, 261.6256, 1e-3));
ok("note: accidentals parse", M.parse("C#4").midi === 61 && M.parse("Bb3").midi === 58);
ok("note: name round-trips", M.name(61) === "C#4" && M.name(60) === "C4");
ok("interval: C4 -> G4 is 7 semitones", M.interval("C4", "G4") === 7);
ok("transpose: C4 up 12 is C5", M.transpose("C4", 12) === 72);

/* ---- theory: scales and chords ---- */
ok("scale: C major", M.scale("C4", "major").join() === [60, 62, 64, 65, 67, 69, 71].join());
ok("scale: A natural minor", M.scale("A4", "naturalMinor").join() === [69, 71, 72, 74, 76, 77, 79].join());
ok("scale: C minor pentatonic", M.scale("C4", "minorPentatonic").join() === [60, 63, 65, 67, 70].join());
ok("chord: C major is root, major third, fifth", M.chord("C4", "major").join() === [60, 64, 67].join());
ok("chord: A minor", M.chord("A4", "minor").join() === [69, 72, 76].join());
ok("chord: Cmaj7", M.chord("C4", "maj7").join() === [60, 64, 67, 71].join());
ok("chord: G7", M.chord("G4", "dom7").join() === [67, 71, 74, 77].join());

/* ---- ADSR envelope shape ---- */
var env = { a: 0.1, d: 0.2, s: 0.5, r: 0.3 };
ok("adsr: starts at 0", A.synth.adsr(env, 0, 1) === 0);
ok("adsr: rises through the attack", near(A.synth.adsr(env, 0.05, 1), 0.5));
ok("adsr: peaks at 1 at the end of the attack", A.synth.adsr(env, 0.1, 1) === 1);
ok("adsr: decays to the sustain level", near(A.synth.adsr(env, 0.3, 1), 0.5));
ok("adsr: holds the sustain level", near(A.synth.adsr(env, 0.6, 1), 0.5));
ok("adsr: releases after the note is held", near(A.synth.adsr(env, 1.15, 1), 0.25));
ok("adsr: reaches 0 at the end of the release", A.synth.adsr(env, 1.4, 1) === 0);
(function () {
  var peak = -Infinity, lo = Infinity;
  for (var t = 0; t <= 2; t += 0.01) { var v = A.synth.adsr(env, t, 1); peak = Math.max(peak, v); lo = Math.min(lo, v); }
  ok("adsr: the envelope stays in [0,1] and peaks at 1", peak > 0.999 && peak <= 1 && lo === 0);
})();

/* ---- sequencer scheduling ---- */
var pat = A.seq.pattern([
  ["C4", null, null, null],
  [null, null, null, "E4"],
  ["G4", null, null, null]
], { bpm: 120, rowsPerBeat: 4 });
var ev = A.seq.events(pat);
ok("seq: every note becomes an event", ev.length === 3);
ok("seq: row 0 lands on beat 0", ev[0].row === 0 && ev[0].beat === 0 && ev[0].time === 0);
ok("seq: row 1 lands on beat 0.25", near(ev[1].beat, 0.25) && near(ev[1].time, 0.125));
ok("seq: row 2 lands on beat 0.5", near(ev[2].beat, 0.5) && near(ev[2].time, 0.25));
ok("seq: notes carry their pitch", ev[0].midi === 60 && ev[2].midi === 67);
var pat2 = A.seq.pattern([["C4", "E4", "G4"]], { bpm: 60, rowsPerBeat: 2 });
var ev2 = A.seq.events(pat2);
ok("seq: channels are independent", ev2.length === 3 && ev2[0].channel === 0 && ev2[2].channel === 2);
ok("seq: bpm changes the timing (60 bpm = 1s a beat)", near(ev2[0].time, 0) && ev2.every(function (e) { return e.time === 0; }));

/* ---- notation layout ---- */
var lay = A.notation.layout(["C4", "D4", "E4"]);
ok("notation: notes advance across the staff", lay.notes[0].x === 0 && lay.notes[1].x === 20 && lay.notes[2].x === 40);
ok("notation: ascending pitch ascends the staff", lay.notes[0].step < lay.notes[1].step && lay.notes[1].step < lay.notes[2].step);
ok("notation: the middle line of the treble clef is B4", A.notation.layout(["B4"]).notes[0].step === 0);
ok("notation: the bass clef re-references to D3", A.notation.layout(["D3"], { clef: "bass" }).notes[0].step === 0);
ok("notation: width is the notes times the spacing", lay.width === 60);

/* ---- sonification ---- */
var son = A.sonify([0, 255]);
ok("sonify: byte 0 is the base pitch", son[0].midi === 57);
ok("sonify: byte 255 is the top of the range", son[1].midi === 57 + 36);
ok("sonify: events are spaced in time", son[1].time > son[0].time);

/* ---- mastering helpers ---- */
ok("master: rms of a full-scale square is 0.5", near(A.master.rms([0.5, -0.5, 0.5, -0.5]), 0.5));
ok("master: peak finds the loudest sample", A.master.peak([0.1, -0.7, 0.3]) === 0.7);
ok("master: matchGain raises a quiet track to the reference", near(A.master.matchGain([0.5, -0.5], [1, -1]), 2));
ok("master: the limiter clamps peaks", (function () { var o = A.master.limit([2, -2], 0.98); return near(o[0], 0.98, 1e-6) && near(o[1], -0.98, 1e-6); })());
ok("master: the limiter leaves in-range samples alone", A.master.limit([0.5], 0.98)[0] === 0.5);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
