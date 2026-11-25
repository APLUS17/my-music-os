'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * A function with a stable identity that always calls the latest version of
 * `fn`. Lets plain inline handlers be passed to memoised children without
 * defeating the memo.
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
    const ref = useRef(fn);
    useLayoutEffect(() => { ref.current = fn; });
    return useCallback((...args: A) => ref.current(...args), []);
}
