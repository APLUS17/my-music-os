/**
 * The song clock: one place that answers "where are we on the song timeline,
 * and is anything playing?" for the editor, auto-scroll and karaoke.
 *
 * Why its own clock: the studio's `currentTime` only follows the global
 * player, but the beat can also play on its own (BeatUploader), and takes are
 * placed on the beat at an offset. This clock reads the real audio elements,
 * so the editor follows whatever is actually making sound.
 *
 * It is an external store (subscribe + snapshot) so components that care about
 * time re-render on their own, instead of re-rendering the whole workspace on
 * every frame.
 */

export interface ClockSources {
    beat: HTMLMediaElement | null;
    vocal: HTMLMediaElement | null;
    /** Where the active take's first sample sits on the beat timeline, seconds. */
    vocalAnchorSec: () => number;
}

export type ClockMaster = 'beat' | 'vocal';

/** True if the element has media loaded and is actually advancing. */
function isAdvancing(el: HTMLMediaElement | null): el is HTMLMediaElement {
    return !!el && !!el.getAttribute('src') && !el.paused && !el.ended;
}

function hasMedia(el: HTMLMediaElement | null): el is HTMLMediaElement {
    return !!el && !!el.getAttribute('src');
}

/**
 * Pure source selection, exported for tests.
 *
 * - Something playing: the beat is the timeline when it is playing; otherwise the take (+ anchor).
 * - Paused: follow whichever element the user last moved (`lastMoved`), falling back to what has media.
 */
export function readSongTime(
    s: { beatPlaying: boolean; vocalPlaying: boolean; beatLoaded: boolean; vocalLoaded: boolean; beatTime: number; vocalTime: number; anchor: number },
    lastMoved: ClockMaster | null
): number {
    if (s.beatPlaying) return s.beatTime;
    if (s.vocalPlaying) return s.vocalTime + s.anchor;
    if (lastMoved === 'beat' && s.beatLoaded) return s.beatTime;
    if (lastMoved === 'vocal' && s.vocalLoaded) return s.vocalTime + s.anchor;
    if (s.vocalLoaded) return s.vocalTime + s.anchor;
    if (s.beatLoaded) return s.beatTime;
    return 0;
}

export class SongClock {
    time = 0;
    playing = false;
    private listeners = new Set<() => void>();

    subscribe = (fn: () => void): (() => void) => {
        this.listeners.add(fn);
        return () => { this.listeners.delete(fn); };
    };

    getTime = (): number => this.time;
    getPlaying = (): boolean => this.playing;

    set(time: number, playing: boolean): void {
        if (time === this.time && playing === this.playing) return;
        this.time = time;
        this.playing = playing;
        this.listeners.forEach(l => l());
    }
}

/**
 * Starts reading the audio elements into `clock`. Returns a stop function.
 * Runs a requestAnimationFrame loop only while something is playing; when
 * paused it updates on seek events instead, so it costs nothing at rest.
 */
export function attachSongClock(clock: SongClock, getSources: () => ClockSources): () => void {
    let raf: number | null = null;
    let lastMoved: ClockMaster | null = null;
    let stopped = false;
    const cleanups: Array<() => void> = [];

    const sample = () => {
        const { beat, vocal, vocalAnchorSec } = getSources();
        const beatPlaying = isAdvancing(beat);
        const vocalPlaying = isAdvancing(vocal);
        const t = readSongTime({
            beatPlaying,
            vocalPlaying,
            beatLoaded: hasMedia(beat),
            vocalLoaded: hasMedia(vocal),
            beatTime: beat?.currentTime ?? 0,
            vocalTime: vocal?.currentTime ?? 0,
            anchor: vocalAnchorSec(),
        }, lastMoved);
        clock.set(Number.isFinite(t) ? t : 0, beatPlaying || vocalPlaying);
        return beatPlaying || vocalPlaying;
    };

    const loop = () => {
        raf = null;
        if (stopped) return;
        if (sample()) raf = requestAnimationFrame(loop);
    };
    const kick = () => {
        if (stopped) return;
        sample();
        if (raf === null) raf = requestAnimationFrame(loop);
    };

    const wire = (el: HTMLMediaElement | null, who: ClockMaster) => {
        if (!el) return;
        const onSeek = () => { lastMoved = who; sample(); };
        const onPlay = () => { lastMoved = who; kick(); };
        const onRefresh = () => { sample(); };
        el.addEventListener('seeked', onSeek);
        el.addEventListener('play', onPlay);
        el.addEventListener('playing', kick);
        el.addEventListener('pause', onRefresh);
        el.addEventListener('ended', onRefresh);
        el.addEventListener('loadedmetadata', onRefresh);
        el.addEventListener('emptied', onRefresh);
        cleanups.push(() => {
            el.removeEventListener('seeked', onSeek);
            el.removeEventListener('play', onPlay);
            el.removeEventListener('playing', kick);
            el.removeEventListener('pause', onRefresh);
            el.removeEventListener('ended', onRefresh);
            el.removeEventListener('loadedmetadata', onRefresh);
            el.removeEventListener('emptied', onRefresh);
        });
    };

    const initial = getSources();
    wire(initial.beat, 'beat');
    wire(initial.vocal, 'vocal');
    sample();

    return () => {
        stopped = true;
        if (raf !== null) cancelAnimationFrame(raf);
        cleanups.forEach(fn => fn());
    };
}
