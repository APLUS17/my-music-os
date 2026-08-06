import React, { useRef, useLayoutEffect } from 'react';
import { LyricSection } from '@/types';
import { randomId } from '@/lib/utils/id';

interface OpenEditorProps {
    sections: LyricSection[];
    onUpdateSections: (sections: LyricSection[]) => void;
    onFocus?: () => void;
    onBlur?: () => void;
}

/**
 * A blank, notes-page style editor — a single freeform surface instead of
 * structured section cards. Sections remain the source of truth: blocks are
 * separated by a blank line, so a double line-break starts a new section.
 * Existing section metadata (type, repeats, pinned takes) is preserved by
 * position when text is round-tripped back into sections.
 */
export const OpenEditor: React.FC<OpenEditorProps> = ({ sections, onUpdateSections, onFocus, onBlur }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const value = sections.map(s => s.text).join('\n\n');

    // Grow the textarea to fit its content so the parent handles scrolling.
    useLayoutEffect(() => {
        const el = textareaRef.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        // Split on blank lines — each block maps to a section.
        const blocks = e.target.value.split(/\n{2,}/);

        const updated: LyricSection[] = blocks.map((text, i) => {
            const existing = sections[i];
            if (existing) return { ...existing, text };
            return { id: randomId(), type: 'verse', repeats: 1, text };
        });

        if (updated.length === 0) {
            updated.push({ id: sections[0]?.id ?? randomId(), type: 'verse', repeats: 1, text: '' });
        }

        onUpdateSections(updated);
    };

    return (
        <div className="animate-in fade-in duration-500 min-h-full">
            <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                rows={1}
                placeholder="Start writing... every idea has a home here. Leave a blank line to start a new section."
                spellCheck={false}
                onFocus={onFocus}
                onBlur={onBlur}
                className="w-full bg-transparent border-none focus:outline-none text-[var(--text-main)] text-lg leading-loose font-sans placeholder:text-[var(--text-tertiary)] resize-none overflow-hidden whitespace-pre-wrap break-words block min-h-[60vh]"
            />
        </div>
    );
};
