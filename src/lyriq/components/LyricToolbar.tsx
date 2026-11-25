import { memo, useEffect, useState } from 'react';
import { Wand2, Equal, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export interface LyricToolbarProps {
  visible: boolean;
  onMagicWand?: () => void;
  onRhymeStructure?: () => void;
  onAddSection?: () => void;
  onDone?: () => void;
  isRhymeActive?: boolean;
  isGenerating?: boolean;
  onKeyboardInsetChange?: (insetPx: number) => void;
}

/**
 * Minimal keyboard accessory bar shown only while actively typing in a stanza.
 * Tracks visualViewport on touch devices so it sits flush above the virtual
 * keyboard, and floats quietly above the centered record pill on desktop.
 */
function LyricToolbar({
  visible,
  onMagicWand,
  onRhymeStructure,
  onAddSection,
  onDone,
  isRhymeActive = false,
  isGenerating = false,
  onKeyboardInsetChange,
}: LyricToolbarProps) {
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;

    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      // Ignore tiny viewport fluctuations (< 40px, e.g. Safari URL bar)
      const normalized = inset > 40 ? inset : 0;
      setKeyboardInset(normalized);
      onKeyboardInsetChange?.(normalized);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      onKeyboardInsetChange?.(0);
    };
  }, [onKeyboardInsetChange]);

  const isVirtualKeyboardOpen = keyboardInset > 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="keyboard-accessory-bar"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          style={isVirtualKeyboardOpen ? { bottom: `${keyboardInset}px` } : undefined}
          role="toolbar"
          aria-label="Writing accessory tools"
          className={
            isVirtualKeyboardOpen
              ? 'fixed inset-x-0 z-50 bg-[#141416]/95 backdrop-blur-2xl border-t border-white/[0.08] px-3 py-1.5'
              : 'fixed bottom-[4.75rem] sm:bottom-[5.25rem] inset-x-0 z-30 flex justify-center pointer-events-none px-4'
          }
        >
          <div
            className={
              isVirtualKeyboardOpen
                ? 'max-w-3xl mx-auto flex items-center justify-between gap-2'
                : 'pointer-events-auto inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#161618]/92 backdrop-blur-2xl border border-white/[0.09] shadow-[0_10px_28px_rgba(0,0,0,0.65)]'
            }
          >
            <div className="flex items-center gap-1">
              {/* AI Line Continuation (Magic Wand): only when the server offers it */}
              {onMagicWand && <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onMagicWand}
                disabled={isGenerating}
                title={isGenerating ? 'Generating next lines...' : 'Suggest next lyric lines'}
                aria-label="Suggest next lyric lines"
                className={`min-h-[36px] px-2.5 rounded-full flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isGenerating
                    ? 'bg-amber-500/20 text-amber-300 cursor-wait'
                    : 'text-zinc-300 hover:text-white hover:bg-white/[0.07] active:scale-95'
                }`}
              >
                <Wand2 className={`w-3.5 h-3.5 shrink-0 ${isGenerating ? 'animate-pulse text-amber-400' : 'text-amber-400/90'}`} />
                <span>{isGenerating ? 'Thinking…' : 'Suggest'}</span>
              </button>}

              {/* Rhyme Highlighter Toggle */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onRhymeStructure}
                aria-pressed={isRhymeActive}
                title={isRhymeActive ? 'Hide rhyme highlights' : 'Highlight rhyming words'}
                aria-label="Highlight rhyming words"
                className={`min-h-[36px] px-2.5 rounded-full flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isRhymeActive
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-zinc-300 hover:text-white hover:bg-white/[0.07] active:scale-95'
                }`}
              >
                <Equal className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                <span>Rhymes</span>
              </button>

              {/* Subtle Divider + New Stanza */}
              <span className="w-px h-4 bg-white/10 mx-0.5 shrink-0" aria-hidden="true" />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onAddSection}
                title="Insert new stanza (or press Return twice)"
                aria-label="New stanza"
                className="min-h-[36px] px-2.5 rounded-full flex items-center gap-1 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.07] active:scale-95 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                <span>Stanza</span>
              </button>
            </div>

            {onDone && (
              <>
                {!isVirtualKeyboardOpen && (
                  <span className="w-px h-4 bg-white/10 mx-0.5 shrink-0" aria-hidden="true" />
                )}
                <button
                  type="button"
                  onClick={onDone}
                  className="min-h-[36px] px-2.5 rounded-full text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(LyricToolbar);
