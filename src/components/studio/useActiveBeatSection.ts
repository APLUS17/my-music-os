import { useRef, useEffect } from 'react';
import { LyricSection } from '@/types';

export function useActiveBeatSection(sections: LyricSection[], time: number | null): number {
    const lastIdxRef = useRef(-1);

    let activeIdx = -1;

    if (sections.length > 0 && time !== null) {
        // eslint-disable-next-line react-hooks/refs
        const lastIdx = lastIdxRef.current;

        // Fast path 1: Check if still in the same section
        if (lastIdx >= 0 && lastIdx < sections.length) {
            const s = sections[lastIdx];
            if (time >= s.startTime && time < s.endTime) {
                activeIdx = lastIdx;
            }
        }

        // Fast path 2: Check if moved to the next section
        if (activeIdx === -1 && lastIdx + 1 >= 0 && lastIdx + 1 < sections.length) {
            const s = sections[lastIdx + 1];
            if (time >= s.startTime && time < s.endTime) {
                activeIdx = lastIdx + 1;
            }
        }

        // Fallback: Full linear search
        if (activeIdx === -1) {
            activeIdx = sections.findIndex(s => time >= s.startTime && time < s.endTime);
        }
    }

    // Safely update the ref outside of the pure render phase
    useEffect(() => {
        lastIdxRef.current = activeIdx;
    }, [activeIdx]);

    return activeIdx;
}
