import { Fragment, memo, useMemo, useRef, useEffect, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  ChevronDown,
  MoreHorizontal,
  Plus,
  Copy,
  Trash2,
  Repeat,
  Check,
  GripVertical,
  Mic,
  Wand2,
  Equal,
  ArrowUpDown,
} from 'lucide-react';
import { Reorder, useDragControls } from 'framer-motion';
import { SongSection, SectionType } from '../types';
import { getSectionColorPalette } from './MasterPlaybackDock';
import { RhymeWordInfo } from '../utils/rhyme';

const SECTION_TYPES: SectionType[] = [
  'hook',
  'verse',
  'chorus',
  'bridge',
  'pre-chorus',
  'intro',
  'outro',
  'none',
];

const LONG_PRESS_MS = 420;

export interface FocusRequest {
  sectionId: string;
  nonce: number;
  caret?: 'start' | 'end';
}

export interface SectionBlockProps {
  section: SongSection;
  totalSectionsCount?: number;
  onUpdateText: (id: string, text: string) => void;
  onUpdateType: (id: string, type: SectionType) => void;
  onCycleLoopState?: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteEmptyAndFocusPrev?: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAddSectionBelow?: (id: string) => void;
  onRecordTake?: (id: string) => void;
  onSuggestNextLines?: (id: string) => void;
  onToggleRhymes?: () => void;
  isGeneratingLyrics?: boolean;
  onFocus: (id: string) => void;
  onBlur?: (id: string) => void;
  onUserInteract?: () => void;
  onSelectSection?: (id: string) => void;
  onJumpToSection?: (id: string) => void;
  isCurrentlyPlaying?: boolean;
  activeLineIndex?: number | null;
  isFocused?: boolean;
  showRhymes?: boolean;
  rhymeWordMap?: Map<string, RhymeWordInfo>;
  isReorderMode?: boolean;
  onEnterReorderMode?: () => void;
  focusRequest?: FocusRequest | null;
}

function renderRhymeUnderlines(text: string, rhymeWordMap: Map<string, RhymeWordInfo>) {
  if (!text) return null;
  const tokens = text.split(/(\b[a-zA-Z]+(?:'[a-zA-Z]+)?\b)/g);
  return tokens.map((token, idx) => {
    const clean = token.toLowerCase().replace(/[^a-z]/g, '');
    const rhymeInfo = clean ? rhymeWordMap.get(clean) : null;
    if (rhymeInfo) {
      return (
        <span
          key={idx}
          className={`underline ${rhymeInfo.colorClass} decoration-[2.5px] underline-offset-[5px]`}
        >
          {token}
        </span>
      );
    }
    return <span key={idx}>{token}</span>;
  });
}

function SectionBlock({
  section,
  totalSectionsCount = 1,
  onUpdateText,
  onUpdateType,
  onCycleLoopState,
  onDelete,
  onDeleteEmptyAndFocusPrev,
  onDuplicate,
  onAddSectionBelow,
  onRecordTake,
  onSuggestNextLines,
  onToggleRhymes,
  isGeneratingLyrics = false,
  onFocus,
  onBlur,
  onUserInteract,
  onSelectSection,
  onJumpToSection,
  isCurrentlyPlaying = false,
  activeLineIndex = null,
  isFocused = false,
  showRhymes = false,
  rhymeWordMap,
  isReorderMode = false,
  onEnterReorderMode,
  focusRequest = null,
}: SectionBlockProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  // Long-press state on section tag pill to enter Reorder mode
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartRef.current = null;
  };

  useEffect(() => clearLongPress, []);

  // Deterministic auto-focus when requested (new track open, double-return new stanza, etc.)
  const lastHandledFocusNonceRef = useRef<number>(0);
  useEffect(() => {
    if (!focusRequest || focusRequest.sectionId !== section.id) return;
    if (focusRequest.nonce === lastHandledFocusNonceRef.current) return;
    lastHandledFocusNonceRef.current = focusRequest.nonce;

    const el = textareaRef.current;
    if (!el) return;
    el.focus({ preventScroll: false });
    const pos = focusRequest.caret === 'start' ? 0 : el.value.length;
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      // Ignore selection errors on unsupported environments
    }
  }, [focusRequest, section.id]);

  // Auto-resize textarea according to contents
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(56, textareaRef.current.scrollHeight)}px`;
    }
  }, [section.text]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
    };
    if (isMenuOpen || isTypeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen, isTypeDropdownOpen]);

  const formatSectionLabel = (type: SectionType) => {
    if (type === 'none') return 'STANZA';
    return type.toUpperCase();
  };

  const handleHeaderClick = () => {
    if (isReorderMode) return;
    if (onSelectSection) {
      onSelectSection(section.id);
    }
    if (onJumpToSection) {
      onJumpToSection(section.id);
    }
    if (textareaRef.current) {
      textareaRef.current.focus();
      onUserInteract?.();
    }
  };

  const handlePillPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (isReorderMode || totalSectionsCount <= 1 || !onEnterReorderMode) return;
    longPressTriggeredRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setIsTypeDropdownOpen(false);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(12); } catch { /* ignore */ }
      }
      onEnterReorderMode();
    }, LONG_PRESS_MS);
  };

  const handlePillPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!pointerStartRef.current) return;
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);
    if (dx > 8 || dy > 8) {
      clearLongPress();
    }
  };

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    onUserInteract?.();

    // Double-Return at the end of a non-empty stanza starts a fresh stanza naturally
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      onAddSectionBelow
    ) {
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      if (start === end) {
        const before = section.text.slice(0, start);
        const after = section.text.slice(end);
        if (before.endsWith('\n') && before.trim().length > 0 && after.trim().length === 0) {
          e.preventDefault();
          onUpdateText(section.id, before.slice(0, -1));
          onAddSectionBelow(section.id);
          return;
        }
      }
    }

    // Backspace inside a completely empty extra stanza removes it and returns cursor to previous stanza
    if (
      e.key === 'Backspace' &&
      section.text.length === 0 &&
      totalSectionsCount > 1 &&
      onDeleteEmptyAndFocusPrev
    ) {
      e.preventDefault();
      onDeleteEmptyAndFocusPrev(section.id);
    }
  };

  const dragControls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);

  const lines = useMemo(() => (section.text ? section.text.split('\n') : []), [section.text]);
  const rhymeElements = useMemo(() => {
    if (!showRhymes || !rhymeWordMap || rhymeWordMap.size === 0 || !section.text) return null;
    return renderRhymeUnderlines(section.text, rhymeWordMap);
  }, [showRhymes, rhymeWordMap, section.text]);

  return (
    <Reorder.Item
      value={section}
      id={`section-block-${section.id}`}
      dragListener={false}
      dragControls={dragControls}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
      className={`group relative mb-7 transition-all duration-200 ${
        isDragging
          ? 'z-50 scale-[1.015] shadow-[0_16px_40px_rgba(0,0,0,0.7)] bg-[#141416]/90 rounded-2xl p-3.5 border border-amber-500/40 backdrop-blur-2xl ring-1 ring-amber-500/30'
          : isReorderMode
            ? 'rounded-xl px-3 py-2.5 bg-white/[0.03] border border-white/[0.08]'
            : isFocused
              ? 'opacity-100'
              : 'opacity-90 hover:opacity-100'
      }`}
    >
      {/* Clean, minimal stanza header */}
      <div
        className="flex items-center justify-between pb-1 mb-0.5 select-none"
        onPointerDown={(e) => {
          if (!isReorderMode) return;
          const target = e.target as HTMLElement;
          if (!target.closest('button') && !target.closest('input') && !target.closest('textarea')) {
            if (e.button === 0 || e.pointerType === 'touch') {
              dragControls.start(e);
            }
          }
        }}
      >
        <div className="flex items-center gap-2 flex-nowrap min-w-0">
          {/* Drag handle only appears in active Reorder mode */}
          {isReorderMode && (
            <div
              onPointerDown={(e) => {
                if (e.button === 0 || e.pointerType === 'touch') {
                  e.stopPropagation();
                  dragControls.start(e);
                }
              }}
              className="cursor-grab active:cursor-grabbing touch-none p-1.5 -ml-1.5 rounded-lg text-amber-400/90 hover:text-amber-300 hover:bg-white/[0.06] active:bg-white/[0.12] transition-colors shrink-0 flex items-center justify-center select-none"
              title="Drag to reorder stanza"
              aria-label="Drag to reorder stanza"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}

          {/* Section Tag & Active Playing Indicator */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleHeaderClick}>
            {isCurrentlyPlaying && (
              <span
                className="w-2 h-2 rounded-full animate-pulse inline-block shrink-0 transition-colors"
                style={{
                  backgroundColor: getSectionColorPalette(section.type).solid,
                  boxShadow: `0 0 8px ${getSectionColorPalette(section.type).solid}`,
                }}
              />
            )}

            {/* Subtle Section Type Tag & Dropdown (Long-press enters Reorder mode) */}
            <div className="relative shrink-0" ref={typeDropdownRef}>
              <button
                type="button"
                onPointerDown={handlePillPointerDown}
                onPointerMove={handlePillPointerMove}
                onPointerUp={clearLongPress}
                onPointerCancel={clearLongPress}
                onPointerLeave={clearLongPress}
                onClick={(e) => {
                  e.stopPropagation();
                  if (longPressTriggeredRef.current) {
                    longPressTriggeredRef.current = false;
                    return;
                  }
                  if (isReorderMode) return;
                  setIsTypeDropdownOpen(!isTypeDropdownOpen);
                }}
                className={`hit-44 flex items-center gap-1 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors cursor-pointer whitespace-nowrap ${
                  isCurrentlyPlaying
                    ? 'text-zinc-100'
                    : 'text-zinc-500 hover:text-amber-400'
                }`}
                title={totalSectionsCount > 1 ? 'Change section type (hold to reorder)' : 'Change section type'}
              >
                <span>{formatSectionLabel(section.type)}</span>
                {!isReorderMode && (
                  <ChevronDown className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                )}
              </button>

              {isTypeDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-40 w-36 max-h-[60dvh] overflow-y-auto rounded-xl ios-glass border border-ios-border/80 shadow-2xl p-1 animate-fadeIn">
                  {SECTION_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateType(section.id, t);
                        setIsTypeDropdownOpen(false);
                      }}
                      className={`flex items-center justify-between w-full min-h-[44px] px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        section.type === t
                          ? 'text-amber-400 bg-white/[0.08]'
                          : 'text-zinc-200 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span>{formatSectionLabel(t)}</span>
                      {section.type === t && <Check className="w-3 h-3 text-amber-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Loop indicator (only when loop is active) */}
            {section.isLooping && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onCycleLoopState) onCycleLoopState(section.id);
                }}
                className="hit-44 inline-flex items-center justify-center p-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:text-amber-300 hover:bg-amber-500/25 cursor-pointer shrink-0 transition"
                title="Loop enabled (Click to disable)"
                aria-label="Loop enabled (Click to disable)"
              >
                <Repeat className="w-3 h-3 text-amber-400 stroke-[2.2]" />
              </button>
            )}
          </div>
        </div>

        {/* Discreet Stanza Action Menu (...) */}
        {!isReorderMode && (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="hit-44 p-1.5 -mr-1.5 rounded-lg text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors cursor-pointer opacity-35 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
              title="Stanza actions"
              aria-label="Stanza actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-40 w-48 rounded-xl ios-glass border border-ios-border/80 shadow-2xl p-1 animate-fadeIn">
                {onSuggestNextLines && (
                  <button
                    type="button"
                    disabled={isGeneratingLyrics}
                    onClick={() => {
                      onSuggestNextLines(section.id);
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-2 w-full min-h-[44px] px-2.5 py-2 rounded-lg text-xs text-ios-text hover:bg-white/[0.06] cursor-pointer disabled:opacity-50"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isGeneratingLyrics ? 'Thinking…' : 'Suggest Next Lines'}</span>
                  </button>
                )}
                {onToggleRhymes && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleRhymes();
                      setIsMenuOpen(false);
                    }}
                    className={`flex items-center gap-2 w-full min-h-[44px] px-2.5 py-2 rounded-lg text-xs hover:bg-white/[0.06] cursor-pointer ${
                      showRhymes ? 'text-amber-400 font-medium' : 'text-ios-text'
                    }`}
                  >
                    <Equal className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{showRhymes ? 'Hide Rhymes' : 'Highlight Rhymes'}</span>
                  </button>
                )}
                {(onSuggestNextLines || onToggleRhymes) && (
                  <div className="my-1 border-t border-white/[0.08]" />
                )}
                {onRecordTake && (
                  <button
                    type="button"
                    onClick={() => {
                      onRecordTake(section.id);
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-2 w-full min-h-[44px] px-2.5 py-2 rounded-lg text-xs text-ios-text hover:bg-white/[0.06] cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5 text-red-400" />
                    <span>Record Take</span>
                  </button>
                )}
                {onAddSectionBelow && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddSectionBelow(section.id);
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-2 w-full min-h-[44px] px-2.5 py-2 rounded-lg text-xs text-ios-text hover:bg-white/[0.06] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-ios-amber" />
                    <span>Add Stanza Below</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onDuplicate(section.id);
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full min-h-[44px] px-2.5 py-2 rounded-lg text-xs text-ios-text hover:bg-white/[0.06] cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Duplicate Stanza</span>
                </button>
                {onCycleLoopState && (
                  <button
                    type="button"
                    onClick={() => {
                      onCycleLoopState(section.id);
                      setIsMenuOpen(false);
                    }}
                    className={`flex items-center gap-2 w-full min-h-[44px] px-2.5 py-2 rounded-lg text-xs hover:bg-white/[0.06] cursor-pointer transition ${
                      section.isLooping ? 'text-amber-400 font-medium' : 'text-ios-text'
                    }`}
                  >
                    <Repeat className={`w-3.5 h-3.5 ${section.isLooping ? 'text-amber-400' : ''}`} />
                    <span>{section.isLooping ? 'Loop: On' : 'Loop: Off'}</span>
                  </button>
                )}
                {totalSectionsCount > 1 && onEnterReorderMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onEnterReorderMode();
                    }}
                    className="flex items-center gap-2 w-full min-h-[44px] px-2.5 py-2 rounded-lg text-xs text-ios-text hover:bg-white/[0.06] cursor-pointer"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Reorder Stanzas</span>
                  </button>
                )}
                {totalSectionsCount > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(section.id);
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-2 w-full min-h-[44px] px-2.5 py-2 rounded-lg text-xs text-ios-red hover:bg-ios-red/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Stanza</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lyric textarea */}
      <div className="relative">
        {isCurrentlyPlaying && activeLineIndex !== null && activeLineIndex >= 0 && lines.length > 0 && (
          <div
            aria-hidden="true"
            className="absolute inset-0 z-0 pointer-events-none select-none text-[17px] sm:text-[19px] leading-[1.65] font-sans tracking-[-0.01em] p-0 m-0 whitespace-pre-wrap break-words overflow-hidden text-transparent"
          >
            {lines.map((line, idx, arr) => (
              <Fragment key={idx}>
                <span
                  data-active-lyric-line={idx === activeLineIndex ? 'true' : undefined}
                  className={
                    idx === activeLineIndex
                      ? 'bg-amber-500/20 rounded-[4px] shadow-[0_0_0_3px_rgba(245,158,11,0.18)] box-decoration-clone transition-colors duration-200'
                      : undefined
                  }
                >
                  {line}
                </span>
                {idx < arr.length - 1 ? '\n' : null}
              </Fragment>
            ))}
          </div>
        )}
        {rhymeElements && (
          <div
            aria-hidden="true"
            className="absolute inset-0 z-20 pointer-events-none select-none text-[17px] sm:text-[19px] leading-[1.65] font-sans tracking-[-0.01em] p-0 m-0 whitespace-pre-wrap break-words overflow-hidden text-transparent"
          >
            {rhymeElements}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={section.text}
          readOnly={isReorderMode}
          onChange={(e) => onUpdateText(section.id, e.target.value)}
          onKeyDown={handleTextareaKeyDown}
          onPointerDown={() => {
            if (!isReorderMode) onUserInteract?.();
          }}
          onInput={(e) => {
            const target = e.currentTarget;
            target.style.height = 'auto';
            target.style.height = `${Math.max(56, target.scrollHeight)}px`;
          }}
          onFocus={() => {
            if (isReorderMode) return;
            if (onSelectSection) onSelectSection(section.id);
            onFocus(section.id);
          }}
          onBlur={() => {
            onBlur?.(section.id);
          }}
          placeholder={section.placeholder || 'Start writing your lyrics...'}
          rows={2}
          spellCheck={false}
          className={`notes-textarea relative z-10 w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-ios-text text-[17px] sm:text-[19px] leading-[1.65] font-sans placeholder:text-zinc-600 select-text tracking-[-0.01em] p-0 m-0 block overflow-hidden resize-none ${
            isReorderMode ? 'pointer-events-none opacity-60' : ''
          }`}
        />
      </div>
    </Reorder.Item>
  );
}

// Memoized: during playback the app re-renders 20 times a second for the clock,
// and a section only needs to redraw when its own content or state changes.
export default memo(SectionBlock);
