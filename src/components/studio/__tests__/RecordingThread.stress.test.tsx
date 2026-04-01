import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecordingThread } from '../RecordingThread';
import { RecordingSession, AutoSection } from '@/types';

describe('RecordingThread Stress Test', () => {
    it('handles rendering a massive number of recording sessions without crashing', () => {
        // Generate massive mock data
        const mockSessions: RecordingSession[] = Array.from({ length: 50 }).map((_, i) => {
            const sections: AutoSection[] = Array.from({ length: 5 }).map((_, j) => ({
                id: `sec-${i}-${j}`,
                startTime: j * 5,
                endTime: (j + 1) * 5,
                type: 'vocal',
                isBest: false,
                isFavorited: false,
                label: `Verse ${j}`
            }));

            return {
                id: `session-${i}`,
                name: `Massive Session ${i}`,
                timestamp: new Date().toISOString(),
                isLoopSession: false,
                duration: 100,
                base64: 'mockData',
                sections
            };
        });

        const onSelectSession = vi.fn();
        const onUpdateSession = vi.fn();
        const onDeleteSession = vi.fn();
        const onUpdateSection = vi.fn();
        const onOpenSplitEditor = vi.fn();

        const startTime = performance.now();

        render(
            <RecordingThread
                sessions={mockSessions}
                activeSessionId="session-0"
                onSelectSession={onSelectSession}
                onUpdateSession={onUpdateSession}
                onDeleteSession={onDeleteSession}
                onUpdateSection={onUpdateSection}
                onOpenSplitEditor={onOpenSplitEditor}
                isPlaying={false}
                currentTime={0}
                onTogglePlay={vi.fn()}
                onSeek={vi.fn()}
            />
        );

        const endTime = performance.now();
        const renderTime = endTime - startTime;

        console.log(`Render time for 50 sessions w/ 5 sections each: ${renderTime.toFixed(2)}ms`);

        // Check if rendering was relatively quick (less than 2000ms on a typical test machine)
        expect(renderTime).toBeLessThan(2000);

        // Verify elements rendered
        const massiveSessions = screen.getAllByDisplayValue(/Massive Session/);
        expect(massiveSessions.length).toBeGreaterThan(0);

        // Test an interaction
        const splitEditorButtons = screen.getAllByTitle('Split/Merge Editor');
        expect(splitEditorButtons.length).toBeGreaterThan(0);

        // Interact
        fireEvent.click(splitEditorButtons[0]);
        expect(onOpenSplitEditor).toHaveBeenCalled();
    });
});
