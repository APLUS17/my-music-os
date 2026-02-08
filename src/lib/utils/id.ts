/**
 * Generate a unique ID for use in React components.
 * This uses a counter + randomness for uniqueness without
 * causing render impurity issues.
 */
let counter = 0;

export function generateId(prefix: string = ''): string {
    counter += 1;
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `${prefix}${timestamp}-${randomPart}-${counter}`;
}

/**
 * Simple random ID generator for use in event handlers (not during render)
 */
export function randomId(): string {
    return Math.random().toString(36).substring(2, 11);
}
