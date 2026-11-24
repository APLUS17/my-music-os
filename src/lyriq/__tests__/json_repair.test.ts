// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseJsonResponse, salvageSectionsFromText, extractBpmFromText } from '../utils/jsonRepair';

interface ParsedBeatShape {
  estimatedBpm: number;
  sections: Array<{ type: string }>;
}

test('parses clean valid JSON correctly', () => {
  const input = JSON.stringify({ estimatedBpm: 120, sections: [{ type: 'intro', startTimeSec: 0, endTimeSec: 10 }] });
  const parsed = parseJsonResponse<ParsedBeatShape>(input);
  assert.equal(parsed.estimatedBpm, 120);
  assert.equal(parsed.sections.length, 1);
});

test('repairs missing comma between consecutive array elements (error reproduction)', () => {
  const badJson = `{
  "estimatedBpm": 128,
  "sections": [
    {
      "type": "intro",
      "title": "Intro",
      "startTimeSec": 0,
      "endTimeSec": 15,
      "energy": "low"
    }
    {
      "type": "verse",
      "title": "Verse 1",
      "startTimeSec": 15,
      "endTimeSec": 45,
      "energy": "medium"
    }
  ]
}`;
  const parsed = parseJsonResponse<ParsedBeatShape>(badJson);
  assert.equal(parsed.estimatedBpm, 128);
  assert.equal(parsed.sections.length, 2);
  assert.equal(parsed.sections[0].type, 'intro');
  assert.equal(parsed.sections[1].type, 'verse');
});

test('repairs trailing commas and markdown code blocks', () => {
  const input = '```json\n{\n  "estimatedBpm": 95,\n  "sections": [\n    {"type": "hook", "startTimeSec": 0, "endTimeSec": 16,},\n  ],\n}\n```';
  const parsed = parseJsonResponse<ParsedBeatShape>(input);
  assert.equal(parsed.estimatedBpm, 95);
  assert.equal(parsed.sections.length, 1);
  assert.equal(parsed.sections[0].type, 'hook');
});

test('salvages sections and BPM from fragmented text', () => {
  const raw = `
Here is what we analyzed:
{"type": "intro", "title": "Intro", "startTimeSec": 0, "endTimeSec": 20}
{"type": "chorus", "title": "Main Chorus", "startTimeSec": 20, "endTimeSec": 50}
Track tempo estimated at 116 BPM.
`;
  const sections = salvageSectionsFromText(raw);
  const bpm = extractBpmFromText(raw);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].type, 'intro');
  assert.equal(sections[1].type, 'chorus');
  assert.equal(bpm, 116);
});
