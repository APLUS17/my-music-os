import { useState } from 'react';
import { findTimeIndex, TimeRange } from '@/lib/utils/search';

export function useActiveTimeIndex<T extends TimeRange>(items: T[], currentTime: number | null, lookaheadOffset: number = 0): number {
    const [state, setState] = useState<{items: T[], index: number}>({
        items,
        index: -1
    });

    if (items.length === 0 || currentTime === null) {
        if (state.index !== -1) {
            setState({ items, index: -1 });
        }
        return -1;
    }

    const targetTime = currentTime + lookaheadOffset;
    let nextIdx = state.index;

    // Fast path: if the cached index still works, return it
    if (state.items === items && nextIdx >= 0 && nextIdx < items.length) {
        const item = items[nextIdx];
        if (targetTime >= item.startTime && targetTime < item.endTime) {
            return nextIdx;
        }
    }

    // Slow path: binary search
    nextIdx = findTimeIndex(items, targetTime);
    if (nextIdx === -1 && targetTime >= items[items.length - 1].endTime) {
        nextIdx = items.length - 1;
    }

    // Update state to trigger re-render if the index actually changed
    // This conforms to React's derived state guidelines
    if (nextIdx !== state.index || items !== state.items) {
        setState({ items, index: nextIdx });
    }

    return nextIdx;
}
