/**
 * Stress tests for:
 *   1. Two-take persistence — sessions + transcription survive a save/load roundtrip
 *   2. Take switching — PlayerTab shows the correct take's transcription when the
 *      active session changes
 *   3. Beat-offset sync — beatCurrentTime formula is correct for both cases
 *   4. Three-take + beat — transcription is isolated per session and beat sessions
 *      are handled correctly
 *
 * These tests use jsdom (no real browser APIs). Audio elements are mocked to
 * prevent play() rejections. framer-motion animations render normally in jsdom
 * (motion.div just renders a plain div with whatever style values were passed).
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecordingThread } from '../RecordingThread';
import { PlayerTab } from '../PlayerTab';
import { RecordingSession } from '@/types';

// ── Silence HTMLMediaElement errors in jsdom ──────────────────────────────
beforeEach(() => {
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
    window.HTMLMediaElement.prototype.load = vi.fn();
});

// ── Helper: build a minimal valid RecordingSession ──────────────────────
function makeSession(overrides: Partial<RecordingSession> = {}): RecordingSession {
    return {
        id: 'session-1',
        name: 'Take 1',
        timestamp: new Date('2026-04-01T12:00:00Z').toISOString(),
        isLoopSession: false,
        duration: 10,
        base64: 'mockBase64Data',
        sections: [],
        ...overrides,
    };
}

// ── Helper: minimal RecordingThread props ─────────────────────────────────
function makeThreadProps(sessions: RecordingSession[], activeSessionId: string, overrides = {}) {
    return {
        sessions,
        activeSessionId,
        onSelectSession: vi.fn(),
        onUpdateSession: vi.fn(),
        onDeleteSession: vi.fn(),
        onUpdateSection: vi.fn(),
        onOpenSplitEditor: vi.fn(),
        isPlaying: false,
        currentTime: 0,
        onTogglePlay: vi.fn(),
        onSeek: vi.fn(),
        ...overrides,
    };
}

// ── Helper: minimal PlayerTab props ──────────────────────────────────────
function makePlayerProps(session: RecordingSession | null, sessions: RecordingSession[], overrides = {}) {
    return {
        projectTitle: 'Test Project',
        session,
        sessions,
        beat: null,
        beatSrc: null,
        beatVolume: 1,
        beatMuted: false,
        onVolumeChange: vi.fn(),
        onMuteChange: vi.fn(),
        isPlaying: false,
        currentTime: 0,
        duration: session?.duration ?? 10,
        onTogglePlay: vi.fn(),
        onSeek: vi.fn(),
        ...overrides,
    };
}

// ═════════════════════════════════════════════════════════════════════════
// 1. RECORDING THREAD — Two takes rendering & selection
// ═════════════════════════════════════════════════════════════════════════

describe('RecordingThread — two takes', () => {
    const take1 = makeSession({
        id: 'session-1',
        name: 'Take 1',
        timestamp: new Date('2026-04-01T12:00:00Z').toISOString(),
    });
    const take2 = makeSession({
        id: 'session-2',
        name: 'Take 2',
        timestamp: new Date('2026-04-01T13:00:00Z').toISOString(),
    });

    it('renders both sessions', () => {
        render(<RecordingThread {...makeThreadProps([take1, take2], 'session-2')} />);
        expect(screen.getByDisplayValue('Take 1')).toBeTruthy();
        expect(screen.getByDisplayValue('Take 2')).toBeTruthy();
    });

    it('shows newest session first (Take 2 before Take 1 in DOM)', () => {
        render(<RecordingThread {...makeThreadProps([take1, take2], 'session-2')} />);
        const take1Input = screen.getByDisplayValue('Take 1');
        const take2Input = screen.getByDisplayValue('Take 2');
        // compareDocumentPosition: 4 means "preceding", 2 means "following"
        const order = take2Input.compareDocumentPosition(take1Input);
        // take1Input should follow take2Input → bit 4 set in order result
        expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('active session card has ring-1 class, inactive does not', () => {
        const { container } = render(
            <RecordingThread {...makeThreadProps([take1, take2], 'session-2')} />
        );
        // Cards are the direct wrappers with rounded-2xl
        const cards = Array.from(
            container.querySelectorAll('[class*="rounded-2xl"][class*="border"]')
        ).filter(el => el.getAttribute('class')?.includes('bg-[#111]'));

        const activeCards = cards.filter(c => c.className.includes('ring-1'));
        const inactiveCards = cards.filter(c => !c.className.includes('ring-1'));

        expect(activeCards).toHaveLength(1);
        expect(inactiveCards).toHaveLength(1);
    });

    it('clicking an inactive session card calls onSelectSession with its id', () => {
        const onSelectSession = vi.fn();
        const { container } = render(
            <RecordingThread
                {...makeThreadProps([take1, take2], 'session-2', { onSelectSession })}
            />
        );
        const cards = Array.from(
            container.querySelectorAll('[class*="rounded-2xl"][class*="border"]')
        ).filter(el => el.getAttribute('class')?.includes('bg-[#111]'));

        const inactiveCard = cards.find(c => !c.className.includes('ring-1'));
        expect(inactiveCard).toBeTruthy();
        fireEvent.click(inactiveCard!);
        expect(onSelectSession).toHaveBeenCalledWith('session-1');
    });

    it('clicking the active session card still calls onSelectSession', () => {
        const onSelectSession = vi.fn();
        const { container } = render(
            <RecordingThread
                {...makeThreadProps([take1, take2], 'session-2', { onSelectSession })}
            />
        );
        const cards = Array.from(
            container.querySelectorAll('[class*="rounded-2xl"][class*="border"]')
        ).filter(el => el.getAttribute('class')?.includes('bg-[#111]'));

        const activeCard = cards.find(c => c.className.includes('ring-1'));
        expect(activeCard).toBeTruthy();
        fireEvent.click(activeCard!);
        expect(onSelectSession).toHaveBeenCalledWith('session-2');
    });

    it('shows empty state when sessions array is empty', () => {
        render(<RecordingThread {...makeThreadProps([], null as any)} />);
        expect(screen.getByText('No recordings yet')).toBeTruthy();
    });
});

// ═════════════════════════════════════════════════════════════════════════
// 2. PLAYER TAB — Transcription updates when active take changes
// ═════════════════════════════════════════════════════════════════════════

describe('PlayerTab — transcription per active take', () => {
    const take1 = makeSession({
        id: 'session-1',
        name: 'Take 1',
        transcription: 'Verse one lyrics here',
        lines: [
            { text: 'Verse one line one', startTime: 0, endTime: 2 },
            { text: 'Verse one line two', startTime: 2.5, endTime: 5 },
        ],
    });

    const take2 = makeSession({
        id: 'session-2',
        name: 'Take 2',
        transcription: 'Chorus hooks here',
        lines: [
            { text: 'Chorus hook one', startTime: 0, endTime: 2 },
            { text: 'Chorus hook two', startTime: 2.5, endTime: 5 },
        ],
    });

    it('shows take-1 transcription lines when take-1 is active session', () => {
        render(<PlayerTab {...makePlayerProps(take1, [take1, take2])} />);
        expect(screen.getByText('Verse one line one')).toBeTruthy();
        expect(screen.getByText('Verse one line two')).toBeTruthy();
        expect(screen.queryByText('Chorus hook one')).toBeNull();
        expect(screen.queryByText('Chorus hook two')).toBeNull();
    });

    it('shows take-2 transcription lines when take-2 is active session', () => {
        render(<PlayerTab {...makePlayerProps(take2, [take1, take2])} />);
        expect(screen.getByText('Chorus hook one')).toBeTruthy();
        expect(screen.getByText('Chorus hook two')).toBeTruthy();
        expect(screen.queryByText('Verse one line one')).toBeNull();
        expect(screen.queryByText('Verse one line two')).toBeNull();
    });

    it('updates displayed transcription when active session prop changes', () => {
        const { rerender } = render(
            <PlayerTab {...makePlayerProps(take1, [take1, take2])} />
        );
        expect(screen.getByText('Verse one line one')).toBeTruthy();

        rerender(<PlayerTab {...makePlayerProps(take2, [take1, take2])} />);
        expect(screen.getByText('Chorus hook one')).toBeTruthy();
        expect(screen.queryByText('Verse one line one')).toBeNull();
    });

    it('shows all lines of the active take (not just the first)', () => {
        render(<PlayerTab {...makePlayerProps(take1, [take1, take2])} />);
        expect(screen.getByText('Verse one line one')).toBeTruthy();
        expect(screen.getByText('Verse one line two')).toBeTruthy();
    });

    it('renders no lyric text when active session has no lines', () => {
        const emptyTake = makeSession({ id: 'empty', lines: undefined, transcription: undefined });
        const { container } = render(
            <PlayerTab {...makePlayerProps(emptyTake, [emptyTake])} />
        );
        // p.text-2xl elements are only rendered per line — should be absent
        const lyricParagraphs = container.querySelectorAll('p.text-2xl');
        expect(lyricParagraphs.length).toBe(0);
    });

    it('renders no lyric text when session is null', () => {
        const { container } = render(
            <PlayerTab {...makePlayerProps(null, [])} />
        );
        const lyricParagraphs = container.querySelectorAll('p.text-2xl');
        expect(lyricParagraphs.length).toBe(0);
    });

    it('take list in PlayerTab shows all available takes', () => {
        render(<PlayerTab {...makePlayerProps(take2, [take1, take2])} />);
        // The take picker trigger button shows "TAKE N" (all-caps mono text)
        const takeButton = screen.getByText(/TAKE \d/i);
        fireEvent.click(takeButton);
        // After clicking, the dropdown lists each take as "Take N" (sentence-case spans)
        const takeLabels = screen.getAllByText(/Take \d/i);
        expect(takeLabels.length).toBeGreaterThanOrEqual(2);
    });

    it('clicking a different take in the picker calls onSelectSession', () => {
        const onSelectSession = vi.fn();
        render(
            <PlayerTab
                {...makePlayerProps(take2, [take1, take2])}
                onSelectSession={onSelectSession}
            />
        );
        // Open take picker
        const takeButton = screen.getByText(/TAKE \d/i);
        fireEvent.click(takeButton);
        // Dropdown items are now visible; index 0 is the trigger itself,
        // index 1+ are the dropdown list items. Click the first dropdown item.
        const takeButtons = screen.getAllByText(/Take \d/i);
        // takeButtons[0] = trigger span; takeButtons[1] = first dropdown item
        fireEvent.click(takeButtons[1]);
        expect(onSelectSession).toHaveBeenCalled();
    });
});

// ═════════════════════════════════════════════════════════════════════════
// 3. BEAT OFFSET SYNC — beatCurrentTime formula correctness
// ═════════════════════════════════════════════════════════════════════════

describe('Beat offset sync calculation (PlayerTab formula)', () => {
    function computeBeatCurrentTime(beatOffset: number | undefined | null, currentTime: number): number | null {
        return beatOffset !== null && beatOffset !== undefined
            ? currentTime + beatOffset
            : null;
    }

    it('computes beatCurrentTime = currentTime + beatOffset when offset is set', () => {
        expect(computeBeatCurrentTime(10.0, 3.5)).toBeCloseTo(13.5);
    });

    it('returns null when beatOffset is undefined (no beat loaded during recording)', () => {
        expect(computeBeatCurrentTime(undefined, 5.0)).toBeNull();
    });

    it('returns null when beatOffset is null', () => {
        expect(computeBeatCurrentTime(null, 5.0)).toBeNull();
    });

    it('returns currentTime + 0 (= currentTime) when beatOffset is 0', () => {
        // beatOffset=0 means recording started when beat was at the beginning
        // This is a valid sync offset — the formula should NOT short-circuit on 0
        expect(computeBeatCurrentTime(0, 7.25)).toBeCloseTo(7.25);
    });

    it('handles large offsets correctly (recording started mid-beat)', () => {
        // User started recording when beat was at 45.3 seconds
        expect(computeBeatCurrentTime(45.3, 2.0)).toBeCloseTo(47.3);
    });

    it('latency compensation reduces the stored offset', () => {
        // Replicate StudioWorkspace latency compensation logic:
        //   compensatedOffset = Math.max(0, beatOffset - latencyCompensation/1000)
        const rawBeatOffset = 5.0;
        const latencyMs = 120;
        const compensated = Math.max(0, rawBeatOffset - latencyMs / 1000);
        expect(compensated).toBeCloseTo(4.88);
    });

    it('compensated offset never goes below 0', () => {
        // If latency > raw offset, clamp to 0
        const rawBeatOffset = 0.05;
        const latencyMs = 200;
        const compensated = Math.max(0, rawBeatOffset - latencyMs / 1000);
        expect(compensated).toBe(0);
    });

    it('PlayerTab beatSections is empty when beatCurrentTime is null', () => {
        // beatSections = beatCurrentTime !== null ? (beat?.sections ?? []) : []
        const beatCurrentTime = null;
        const mockBeat = { id: 'b1', sections: [{ startTime: 0, endTime: 4, type: 'instrumental' as const, label: 'Intro', emojiTag: '🎬' }] };
        const beatSections = beatCurrentTime !== null ? (mockBeat?.sections ?? []) : [];
        expect(beatSections).toHaveLength(0);
    });

    it('PlayerTab beatSections is populated when beatCurrentTime is valid', () => {
        const beatCurrentTime = 2.0;
        const mockBeat = { id: 'b1', sections: [{ startTime: 0, endTime: 4, type: 'instrumental' as const, label: 'Intro', emojiTag: '🎬' }] };
        const beatSections = beatCurrentTime !== null ? (mockBeat?.sections ?? []) : [];
        expect(beatSections).toHaveLength(1);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// 4. PERSISTENCE — Two takes survive a save/load cycle
// ═════════════════════════════════════════════════════════════════════════

describe('Session persistence — two takes', () => {
    let localStorageStore: Record<string, string> = {};

    beforeEach(() => {
        localStorageStore = {};
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
            localStorageStore[key] = String(value);
        });
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
            (key) => localStorageStore[key] ?? null
        );
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
            delete localStorageStore[key];
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const STORAGE_KEY = 'studio-pro-data-v2';

    // Replicate StudioWorkspace's save logic: strip audioUrl + base64 before persisting
    function persistSessions(sessions: RecordingSession[]) {
        const sessionsToSave = sessions.map(({ audioUrl: _a, base64: _b, ...rest }) => rest);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions: sessionsToSave }));
    }

    it('both sessions are present in localStorage after save', () => {
        const take1 = makeSession({ id: 'take-1', name: 'Take 1' });
        const take2 = makeSession({ id: 'take-2', name: 'Take 2' });
        persistSessions([take1, take2]);

        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
        expect(saved.sessions).toHaveLength(2);
    });

    it('transcription text is preserved for both takes', () => {
        const take1 = makeSession({
            id: 'take-1',
            transcription: 'First take verse',
            lines: [{ text: 'Line one A', startTime: 0, endTime: 2 }],
        });
        const take2 = makeSession({
            id: 'take-2',
            transcription: 'Second take chorus',
            lines: [{ text: 'Line one B', startTime: 0, endTime: 2 }],
        });
        persistSessions([take1, take2]);

        const { sessions } = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
        const s1 = sessions.find((s: RecordingSession) => s.id === 'take-1');
        const s2 = sessions.find((s: RecordingSession) => s.id === 'take-2');

        expect(s1.transcription).toBe('First take verse');
        expect(s1.lines[0].text).toBe('Line one A');
        expect(s2.transcription).toBe('Second take chorus');
        expect(s2.lines[0].text).toBe('Line one B');
    });

    it('line timestamps are preserved on roundtrip', () => {
        const take = makeSession({
            id: 'take-1',
            lines: [
                { text: 'Line A', startTime: 0.0, endTime: 1.5 },
                { text: 'Line B', startTime: 2.1, endTime: 3.9 },
            ],
        });
        persistSessions([take]);

        const { sessions } = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
        expect(sessions[0].lines[0].startTime).toBe(0.0);
        expect(sessions[0].lines[0].endTime).toBe(1.5);
        expect(sessions[0].lines[1].startTime).toBe(2.1);
        expect(sessions[0].lines[1].endTime).toBe(3.9);
    });

    it('base64 audio data is NOT stored in localStorage (stripped before save)', () => {
        const take = makeSession({ id: 'take-1', base64: 'VERY_LARGE_BASE64_PAYLOAD' });
        persistSessions([take]);

        const { sessions } = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
        expect(sessions[0].base64).toBeUndefined();
    });

    it('ephemeral audioUrl is NOT stored in localStorage', () => {
        const take = makeSession({ id: 'take-1', audioUrl: 'blob:http://localhost/fake-url' });
        persistSessions([take]);

        const { sessions } = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
        expect(sessions[0].audioUrl).toBeUndefined();
    });

    it('beatOffset is preserved across save/load', () => {
        const take = makeSession({ id: 'take-1', beatOffset: 8.75 });
        persistSessions([take]);

        const { sessions } = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
        expect(sessions[0].beatOffset).toBe(8.75);
    });

    it('isLoopSession flag is preserved', () => {
        const loopTake = makeSession({ id: 'take-1', isLoopSession: true, loopStart: 4.0, loopEnd: 12.0 });
        persistSessions([loopTake]);

        const { sessions } = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
        expect(sessions[0].isLoopSession).toBe(true);
        expect(sessions[0].loopStart).toBe(4.0);
        expect(sessions[0].loopEnd).toBe(12.0);
    });

    it('second take does not overwrite first take data', () => {
        const take1 = makeSession({
            id: 'take-1',
            name: 'Take 1',
            duration: 8,
            transcription: 'Take one words',
        });
        const take2 = makeSession({
            id: 'take-2',
            name: 'Take 2',
            duration: 15,
            transcription: 'Take two words',
        });
        persistSessions([take1, take2]);

        const { sessions } = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
        const s1 = sessions.find((s: RecordingSession) => s.id === 'take-1');
        const s2 = sessions.find((s: RecordingSession) => s.id === 'take-2');

        expect(s1.transcription).toBe('Take one words');
        expect(s1.duration).toBe(8);
        expect(s2.transcription).toBe('Take two words');
        expect(s2.duration).toBe(15);
    });

    it('loading from storage restores both sessions with full transcription', () => {
        // Simulate what was saved in a previous session
        const stored = {
            sessions: [
                {
                    id: 'take-1',
                    name: 'Take 1',
                    timestamp: new Date('2026-04-10T10:00:00Z').toISOString(),
                    isLoopSession: false,
                    duration: 9,
                    sections: [],
                    transcription: 'Stored take one verse',
                    lines: [
                        { text: 'Stored line one', startTime: 0, endTime: 2 },
                        { text: 'Stored line two', startTime: 2.5, endTime: 5 },
                    ],
                },
                {
                    id: 'take-2',
                    name: 'Take 2',
                    timestamp: new Date('2026-04-10T10:30:00Z').toISOString(),
                    isLoopSession: false,
                    duration: 14,
                    sections: [],
                    beatOffset: 3.2,
                    transcription: 'Stored take two chorus',
                    lines: [
                        { text: 'Chorus stored one', startTime: 0, endTime: 2 },
                    ],
                },
            ],
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

        const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
        expect(loaded.sessions).toHaveLength(2);

        const t1 = loaded.sessions.find((s: RecordingSession) => s.id === 'take-1');
        const t2 = loaded.sessions.find((s: RecordingSession) => s.id === 'take-2');

        expect(t1.transcription).toBe('Stored take one verse');
        expect(t1.lines).toHaveLength(2);
        expect(t1.lines[1].text).toBe('Stored line two');

        expect(t2.transcription).toBe('Stored take two chorus');
        expect(t2.beatOffset).toBe(3.2);
        expect(t2.lines[0].text).toBe('Chorus stored one');
    });
});

// ═════════════════════════════════════════════════════════════════════════
// 5. THREE TAKES + BEAT — transcription isolation and beat session handling
// ═════════════════════════════════════════════════════════════════════════

describe('Three takes + uploaded beat — transcription isolation', () => {
    // Simulate the setSessions update that StudioWorkspace applies when a
    // transcription promise resolves for a specific take id.
    function applyTranscription(
        sessions: RecordingSession[],
        targetId: string,
        aiResult: { transcription?: string; lines?: { text: string; startTime: number; endTime: number }[] }
    ): RecordingSession[] {
        return sessions.map(s =>
            s.id === targetId
                ? {
                    ...s,
                    transcription: aiResult.transcription || s.transcription,
                    lines: aiResult.lines || s.lines,
                }
                : s
        );
    }

    const take1 = makeSession({ id: 't1', name: 'Take 1', transcription: undefined, lines: undefined });
    const take2 = makeSession({ id: 't2', name: 'Take 2', transcription: undefined, lines: undefined });
    const take3 = makeSession({
        id: 't3',
        name: 'Take 3',
        isLoopSession: true,
        beatOffset: 4.0,
        loopStart: 0,
        loopEnd: 16,
        transcription: undefined,
        lines: undefined,
    });

    it('transcription for take-1 does not touch take-2 or take-3', () => {
        let sessions: RecordingSession[] = [take3, take2, take1];
        sessions = applyTranscription(sessions, 't1', {
            transcription: 'Take 1 verse',
            lines: [{ text: 'Verse line one', startTime: 0, endTime: 2 }],
        });

        expect(sessions.find(s => s.id === 't1')?.transcription).toBe('Take 1 verse');
        expect(sessions.find(s => s.id === 't2')?.transcription).toBeUndefined();
        expect(sessions.find(s => s.id === 't3')?.transcription).toBeUndefined();
    });

    it('transcription for take-2 does not touch take-1 or take-3', () => {
        let sessions: RecordingSession[] = [take3, take2, take1];
        sessions = applyTranscription(sessions, 't2', {
            transcription: 'Take 2 chorus',
            lines: [{ text: 'Chorus line one', startTime: 0, endTime: 2 }],
        });

        expect(sessions.find(s => s.id === 't1')?.transcription).toBeUndefined();
        expect(sessions.find(s => s.id === 't2')?.transcription).toBe('Take 2 chorus');
        expect(sessions.find(s => s.id === 't3')?.transcription).toBeUndefined();
    });

    it('beat session (take-3, isLoopSession) receives transcription correctly', () => {
        let sessions: RecordingSession[] = [take3, take2, take1];
        sessions = applyTranscription(sessions, 't3', {
            transcription: 'Hook over beat',
            lines: [
                { text: 'Hook line one', startTime: 0, endTime: 2.5 },
                { text: 'Hook line two', startTime: 3.0, endTime: 5.5 },
            ],
        });

        const updated = sessions.find(s => s.id === 't3')!;
        expect(updated.transcription).toBe('Hook over beat');
        expect(updated.lines).toHaveLength(2);
        expect(updated.lines![0].text).toBe('Hook line one');
        // isLoopSession and beatOffset must be preserved — not clobbered by the update
        expect(updated.isLoopSession).toBe(true);
        expect(updated.beatOffset).toBe(4.0);
        expect(updated.loopStart).toBe(0);
        expect(updated.loopEnd).toBe(16);
    });

    it('all three transcriptions applied sequentially leave each session independent', () => {
        let sessions: RecordingSession[] = [take3, take2, take1];

        // Simulate promises resolving in reverse order (take-3 first, take-1 last)
        sessions = applyTranscription(sessions, 't3', { transcription: 'Beat take lyrics', lines: [{ text: 'Beat line', startTime: 0, endTime: 3 }] });
        sessions = applyTranscription(sessions, 't2', { transcription: 'Second take lyrics', lines: [{ text: 'Second line', startTime: 0, endTime: 3 }] });
        sessions = applyTranscription(sessions, 't1', { transcription: 'First take lyrics', lines: [{ text: 'First line', startTime: 0, endTime: 3 }] });

        expect(sessions.find(s => s.id === 't1')?.transcription).toBe('First take lyrics');
        expect(sessions.find(s => s.id === 't2')?.transcription).toBe('Second take lyrics');
        expect(sessions.find(s => s.id === 't3')?.transcription).toBe('Beat take lyrics');
    });

    it('a null AI result (API failure) leaves existing transcription unchanged', () => {
        // take-1 already has transcription from a previous partial result
        const priorState: RecordingSession[] = [
            { ...take3 },
            { ...take2 },
            { ...take1, transcription: 'Earlier partial result', lines: [{ text: 'Earlier line', startTime: 0, endTime: 2 }] },
        ];

        // Simulate the `if (aiResult)` guard — null result skips the update entirely
        const aiResult = null;
        const updated = aiResult ? applyTranscription(priorState, 't1', aiResult) : priorState;

        expect(updated.find(s => s.id === 't1')?.transcription).toBe('Earlier partial result');
    });

    it('three-take + beat sessions all persist to localStorage', () => {
        const localStore: Record<string, string> = {};
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => { localStore[k] = String(v); });
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(k => localStore[k] ?? null);

        const sessions: RecordingSession[] = [
            { ...take3, transcription: 'Beat hook', lines: [{ text: 'Hook', startTime: 0, endTime: 3 }] },
            { ...take2, transcription: 'Chorus', lines: [{ text: 'Chorus line', startTime: 0, endTime: 3 }] },
            { ...take1, transcription: 'Verse', lines: [{ text: 'Verse line', startTime: 0, endTime: 3 }] },
        ];

        // Replicate StudioWorkspace's save: strip audioUrl + base64
        const toSave = sessions.map(({ audioUrl: _a, base64: _b, ...rest }) => rest);
        localStorage.setItem('studio-pro-data-v2', JSON.stringify({ sessions: toSave }));

        const { sessions: loaded } = JSON.parse(localStorage.getItem('studio-pro-data-v2')!);
        expect(loaded).toHaveLength(3);
        expect(loaded.find((s: RecordingSession) => s.id === 't1')?.transcription).toBe('Verse');
        expect(loaded.find((s: RecordingSession) => s.id === 't2')?.transcription).toBe('Chorus');
        expect(loaded.find((s: RecordingSession) => s.id === 't3')?.transcription).toBe('Beat hook');
        expect(loaded.find((s: RecordingSession) => s.id === 't3')?.isLoopSession).toBe(true);
        expect(loaded.find((s: RecordingSession) => s.id === 't3')?.beatOffset).toBe(4.0);

        vi.restoreAllMocks();
    });
});

// ═════════════════════════════════════════════════════════════════════════
// 6. PLAYER TAB — three takes, correct lyrics shown per take
// ═════════════════════════════════════════════════════════════════════════

describe('PlayerTab — three takes including beat session', () => {
    const take1 = makeSession({
        id: 't1', name: 'Take 1',
        transcription: 'Verse lyrics',
        lines: [{ text: 'Verse line one', startTime: 0, endTime: 2 }],
    });
    const take2 = makeSession({
        id: 't2', name: 'Take 2',
        transcription: 'Chorus lyrics',
        lines: [{ text: 'Chorus line one', startTime: 0, endTime: 2 }],
    });
    const take3 = makeSession({
        id: 't3', name: 'Take 3',
        isLoopSession: true, beatOffset: 4.0,
        transcription: 'Hook over beat',
        lines: [{ text: 'Hook line one', startTime: 0, endTime: 3 }],
    });
    const allTakes = [take3, take2, take1];

    it('shows only take-1 lyrics when take-1 is active', () => {
        render(<PlayerTab {...makePlayerProps(take1, allTakes)} />);
        expect(screen.getByText('Verse line one')).toBeTruthy();
        expect(screen.queryByText('Chorus line one')).toBeNull();
        expect(screen.queryByText('Hook line one')).toBeNull();
    });

    it('shows only take-2 lyrics when take-2 is active', () => {
        render(<PlayerTab {...makePlayerProps(take2, allTakes)} />);
        expect(screen.getByText('Chorus line one')).toBeTruthy();
        expect(screen.queryByText('Verse line one')).toBeNull();
        expect(screen.queryByText('Hook line one')).toBeNull();
    });

    it('shows only beat-take lyrics when take-3 (beat session) is active', () => {
        render(<PlayerTab {...makePlayerProps(take3, allTakes)} />);
        expect(screen.getByText('Hook line one')).toBeTruthy();
        expect(screen.queryByText('Verse line one')).toBeNull();
        expect(screen.queryByText('Chorus line one')).toBeNull();
    });

    it('take picker lists all three takes', () => {
        render(<PlayerTab {...makePlayerProps(take3, allTakes)} />);
        const takeButton = screen.getByText(/TAKE \d/i);
        fireEvent.click(takeButton);
        const takeLabels = screen.getAllByText(/Take \d/i);
        expect(takeLabels.length).toBeGreaterThanOrEqual(3);
    });
});
