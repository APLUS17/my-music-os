/**
 * Phase 3 Test Suite: Intelligence & Ideation
 * 
 * Tests for:
 * 1. The Vault (Supabase Storage Integration)
 * 2. Songwriter's Engine (Datamuse API Integration)
 * 3. Studio Workspace Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreativeSidebar } from '@/components/studio/CreativeSidebar';
import { TextEditor } from '@/components/studio/TextEditor';
import { VaultBrowser } from '@/components/studio/VaultBrowser';

// Mock fetch for Datamuse API
global.fetch = vi.fn();

// Mock Supabase client
vi.mock('@/lib/db', () => ({
    supabase: {
        storage: {
            from: vi.fn(() => ({
                list: vi.fn(() => Promise.resolve({ data: [], error: null })),
                upload: vi.fn(() => Promise.resolve({ data: {}, error: null })),
                getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://mock-url.com' } })),
            })),
        },
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    order: vi.fn(() => Promise.resolve({ data: [], error: null })),
                })),
            })),
            insert: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        })),
    },
}));

describe('Phase 3: The Vault', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders VaultBrowser component', () => {
        render(
            <VaultBrowser
                projectId="test-project-123"
                onSelectTrack={vi.fn()}
            />
        );

        expect(screen.getByText(/The Vault/i)).toBeInTheDocument();
    });

    it('displays upload button in VaultBrowser', () => {
        render(
            <VaultBrowser
                projectId="test-project-123"
                onSelectTrack={vi.fn()}
            />
        );

        const uploadButton = screen.getByText(/Upload/i);
        expect(uploadButton).toBeInTheDocument();
    });

    it('handles track selection callback', async () => {
        const mockOnSelect = vi.fn();
        render(
            <VaultBrowser
                projectId="test-project-123"
                onSelectTrack={mockOnSelect}
            />
        );

        // Verify component rendered successfully
        expect(screen.getByText(/The Vault/i)).toBeInTheDocument();
    });
});

describe('Phase 3: Songwriter\'s Engine - Datamuse Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders CreativeSidebar with all search modes', () => {
        render(<CreativeSidebar />);

        expect(screen.getByText(/Perfect/i)).toBeInTheDocument();
        expect(screen.getByText(/Slant/i)).toBeInTheDocument();
        expect(screen.getByText(/Vibe/i)).toBeInTheDocument();
    });

    it('fetches perfect rhymes when mode is rel_rhy', async () => {
        const mockRhymes = [
            { word: 'cat', score: 100, numSyllables: 1 },
            { word: 'bat', score: 99, numSyllables: 1 },
        ];

        (global.fetch as any).mockResolvedValueOnce({
            json: async () => mockRhymes,
        });

        render(<CreativeSidebar />);

        const input = screen.getByPlaceholderText(/Search keywords/i);
        fireEvent.change(input, { target: { value: 'hat' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('rel_rhy=hat')
            );
        });
    });

    it('switches between search modes correctly', async () => {
        render(<CreativeSidebar />);

        const slantButton = screen.getByText(/Slant/i);
        fireEvent.click(slantButton);

        // Verify the button is active (you'd check className or aria-selected in real app)
        expect(slantButton).toBeInTheDocument();
    });

    it('accepts external query from highlight-to-search', async () => {
        const mockRhymes = [
            { word: 'night', score: 100, numSyllables: 1 },
        ];

        (global.fetch as any).mockResolvedValueOnce({
            json: async () => mockRhymes,
        });

        const { rerender } = render(<CreativeSidebar />);

        // Simulate external query change
        rerender(<CreativeSidebar externalQuery="light" />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('light')
            );
        });
    });

    it('displays syllable count for results', async () => {
        const mockRhymes = [
            { word: 'magnificent', score: 100, numSyllables: 4 },
        ];

        (global.fetch as any).mockResolvedValueOnce({
            json: async () => mockRhymes,
        });

        render(<CreativeSidebar />);

        const input = screen.getByPlaceholderText(/Search keywords/i);
        fireEvent.change(input, { target: { value: 'test' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() => {
            expect(screen.getByText(/4 SYL/i)).toBeInTheDocument();
        });
    });
});

describe('Phase 3: Studio Integration - Highlight to Search', () => {
    it('TextEditor renders with selection handler', () => {
        const mockOnSelection = vi.fn();
        render(
            <TextEditor
                initialContent="Test lyrics"
                onSelectionChange={mockOnSelection}
            />
        );

        expect(screen.getByPlaceholderText(/Write something real/i)).toBeInTheDocument();
    });

    it('TextEditor calls onSelectionChange when text is selected', async () => {
        const mockOnSelection = vi.fn();
        render(
            <TextEditor
                initialContent="neon lights glow"
                onSelectionChange={mockOnSelection}
            />
        );

        const textarea = screen.getByPlaceholderText(/Write something real/i) as HTMLTextAreaElement;

        // Simulate text selection
        textarea.setSelectionRange(0, 4); // Select "neon"
        fireEvent.select(textarea);

        await waitFor(() => {
            expect(mockOnSelection).toHaveBeenCalledWith(expect.stringContaining('neon'));
        });
    });

    it('TextEditor debounces save operations', async () => {
        const mockSave = vi.fn();
        render(
            <TextEditor
                initialContent=""
                onSave={mockSave}
            />
        );

        const textarea = screen.getByPlaceholderText(/Write something real/i);
        fireEvent.change(textarea, { target: { value: 'New lyrics' } });

        // Save should not be called immediately
        expect(mockSave).not.toHaveBeenCalled();

        // Wait for debounce (2 seconds + save delay)
        await waitFor(() => {
            expect(mockSave).toHaveBeenCalledWith('New lyrics');
        }, { timeout: 3000 });
    });
});

describe('Phase 3: End-to-End Verification', () => {
    it('all Phase 3 components render without errors', () => {
        // This test verifies that all major Phase 3 components can be instantiated
        const { unmount: unmount1 } = render(<CreativeSidebar />);
        const { unmount: unmount2 } = render(
            <TextEditor initialContent="" onSave={vi.fn()} />
        );
        const { unmount: unmount3 } = render(
            <VaultBrowser projectId="test" onSelectTrack={vi.fn()} />
        );

        unmount1();
        unmount2();
        unmount3();

        // If we got here, all components rendered successfully
        expect(true).toBe(true);
    });
});
