import { describe, it, expect } from 'vitest';
import { mapMuseResponse } from '../museSchema';

describe('mapMuseResponse', () => {
    it('successfully processes and sanitizes Gemini raw output', () => {
        const mockRawResponse = JSON.stringify({
            title: "Testing Session",
            summary: "This is a test session where we write tests.",
            segments: [
                { startTime: 0, endTime: 30, type: "conversation", label: "Intro talk", emoji: "💬", summary: "Talking about testing." },
                { startTime: 30, endTime: 70, type: "freestyle", label: "Improvising", emoji: "🎤", summary: "Improvising over beat.", isHighlight: true },
                { startTime: 70, endTime: 60, type: "take", label: "Inverted segment", emoji: "❌", summary: "This is inverted." },
                { startTime: 70, endTime: 120, type: "unknown-type-here", label: "Unknown segment", emoji: "❓", summary: "Coerced to downtime." }
            ],
            highlights: [
                { startTime: 45, reason: "Dope freestyle take" }
            ]
        });

        const result = mapMuseResponse(mockRawResponse, 120);

        expect(result.recap.title).toBe("Testing Session");
        expect(result.recap.summary).toBe("This is a test session where we write tests.");
        
        // 3 valid segments remain (inverted is dropped)
        expect(result.segments).toHaveLength(3);
        
        // Check sorting
        expect(result.segments[0].startTime).toBe(0);
        expect(result.segments[1].startTime).toBe(30);
        
        // Check coercion
        expect(result.segments[2].type).toBe("downtime");

        // Check highlight assignment
        expect(result.recap.highlights).toHaveLength(1);
        expect(result.recap.highlights[0].segmentId).toBe(result.segments[1].id);
        expect(result.recap.highlights[0].startTime).toBe(45);
        expect(result.recap.highlights[0].reason).toBe("Dope freestyle take");

        // Check stats calculation (round to nearest int)
        expect(result.recap.stats.conversation).toBe(30);
        expect(result.recap.stats.freestyle).toBe(40);
        expect(result.recap.stats.downtime).toBe(50);
    });
});
