// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import type { SongSection, Take } from '../types';
import {
  resolveSectionTimings,
  findVocalAtTime,
  distributeLines,
  pickActiveLine,
  matchPhraseToWrittenLine,
  resolveActiveWorkspaceLine,
  insertSectionNonDestructive,
  deleteSectionNonDestructive,
  reorderSectionsNonDestructive,
  moveSectionBoundary,
  applyReanalyzedArrangement,
} from '../utils/timeline';
import {
  normalizeSections,
  barIndexToSec,
  snapTimeToDownbeat,
  getMinSectionSec,
  buildLocalEnergyArrangement,
} from '../utils/arrangement';
import { sanitizeSyncSettings, DEFAULT_SYNC_SETTINGS } from '../utils/settings';

const take = (over: Partial<Take> = {}): Take => ({
  id: 't1', duration: 10, waveform: [], audioUrl: 'blob:x', startBeatOffsetSec: 30, ...over,
});
const section = (id: string, takes: Take[] = [], extra: Partial<SongSection> = {}): SongSection => ({
  id, type: 'verse', repetitions: 1, isLooping: false, text: '', placeholder: '', voiceNotes: takes, ...extra,
});

test('sections without explicit times split the duration evenly', () => {
  const t = resolveSectionTimings([section('a'), section('b')], 100);
  assert.deepEqual(t.map(x => [x.start, x.end]), [[0, 50], [50, 100]]);
});

test('explicit section times are kept', () => {
  const t = resolveSectionTimings([section('a', [], { startTimeSec: 5, endTimeSec: 20 })], 100);
  assert.deepEqual([t[0].start, t[0].end], [5, 20]);
});

test('a take plays where it was recorded even after its section is re-timed', () => {
  // Recorded at 30s; the section was later moved to 0-20s.
  const secs = [section('a', [take()], { startTimeSec: 0, endTimeSec: 20 })];
  const timings = resolveSectionTimings(secs, 100);
  assert.equal(findVocalAtTime(secs, timings, {}, 10), null);
  const hit = findVocalAtTime(secs, timings, {}, 35);
  assert.ok(hit);
  assert.equal(hit!.offsetSec, 5);
});

test('no vocal before the anchor or after the take ends', () => {
  const secs = [section('a', [take()])];
  const timings = resolveSectionTimings(secs, 100);
  assert.equal(findVocalAtTime(secs, timings, {}, 29.9), null);
  assert.equal(findVocalAtTime(secs, timings, {}, 40), null);
  assert.ok(findVocalAtTime(secs, timings, {}, 39.9));
});

test('selected take index is honoured', () => {
  const secs = [section('a', [take({ id: 'one' }), take({ id: 'two' })])];
  const timings = resolveSectionTimings(secs, 100);
  assert.equal(findVocalAtTime(secs, timings, { a: 1 }, 31)!.take.id, 'two');
});

test('takes with no audio are skipped', () => {
  const secs = [section('a', [take({ audioUrl: undefined })])];
  assert.equal(findVocalAtTime(secs, resolveSectionTimings(secs, 100), {}, 31), null);
});

test('untimed lines are spread over the window in order and fill it exactly', () => {
  const lines = distributeLines(['one two', 'three four five six', ''], 10, 30, 'x');
  assert.equal(lines.length, 2);
  assert.equal(lines[0].startSec, 10);
  assert.ok(Math.abs(lines[1].endSec - 30) < 1e-9);
  assert.ok(lines[0].endSec - lines[0].startSec < lines[1].endSec - lines[1].startSec, 'longer line gets more time');
  assert.equal(lines[0].endSec, lines[1].startSec);
});

const timed = [
  { id: '0', text: 'a', startSec: 2, endSec: 4 },
  { id: '1', text: 'b', startSec: 6, endSec: 8 },
];

test('no line is active before the first one starts', () => {
  assert.equal(pickActiveLine(timed, 1, 0), -1);
});

test('a line stays active through the gap until the next starts', () => {
  assert.equal(pickActiveLine(timed, 5, 0), 0);
  assert.equal(pickActiveLine(timed, 6, 0), 1);
  assert.equal(pickActiveLine(timed, 99, 0), 1);
});

test('negative offset fires lines earlier, positive later', () => {
  assert.equal(pickActiveLine(timed, 5.8, 0), 0);
  assert.equal(pickActiveLine(timed, 5.8, -300), 1);
  assert.equal(pickActiveLine(timed, 6.2, 500), 0);
});

test('normalizeSections makes a contiguous arrangement covering the whole track', () => {
  const out = normalizeSections([
    { type: 'Chorus', title: 'C', startTimeSec: 40, endTimeSec: 70 },
    { type: 'intro', title: 'I', startTimeSec: 0, endTimeSec: 10 },
    { type: 'verse', title: 'V', startTimeSec: 12, endTimeSec: 38 }, // gap 10-12
  ], 90);
  assert.deepEqual(out.map(s => s.type), ['intro', 'verse', 'chorus']);
  assert.equal(out[0].startTimeSec, 0);
  for (let i = 1; i < out.length; i++) assert.equal(out[i].startTimeSec, out[i - 1].endTimeSec);
  assert.equal(out[out.length - 1].endTimeSec, 90);
});

test('normalizeSections drops sections beyond the track and fixes unknown types', () => {
  const out = normalizeSections([
    { type: 'drop', startTimeSec: 0, endTimeSec: 30 },
    { type: 'verse', startTimeSec: 500, endTimeSec: 600 },
  ], 60);
  assert.equal(out.length, 1);
  assert.equal(out[0].type, 'verse');
  assert.equal(out[0].endTimeSec, 60);
});

test('normalizeSections returns [] rather than inventing structure', () => {
  assert.deepEqual(normalizeSections(undefined, 60), []);
  assert.deepEqual(normalizeSections([], 60), []);
  assert.deepEqual(normalizeSections([{ type: 'verse' }], 0), []);
});

test('settings are clamped and garbage falls back to defaults', () => {
  const s = sanitizeSyncSettings({ lyricOffsetMs: 99999, beatVolume: -3, vocalVolume: 'loud', recordingLatencyMs: 9000, headphones: 'yes' });
  assert.equal(s.lyricOffsetMs, 1000);
  assert.equal(s.beatVolume, 0);
  assert.equal(s.vocalVolume, DEFAULT_SYNC_SETTINGS.vocalVolume);
  assert.equal(s.recordingLatencyMs, 500);
  assert.equal(s.headphones, DEFAULT_SYNC_SETTINGS.headphones);
  assert.deepEqual(sanitizeSyncSettings(null), DEFAULT_SYNC_SETTINGS);
  assert.equal(sanitizeSyncSettings({ recordingLatencyMs: null }).recordingLatencyMs, null);
});

test('resolveActiveWorkspaceLine tracks untimed written lines across sections and skips blank lines', () => {
  const secs = [
    section('s1', [], { text: 'First line here\n\nSecond line here' }),
    section('s2', [], { text: 'Chorus line one\nChorus line two' }),
  ];
  const timings = resolveSectionTimings(secs, 40);

  const atStart = resolveActiveWorkspaceLine(secs, timings, {}, 1, 0);
  assert.deepEqual(atStart, { sectionId: 's1', lineIndex: 0 });

  // Blank line at index 1 should be skipped; second half of s1 points to raw line index 2.
  const midS1 = resolveActiveWorkspaceLine(secs, timings, {}, 15, 0);
  assert.deepEqual(midS1, { sectionId: 's1', lineIndex: 2 });

  const inS2 = resolveActiveWorkspaceLine(secs, timings, {}, 35, 0);
  assert.deepEqual(inS2, { sectionId: 's2', lineIndex: 1 });
});

test('resolveActiveWorkspaceLine uses take sttData and maps repeated lines in order', () => {
  const phrases = [
    { text: 'We rise again', startSec: 10, endSec: 13 },
    { text: 'Through the night', startSec: 14, endSec: 17 },
    { text: 'We rise again', startSec: 18, endSec: 21 },
  ];
  const secs = [
    section('s1', [take({ startBeatOffsetSec: 10, duration: 12, sttData: phrases })], {
      startTimeSec: 10,
      endTimeSec: 25,
      text: 'We rise again\nThrough the night\nWe rise again',
    }),
  ];
  const timings = resolveSectionTimings(secs, 25);

  assert.deepEqual(resolveActiveWorkspaceLine(secs, timings, {}, 11, 0), { sectionId: 's1', lineIndex: 0 });
  assert.deepEqual(resolveActiveWorkspaceLine(secs, timings, {}, 15, 0), { sectionId: 's1', lineIndex: 1 });
  assert.deepEqual(resolveActiveWorkspaceLine(secs, timings, {}, 19, 0), { sectionId: 's1', lineIndex: 2 });
});

test('matchPhraseToWrittenLine interpolates unmatched ad-libs and handles empty sections', () => {
  const phrases = [
    { text: 'Line one', startSec: 0, endSec: 2 },
    { text: 'yeah uh', startSec: 2, endSec: 3 },
    { text: 'Line three', startSec: 3, endSec: 5 },
  ];
  const raw = ['Line one', 'Line two', 'Line three'];
  assert.equal(matchPhraseToWrittenLine(phrases, 1, raw), 1);
  assert.equal(matchPhraseToWrittenLine(phrases, 0, ['   ', '']), null);
});

test('barIndexToSec computes direct multiplication without drift and snaps magnetically within tolerance', () => {
  // 120 BPM => 2.0s per bar, origin 0.05s
  const grid = { bpm: 120, gridOriginSec: 0.05, confidence: 0.9 };
  assert.equal(barIndexToSec(4, grid), 8.05);
  assert.equal(snapTimeToDownbeat(8.2, grid), 8.05);
  // Outside tolerance (0.7s away from both 8.05 and 10.05) stays off-grid
  assert.equal(snapTimeToDownbeat(9.05, grid, { maxSnapDeltaSec: 0.4 }), 9.05);
  // Disabled snap returns unclamped raw rounded to ms
  assert.equal(snapTimeToDownbeat(8.2345, grid, { enabled: false }), 8.235);
});

test('normalizeSections snaps only interior boundaries when BPM confidence is reliable and drops collapsed duplicates', () => {
  const grid = { bpm: 120, gridOriginSec: 0, confidence: 0.85 };
  const out = normalizeSections(
    [
      { type: 'intro', title: 'Intro', startTimeSec: 0, endTimeSec: 8.18 },
      { type: 'verse', title: 'Verse', startTimeSec: 8.18, endTimeSec: 23.85 },
      { type: 'chorus', title: 'Chorus', startTimeSec: 23.85, endTimeSec: 40 },
    ],
    40.123,
    { grid, snapToGrid: true }
  );
  assert.equal(out[0].startTimeSec, 0);
  assert.equal(out[0].endTimeSec, 8);
  assert.equal(out[1].startTimeSec, 8);
  assert.equal(out[1].endTimeSec, 24);
  assert.equal(out[2].startTimeSec, 24);
  assert.equal(out[2].endTimeSec, 40.123);
});

test('160 BPM 2-bar pre-chorus (3.0s) does not collapse when moving boundaries', () => {
  const grid = { bpm: 160, gridOriginSec: 0, confidence: 0.9 }; // 1 bar = 1.5s
  assert.equal(getMinSectionSec(grid), 1.5);
  const secs = [
    section('s1', [], { startTimeSec: 0, endTimeSec: 6 }),
    section('s2', [], { startTimeSec: 6, endTimeSec: 9 }), // 2-bar pre-chorus
  ];
  const moved = moveSectionBoundary(secs, 1, 8.9, 9, grid, true);
  assert.ok(moved[1].endTimeSec! - moved[1].startTimeSec! >= 1.5);
  assert.equal(moved[0].endTimeSec, moved[1].startTimeSec);
  assert.equal(moved[0].isUserModified, true);
  assert.equal(moved[1].isUserModified, true);
});

test('insertSectionNonDestructive splits only the target section and leaves other sections intact', () => {
  const secs = [
    section('s1', [], { startTimeSec: 0, endTimeSec: 10 }),
    section('s2', [], { startTimeSec: 10, endTimeSec: 30 }),
    section('s3', [], { startTimeSec: 30, endTimeSec: 60 }),
  ];
  const out = insertSectionNonDestructive(secs, 1, section('sNew'), 60, null, false);
  assert.equal(out.length, 4);
  assert.deepEqual(
    out.map(s => [s.id, s.startTimeSec, s.endTimeSec]),
    [
      ['s1', 0, 10],
      ['s2', 10, 20],
      ['sNew', 20, 30],
      ['s3', 30, 60],
    ]
  );
  assert.equal(out[0].isUserModified, undefined);
  assert.equal(out[3].isUserModified, undefined);
});

test('deleteSectionNonDestructive merges into previous neighbor or next when deleting index 0', () => {
  const secs = [
    section('s1', [], { startTimeSec: 0, endTimeSec: 10 }),
    section('s2', [], { startTimeSec: 10, endTimeSec: 25 }),
    section('s3', [], { startTimeSec: 25, endTimeSec: 60 }),
  ];
  const delMid = deleteSectionNonDestructive(secs, 1, 60, section('blank'));
  assert.deepEqual(
    delMid.map(s => [s.id, s.startTimeSec, s.endTimeSec]),
    [
      ['s1', 0, 25],
      ['s3', 25, 60],
    ]
  );
  const delFirst = deleteSectionNonDestructive(secs, 0, 60, section('blank'));
  assert.deepEqual(
    delFirst.map(s => [s.id, s.startTimeSec, s.endTimeSec]),
    [
      ['s2', 0, 25],
      ['s3', 25, 60],
    ]
  );
});

test('reorderSectionsNonDestructive preserves each section duration and materializes take anchors', () => {
  const legacyTake = take({ id: 'legacy', startBeatOffsetSec: undefined });
  const secs = [
    section('s1', [], { startTimeSec: 0, endTimeSec: 10 }),
    section('s2', [legacyTake], { startTimeSec: 10, endTimeSec: 40 }),
  ];
  const reordered = reorderSectionsNonDestructive([secs[1], secs[0]], secs, 40);
  assert.deepEqual(
    reordered.map(s => [s.id, s.startTimeSec, s.endTimeSec]),
    [
      ['s2', 0, 30],
      ['s1', 30, 40],
    ]
  );
  // Legacy take was anchored at s2's original start (10s), never shifted to 0s!
  assert.equal(reordered[0].voiceNotes[0].startBeatOffsetSec, 10);
});

test('applyReanalyzedArrangement preserves vocal take anchors and remaps activeTakeIndices in both modes', () => {
  const t1 = take({ id: 'v1', startBeatOffsetSec: 14.5 });
  const t2 = take({ id: 'v2', startBeatOffsetSec: 15.0 });
  const secs = [
    section('s1', [t1, t2], { startTimeSec: 0, endTimeSec: 30, text: 'Keep my lyrics' }),
  ];
  const timings = resolveSectionTimings(secs, 60);
  const freshAi = [
    { type: 'intro' as const, title: 'Intro', startTimeSec: 0, endTimeSec: 10 },
    { type: 'verse' as const, title: 'Verse', startTimeSec: 10, endTimeSec: 40 },
    { type: 'chorus' as const, title: 'Chorus', startTimeSec: 40, endTimeSec: 60 },
  ];

  // User had selected the 2nd take (v2, index 1) on s1 before re-analysis.
  const markersOnly = applyReanalyzedArrangement(secs, timings, freshAi, 'markers-only', { s1: 1 });
  assert.equal(markersOnly.sections[0].text, 'Keep my lyrics');
  assert.equal(markersOnly.sections[1].voiceNotes[0].id, 'v1');
  assert.equal(markersOnly.sections[1].voiceNotes[1].id, 'v2');
  assert.equal(markersOnly.sections[1].voiceNotes[0].startBeatOffsetSec, 14.5);
  assert.equal(markersOnly.activeTakeIndices[markersOnly.sections[1].id], 1);

  const replaced = applyReanalyzedArrangement(secs, timings, freshAi, 'replace-layout', { s1: 1 });
  assert.equal(replaced.sections[0].text, '');
  assert.equal(replaced.sections[1].voiceNotes[0].id, 'v1');
  assert.equal(replaced.sections[1].voiceNotes[1].id, 'v2');
  assert.equal(replaced.sections[1].voiceNotes[1].startBeatOffsetSec, 15.0);
  assert.equal(replaced.activeTakeIndices[replaced.sections[1].id], 1);
});

test('buildLocalEnergyArrangement creates bar-snapped labeled sections from energy contrasts', () => {
  // 120 BPM => 2.0s per bar; 160s track (80 bars).
  // Curve: Intro (0-16s low), Verse 1 (16-48s med), Chorus (48-80s high), Verse 2 (80-112s med), Chorus 2 (112-144s high), Outro (144-160s low)
  const bins = 160;
  const curve = Array.from({ length: bins }, (_, i) => {
    if (i < 16) return 0.25;
    if (i < 48) return 0.52;
    if (i < 80) return 0.92;
    if (i < 112) return 0.54;
    if (i < 144) return 0.9;
    return 0.22;
  });

  const grid = { bpm: 120, gridOriginSec: 0, confidence: 0.9 };
  const arrangement = buildLocalEnergyArrangement(curve, 160, grid);
  assert.equal(arrangement.source, 'local-energy');
  assert.ok(arrangement.sections.length >= 4 && arrangement.sections.length <= 7);
  assert.equal(arrangement.sections[0].startTimeSec, 0);
  assert.equal(arrangement.sections[arrangement.sections.length - 1].endTimeSec, 160);
  assert.equal(arrangement.sections[0].type, 'intro');
  assert.equal(arrangement.sections[arrangement.sections.length - 1].type, 'outro');
  assert.ok(arrangement.sections.some(s => s.type === 'chorus'));
  assert.ok(arrangement.sections.some(s => s.type === 'verse'));

  // Every interior boundary snaps cleanly to a 2.0s bar downbeat (with 0ms float noise)
  for (let i = 1; i < arrangement.sections.length; i++) {
    assert.equal(arrangement.sections[i].startTimeSec, arrangement.sections[i - 1].endTimeSec);
    assert.ok(Math.abs((arrangement.sections[i].startTimeSec % 2)) < 1e-6);
  }
});

test('buildLocalEnergyArrangement still produces useful bar-snapped sections for flat-loudness beats', () => {
  const flatCurve = Array.from({ length: 120 }, () => 0.75);
  const grid = { bpm: 120, gridOriginSec: 0.1, confidence: 0.85 };
  const arrangement = buildLocalEnergyArrangement(flatCurve, 128.1, grid);

  assert.equal(arrangement.source, 'local-energy');
  assert.ok(arrangement.sections.length >= 4);
  assert.equal(arrangement.sections[0].startTimeSec, 0);
  assert.equal(arrangement.sections[arrangement.sections.length - 1].endTimeSec, 128.1);
  assert.ok(arrangement.sections.some(s => s.type === 'chorus'));
  for (let i = 1; i < arrangement.sections.length; i++) {
    assert.equal(arrangement.sections[i].startTimeSec, arrangement.sections[i - 1].endTimeSec);
  }
});
