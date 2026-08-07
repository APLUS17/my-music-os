'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export interface ConfirmDialogState {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
}

interface ConfirmDialogProps {
    state: ConfirmDialogState | null;
    onCancel: () => void;
}

/**
 * Themed replacement for native window.confirm() — matches the app's own
 * modal pattern (bottom sheet on mobile, centered on desktop) instead of
 * dropping the user into a jarring, unstyled browser dialog.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ state, onCancel }) => {
    const isOpen = state !== null;

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onCancel]);

    return (
        <AnimatePresence>
            {state && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[320] bg-black/70 backdrop-blur-sm"
                        onClick={onCancel}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                        className="fixed inset-x-4 bottom-0 z-[321] pb-[env(safe-area-inset-bottom)] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="confirm-dialog-title"
                    >
                        <div className="bg-[var(--bg-card)] rounded-t-3xl sm:rounded-3xl border border-[var(--border-main)] p-6 flex flex-col gap-5">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${state.destructive ? 'bg-[var(--studio-red)]/10' : 'bg-[var(--accent)]/10'}`}>
                                    {state.destructive ? (
                                        <AlertTriangle size={16} className="text-[var(--studio-red)]" />
                                    ) : (
                                        <HelpCircle size={16} className="text-[var(--accent)]" />
                                    )}
                                </div>
                                <h2 id="confirm-dialog-title" className="text-base font-bold tracking-tight text-[var(--text-main)]">
                                    {state.title}
                                </h2>
                            </div>

                            {state.description && (
                                <p className="text-sm text-[var(--text-secondary)] leading-relaxed -mt-1">
                                    {state.description}
                                </p>
                            )}

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    className="flex-1 h-12 bg-[var(--bg-secondary)] text-[var(--text-main)] border border-[var(--border-main)] rounded-2xl text-sm font-bold tracking-wide hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
                                >
                                    {state.cancelLabel ?? 'Cancel'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        state.onConfirm();
                                        onCancel();
                                    }}
                                    className={`flex-1 h-12 rounded-2xl text-sm font-bold tracking-wide active:scale-[0.98] transition-all cursor-pointer ${
                                        state.destructive
                                            ? 'bg-[var(--studio-red)] text-white hover:opacity-90'
                                            : 'bg-[var(--text-main)] text-[var(--bg-main)] hover:opacity-90'
                                    }`}
                                >
                                    {state.confirmLabel ?? (state.destructive ? 'Delete' : 'Confirm')}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
