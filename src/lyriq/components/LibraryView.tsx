import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Disc3,
  Loader2,
  Music2,
  PenLine,
  Plus,
  Upload,
} from 'lucide-react';
import type { ImportedBeat, SongSession } from '../types';
import { WorksWheel, type WorksWheelItem } from './ui/works-wheel';

export type LibraryTab = 'songs' | 'beats';
type LibraryFilter = 'all' | 'songs' | 'beats';

export interface LibraryViewProps {
  sessions: SongSession[];
  activeSessionId: string;
  beats: ImportedBeat[];
  onCloseLibrary: () => void;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onToggleFavoriteSession?: (id: string) => void;
  onImportBeatFiles: (files: FileList | File[]) => Promise<void>;
  onDeleteBeat: (beatId: string) => void;
  onRenameBeat?: (beatId: string, newName: string) => void;
  onToggleFavoriteBeat?: (beatId: string) => void;
  onUseBeatInCurrentSong: (beat: ImportedBeat) => void;
  onCreateSongWithBeat: (beat: ImportedBeat) => void;
  isImportingBeat?: boolean;
}

const BEAT_PREFIX = 'beat:';

// Curated dark studio, vinyl, synth, and moody atmospheric cover art from Unsplash
const COVER_ART_POOL = [
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80',
];

const GHOST_RING_SLOTS = Array.from({ length: 8 }, (_, i) => i);

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getCoverForId(id: string): string {
  return COVER_ART_POOL[hashString(id) % COVER_ART_POOL.length];
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getFirstLyricLine(session: SongSession): string | undefined {
  for (const section of session.sections) {
    const rawLines = (section.text || '').split(/\r?\n/);
    for (const raw of rawLines) {
      const trimmed = raw.trim();
      if (trimmed.length > 0) {
        return trimmed.length > 52 ? `${trimmed.slice(0, 52)}…` : trimmed;
      }
    }
  }
  return undefined;
}

/** Returns true once a song has a custom title, lyrics, a recorded take, or an attached beat. */
function isSessionStarted(session: SongSession): boolean {
  if (
    session.isCustomTitle &&
    session.title?.trim() &&
    session.title.trim() !== 'Untitled Track'
  ) {
    return true;
  }
  if (session.importedBeat) return true;
  return session.sections.some(
    (s) =>
      (s.text && s.text.trim().length > 0) ||
      (s.voiceNotes && s.voiceNotes.length > 0),
  );
}

interface LibraryWheelItem extends WorksWheelItem {
  id: string;
  kind: 'song' | 'beat';
}

export default function LibraryView({
  sessions,
  beats,
  onCloseLibrary,
  onSelectSession,
  onCreateSession,
  onImportBeatFiles,
  onUseBeatInCurrentSong,
  onCreateSongWithBeat,
  isImportingBeat = false,
}: LibraryViewProps) {
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const beatInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  const startedSessions = useMemo(
    () => sessions.filter(isSessionStarted),
    [sessions],
  );

  const beatByKey = useMemo(() => {
    const map = new Map<string, ImportedBeat>();
    for (const beat of beats) {
      map.set(`${BEAT_PREFIX}${beat.id}`, beat);
    }
    return map;
  }, [beats]);

  const items = useMemo<LibraryWheelItem[]>(() => {
    const songItems: LibraryWheelItem[] = startedSessions.map((session) => {
      const metaParts = ['Song'];
      if (session.bpm) metaParts.push(`${session.bpm} BPM`);
      if (session.importedBeat?.key) metaParts.push(session.importedBeat.key);

      const firstLine = getFirstLyricLine(session);
      const subtitle =
        firstLine ||
        (session.importedBeat?.name
          ? `Beat: ${session.importedBeat.name}`
          : undefined);

      return {
        id: session.id,
        kind: 'song',
        title: session.title?.trim() || 'Untitled Track',
        image: getCoverForId(session.id),
        meta: metaParts.join(' · '),
        subtitle,
        accentColor: session.coverAccent,
      };
    });

    const beatItems: LibraryWheelItem[] = beats.map((beat) => {
      const metaParts = ['Beat'];
      if (beat.bpm) metaParts.push(`${beat.bpm} BPM`);
      if (beat.key) metaParts.push(beat.key);

      return {
        id: `${BEAT_PREFIX}${beat.id}`,
        kind: 'beat',
        title: beat.name?.trim() || 'Untitled Beat',
        image: getCoverForId(`${BEAT_PREFIX}${beat.id}`),
        meta: metaParts.join(' · '),
        subtitle:
          beat.duration > 0 ? formatDuration(beat.duration) : 'Backing beat',
      };
    });

    if (filter === 'songs') return songItems;
    if (filter === 'beats') return beatItems;
    return [...songItems, ...beatItems];
  }, [startedSessions, beats, filter]);

  const handleStartSong = useCallback(() => {
    // Reuse an existing untouched blank draft instead of creating a duplicate
    const blankDraft = sessions.find((s) => !isSessionStarted(s));
    if (blankDraft) {
      onSelectSession(blankDraft.id);
      return;
    }
    onCreateSession();
  }, [sessions, onSelectSession, onCreateSession]);

  const handleSelectItem = useCallback(
    (item: WorksWheelItem) => {
      if (!item.id) return;
      const beat = beatByKey.get(item.id);
      if (beat) {
        onUseBeatInCurrentSong(beat);
        return;
      }
      onSelectSession(item.id);
    },
    [beatByKey, onSelectSession, onUseBeatInCurrentSong],
  );

  const handleSecondaryAction = useCallback(
    (item: WorksWheelItem) => {
      if (!item.id) return;
      const beat = beatByKey.get(item.id);
      if (beat) {
        onCreateSongWithBeat(beat);
      }
    },
    [beatByKey, onCreateSongWithBeat],
  );

  const handleBeatFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await onImportBeatFiles(files);
    }
    event.target.value = '';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFile(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFile(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await onImportBeatFiles(e.dataTransfer.files);
    }
  };

  const emptyConfig = useMemo(() => {
    if (filter === 'beats') {
      return {
        icon: Disc3,
        title: 'No beats yet',
        description:
          'Upload an MP3, WAV, or M4A instrumental to auto-arrange sections and write over.',
        primary: 'beat' as const,
      };
    }
    if (filter === 'songs') {
      return {
        icon: PenLine,
        title: 'No songs started yet',
        description:
          'Write your first lyric or record a vocal take to add a song to your library.',
        primary: 'song' as const,
      };
    }
    return {
      icon: Music2,
      title: 'Your library is empty',
      description:
        'Start a new song or drop in a beat to build your studio catalog.',
      primary: 'song' as const,
    };
  }, [filter]);

  const EmptyIcon = emptyConfig.icon;

  const emptyStateNode = (
    <div className="relative flex h-full w-full items-center justify-center">
      {/* Subtle ghost ring hinting at the spatial card wheel */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[min(74vw,520px)] w-[min(74vw,520px)]"
      >
        {GHOST_RING_SLOTS.map((slot) => {
          const angleDeg = (slot / GHOST_RING_SLOTS.length) * 360 - 90;
          const rad = (angleDeg * Math.PI) / 180;
          const x = 50 + Math.cos(rad) * 44;
          const y = 50 + Math.sin(rad) * 44;
          return (
            <div
              key={slot}
              className="absolute h-16 w-12 sm:h-20 sm:w-16 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.015]"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%, -50%) rotate(${angleDeg + 90}deg)`,
              }}
            />
          );
        })}
      </div>

      {/* Centered Empty State Card */}
      <div className="relative z-10 flex max-w-sm flex-col items-center text-center px-4">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#e5a93c] shadow-[0_0_28px_rgba(229,169,60,0.14)]">
          <EmptyIcon className="h-5 w-5" />
        </div>

        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
          {emptyConfig.title}
        </h2>
        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
          {emptyConfig.description}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {emptyConfig.primary === 'beat' ? (
            <>
              <button
                type="button"
                onClick={() => beatInputRef.current?.click()}
                disabled={isImportingBeat}
                className="inline-flex items-center gap-2 rounded-full bg-white text-black hover:bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isImportingBeat ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                <span>Upload Beat</span>
              </button>
              <button
                type="button"
                onClick={handleStartSong}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] hover:bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-foreground transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Start a Song</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleStartSong}
                className="inline-flex items-center gap-2 rounded-full bg-white text-black hover:bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Start a Song</span>
              </button>
              <button
                type="button"
                onClick={() => beatInputRef.current?.click()}
                disabled={isImportingBeat}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] hover:bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-foreground transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isImportingBeat ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                <span>Upload Beat</span>
              </button>
            </>
          )}
        </div>

        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
          Or drag & drop an audio file anywhere
        </p>
      </div>
    </div>
  );

  return (
    <div
      className="relative h-svh w-full bg-background text-foreground overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Minimal Floating Top Bar */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-4 sm:px-8 pt-4 sm:pt-6">
        <button
          type="button"
          onClick={onCloseLibrary}
          className="pointer-events-auto inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Studio</span>
        </button>

        {/* Minimal Filter Tabs */}
        <div
          role="tablist"
          aria-label="Filter library"
          className="pointer-events-auto flex items-center gap-5"
        >
          {(['all', 'songs', 'beats'] as const).map((tab) => {
            const active = filter === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab)}
                className={`text-[11px] font-mono uppercase tracking-[0.18em] py-1 transition-colors cursor-pointer ${
                  active
                    ? 'text-foreground border-b border-foreground'
                    : 'text-muted-foreground/65 hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Minimal Actions */}
        <div className="pointer-events-auto flex items-center gap-4">
          <input
            ref={beatInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
            multiple
            onChange={handleBeatFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => beatInputRef.current?.click()}
            disabled={isImportingBeat}
            className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer py-2"
            title="Import Beat"
          >
            {isImportingBeat ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Beat</span>
          </button>

          <button
            type="button"
            onClick={handleStartSong}
            className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-foreground hover:opacity-75 transition-opacity cursor-pointer py-2"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New</span>
          </button>
        </div>
      </header>

      {/* Drag-and-drop overlay for audio files */}
      {isDraggingFile && (
        <div className="pointer-events-none fixed inset-4 z-50 flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#e5a93c]/70 bg-black/80 backdrop-blur-md">
          <Upload className="h-7 w-7 text-[#e5a93c] mb-3" />
          <p className="text-sm font-medium text-foreground">
            Drop audio to add to your Beat Library
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            MP3 · WAV · M4A · FLAC
          </p>
        </div>
      )}

      {/* Full-Viewport Hybrid Ring -> Curved Title Wheel */}
      <WorksWheel
        items={items}
        label={
          filter === 'songs'
            ? 'Songs'
            : filter === 'beats'
              ? 'Beats'
              : 'Library'
        }
        hint="Scroll or drag to browse"
        actionLabel="Open"
        onSelectItem={handleSelectItem}
        secondaryActionLabel={(item) =>
          item.id && beatByKey.has(item.id) ? 'New Song' : null
        }
        onSecondaryAction={handleSecondaryAction}
        emptyState={emptyStateNode}
      />
    </div>
  );
}
