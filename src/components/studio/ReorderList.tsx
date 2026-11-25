'use client';

import React, { useEffect, useState } from 'react';
import { Reorder } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import type { LyricSection } from '@/types';
import type { SectionTiming } from '@/lib/timeline/timeline';
import { sectionColor } from '@/lib/timeline/sectionColors';
import { typeLabel } from '@/lib/timeline/sectionEdit';
import { formatTime } from '@/lib/utils/time';

interface ReorderListProps {
    sections: LyricSection[];
    timings: SectionTiming[];
    /** Called once when a drag ends, with the new order. */
    onCommit: (reordered: LyricSection[]) => void;
    onDone: () => void;
}

/**
 * Collapsed, draggable stanza rows. Dragging reorders live; the new order is
 * committed once on release so it is a single undo step and the timeline is
 * re-laid-out once.
 */
export function ReorderList({ sections, timings, onCommit, onDone }: ReorderListProps) {
    // The parent remounts this (via `key`) whenever the committed order changes.
    const [order, setOrder] = useState(sections);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onDone]);

    const timingOf = (id: string) => timings.find(t => t.id === id);

    return (
        <div data-testid="reorder-list">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <div className="text-sm font-semibold">Reorder sections</div>
                    <div className="text-[11px] text-[var(--text-tertiary)]">Drag a row. Each section keeps its length.</div>
                </div>
                <button
                    type="button"
                    onClick={onDone}
                    className="px-4 h-8 rounded-full bg-[var(--accent)] text-white text-xs font-semibold active:scale-95"
                    data-testid="reorder-done"
                >
                    Done
                </button>
            </div>

            <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-2">
                {order.map(section => {
                    const color = sectionColor(section.type);
                    const t = timingOf(section.id);
                    const preview = section.text.split('\n').find(l => l.trim()) ?? 'Empty';
                    return (
                        <Reorder.Item
                            key={section.id}
                            value={section}
                            onDragEnd={() => onCommit(order)}
                            className="flex items-center gap-3 px-3 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] cursor-grab active:cursor-grabbing select-none touch-none"
                            style={{ boxShadow: `inset 3px 0 0 ${color}` }}
                            data-testid="reorder-item"
                            data-section-id={section.id}
                        >
                            <GripVertical size={16} className="text-[var(--text-tertiary)] shrink-0" />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] mono uppercase tracking-wider font-semibold" style={{ color }}>{typeLabel(section.type)}</span>
                                    {t && t.end > t.start && (
                                        <span className="text-[10px] mono text-[var(--text-tertiary)] tabular-nums">
                                            {formatTime(t.start).replace(/^0/, '')} – {formatTime(t.end).replace(/^0/, '')}
                                        </span>
                                    )}
                                </div>
                                <div className={`text-sm truncate ${section.text.trim() ? 'text-[var(--text-main)]' : 'text-[var(--text-tertiary)] italic'}`}>{preview}</div>
                            </div>
                        </Reorder.Item>
                    );
                })}
            </Reorder.Group>
        </div>
    );
}
