'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Equal, Plus, Redo2, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeyboardAccessoryBarProps {
    visible: boolean;
    /** Height of the on-screen keyboard in px (0 when there is none). */
    keyboardInset: number;
    /** Extra space to leave under the bar, e.g. the compact mini player docked above the keyboard. */
    bottomOffset?: number;
    canUndo: boolean;
    canRedo: boolean;
    showRhymes: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onToggleRhymes: () => void;
    onAddStanza: () => void;
    onDone: () => void;
}

/**
 * Writing tools that appear only while typing in a stanza. On a phone it sits
 * flush above the keyboard; on desktop it floats above the player. Buttons
 * swallow mousedown so tapping them never steals focus from the text.
 */
export function KeyboardAccessoryBar({
    visible, keyboardInset, bottomOffset = 0, canUndo, canRedo, showRhymes,
    onUndo, onRedo, onToggleRhymes, onAddStanza, onDone,
}: KeyboardAccessoryBarProps) {
    const keepFocus = (e: React.MouseEvent) => e.preventDefault();
    const bottom = keyboardInset > 0 ? keyboardInset + bottomOffset : undefined;

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="keyboard-accessory-bar"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    role="toolbar"
                    aria-label="Writing tools"
                    data-testid="keyboard-accessory-bar"
                    className={cn(
                        'absolute inset-x-0 z-[45] flex justify-center px-3 pointer-events-none',
                        keyboardInset > 0 ? '' : 'bottom-[7.5rem]'
                    )}
                    style={bottom !== undefined ? { bottom } : undefined}
                >
                    <div className="pointer-events-auto inline-flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-[var(--bg-card)]/95 backdrop-blur-xl border border-[var(--border-main)] shadow-[0_10px_28px_rgba(0,0,0,0.5)]">
                        <BarButton label="Undo" onClick={onUndo} onMouseDown={keepFocus} disabled={!canUndo} testId="bar-undo"><Undo2 size={15} /></BarButton>
                        <BarButton label="Redo" onClick={onRedo} onMouseDown={keepFocus} disabled={!canRedo} testId="bar-redo"><Redo2 size={15} /></BarButton>
                        <span className="w-px h-4 bg-[var(--border-main)] mx-1" aria-hidden />
                        <BarButton label="Rhymes" onClick={onToggleRhymes} onMouseDown={keepFocus} active={showRhymes} showLabel testId="bar-rhymes"><Equal size={15} /></BarButton>
                        <BarButton label="Stanza" onClick={onAddStanza} onMouseDown={keepFocus} showLabel testId="bar-stanza"><Plus size={15} /></BarButton>
                        <span className="w-px h-4 bg-[var(--border-main)] mx-1" aria-hidden />
                        <button
                            type="button"
                            onClick={onDone}
                            onMouseDown={keepFocus}
                            className="min-h-[36px] px-3 rounded-full text-xs font-semibold text-[var(--accent)] hover:bg-[var(--bg-hover)] active:scale-95 transition-colors"
                            data-testid="bar-done"
                        >
                            Done
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function BarButton({
    label, onClick, onMouseDown, disabled, active, showLabel, testId, children,
}: {
    label: string;
    onClick: () => void;
    onMouseDown: (e: React.MouseEvent) => void;
    disabled?: boolean;
    active?: boolean;
    showLabel?: boolean;
    testId?: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            onMouseDown={onMouseDown}
            disabled={disabled}
            title={label}
            aria-label={label}
            aria-pressed={active}
            data-testid={testId}
            className={cn(
                'min-h-[36px] rounded-full flex items-center justify-center gap-1.5 text-xs font-medium transition-colors active:scale-95',
                showLabel ? 'px-2.5' : 'w-9',
                disabled && 'opacity-35 cursor-not-allowed',
                active ? 'bg-amber-500/20 text-amber-300' : 'text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            )}
        >
            {children}
            {showLabel && <span>{label}</span>}
        </button>
    );
}
