export type TimeRange = { startTime: number; endTime: number };

/**
 * Performs a binary search on a sorted array of objects with startTime and endTime properties.
 * Returns the index of the object where targetTime >= startTime && targetTime < endTime.
 * If no such object is found, returns -1.
 *
 * Assumes the array is sorted by startTime and intervals do not overlap.
 */
export function findTimeIndex<T extends TimeRange>(arr: T[], targetTime: number): number {
    let low = 0;
    let high = arr.length - 1;

    while (low <= high) {
        const mid = (low + high) >>> 1;
        const item = arr[mid];

        if (targetTime >= item.startTime && targetTime < item.endTime) {
            return mid;
        } else if (targetTime < item.startTime) {
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }

    return -1;
}
