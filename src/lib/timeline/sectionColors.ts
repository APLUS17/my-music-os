import type { SectionType } from '@/types';

/** One color per section type, shared by the strip, the cards and the karaoke view. */
export const SECTION_COLORS: Record<SectionType, string> = {
    intro: '#64748b',
    verse: '#38bdf8',
    'pre-chorus': '#a78bfa',
    chorus: '#f472b6',
    bridge: '#fbbf24',
    outro: '#94a3b8',
    tag: '#34d399',
    idea: '#fb923c',
};

export function sectionColor(type: SectionType): string {
    return SECTION_COLORS[type] ?? '#94a3b8';
}

/** `#rrggbb` + alpha (0..1) -> `rgba(...)`. */
export function withAlpha(hex: string, alpha: number): string {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
