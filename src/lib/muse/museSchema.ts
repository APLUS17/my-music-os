import { MuseSegment, MuseRecap, MuseSegmentType } from '@/types';

export const MUSE_MODEL = 'gemini-flash-latest';

export const museResponseSchema = {
    type: 'OBJECT',
    properties: {
        title: {
            type: 'STRING',
            description: 'A brief, creative title for the studio session (max 8 words).'
        },
        summary: {
            type: 'STRING',
            description: 'A 3 to 5 sentence summary of the session flow, key moments, and overall energy.'
        },
        segments: {
            type: 'ARRAY',
            description: 'Contiguous, non-overlapping segments covering the entire timeline.',
            items: {
                type: 'OBJECT',
                properties: {
                    startTime: {
                        type: 'NUMBER',
                        description: 'Start time of the segment in seconds (from the beginning of the audio).'
                    },
                    endTime: {
                        type: 'NUMBER',
                        description: 'End time of the segment in seconds.'
                    },
                    type: {
                        type: 'STRING',
                        enum: ['freestyle', 'take', 'conversation', 'idea', 'practicing', 'playback', 'planning', 'downtime'],
                        description: 'Type classification of the segment.'
                    },
                    label: {
                        type: 'STRING',
                        description: 'A short descriptive label for the segment (max 6 words).'
                    },
                    emoji: {
                        type: 'STRING',
                        description: 'A relevant emoji representing the segment action.'
                    },
                    summary: {
                        type: 'STRING',
                        description: '1 to 2 sentence summary of what happened during this segment.'
                    },
                    quote: {
                        type: 'STRING',
                        description: 'Optional memorable quote or lyric line voiced during the segment.'
                    },
                    isHighlight: {
                        type: 'BOOLEAN',
                        description: 'Set to true if this segment is a key highlight/spark of the session.'
                    }
                },
                required: ['startTime', 'endTime', 'type', 'label', 'emoji', 'summary']
            }
        },
        highlights: {
            type: 'ARRAY',
            description: 'List of 3 to 6 key highlight moments.',
            items: {
                type: 'OBJECT',
                properties: {
                    startTime: {
                        type: 'NUMBER',
                        description: 'The start timestamp of the highlighted moment.'
                    },
                    reason: {
                        type: 'STRING',
                        description: 'A brief explanation of why this moment is highlighted.'
                    }
                },
                required: ['startTime', 'reason']
            }
        }
    },
    required: ['title', 'summary', 'segments', 'highlights']
};

export interface MuseResponseRaw {
    title: string;
    summary: string;
    segments: {
        startTime: number;
        endTime: number;
        type: string;
        label: string;
        emoji: string;
        summary: string;
        quote?: string;
        isHighlight?: boolean;
    }[];
    highlights: {
        startTime: number;
        reason: string;
    }[];
}

export function buildMusePrompt(durationSec: number): string {
    return `You are Muse, an automatic studio-session logger and creative assistant.
Analyze this audio recording of a music studio session. The total duration is ${durationSec} seconds.

Your main goal is to segment the ENTIRE timeline into contiguous, non-overlapping segments.
Each segment must be classified as one of these 8 types:
1. 'freestyle': Improvised rapping, singing, or vocalizing over a beat or instrument.
2. 'take': Deliberate, structured attempts at performing a known part, hook, or verse.
3. 'idea': A newly conceived melody, hummed concept, lyric snippet, or song idea voiced aloud.
4. 'practicing': Rehearsal, warm-ups, practicing scales, chord changes, or vocal exercises.
5. 'playback': Listening back to an instrumental beat or a recorded track with NO vocal performance.
6. 'planning': Discussions about song arrangement, production, mix notes, or next creative steps.
7. 'conversation': General talk, banter, sharing stories, or studio chatter.
8. 'downtime': Silence, tuning instruments, checking cables, noise, or inactive breaks.

Segmentation Rules:
- The segments MUST cover the entire timeline from 0 to ${durationSec} seconds with no gaps.
- Segments must be contiguous and non-overlapping.
- Try to merge very short segments (e.g. under 20 seconds) into their surrounding context to avoid excessive fragmentation.
- Provide descriptive labels (maximum 6 words) and a relevant emoji for each segment.
- Write a 1-2 sentence summary of what happened. If memorable lines or quotes were spoken or sung, capture them in the 'quote' field.
- Highlight 3-6 key moments of inspiration, breakthrough takes, or great ideas by setting 'isHighlight' to true on those segments, and also list them in the 'highlights' array with their exact start timestamps.
- Provide a creative title (maximum 8 words) and a 3-5 sentence overall summary describing the session's narrative arc and energy.`;
}

export function mapMuseResponse(rawJson: string, durationSec: number) {
    let parsed: MuseResponseRaw;
    try {
        parsed = JSON.parse(rawJson);
    } catch (e) {
        throw new Error('Failed to parse Gemini response: ' + (e as Error).message);
    }

    const title = parsed.title || 'Studio Session';
    const recapSummary = parsed.summary || 'A studio session.';

    const validTypes: Set<MuseSegmentType> = new Set([
        'freestyle', 'take', 'conversation', 'idea',
        'practicing', 'playback', 'planning', 'downtime'
    ]);

    const segmentsRaw = parsed.segments || [];
    
    // Sort by startTime
    segmentsRaw.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

    const sanitizedSegments: MuseSegment[] = [];

    segmentsRaw.forEach((seg, idx) => {
        let start = Number(seg.startTime);
        let end = Number(seg.endTime);

        if (isNaN(start) || isNaN(end)) return;
        if (start < 0) start = 0;
        if (end > durationSec) end = durationSec;
        if (start >= end) return; // Drop inverted/zero-length segments

        const rawType = seg.type as MuseSegmentType;
        const type: MuseSegmentType = validTypes.has(rawType) ? rawType : 'downtime';
        
        const id = `seg_${Math.random().toString(36).substring(2, 9)}_${idx}`;

        sanitizedSegments.push({
            id,
            startTime: Math.round(start * 100) / 100,
            endTime: Math.round(end * 100) / 100,
            type,
            label: (seg.label || `${type} segment`).slice(0, 100),
            emoji: seg.emoji || '🎵',
            summary: seg.summary || '',
            quote: seg.quote,
            isHighlight: !!seg.isHighlight
        });
    });

    const rawHighlights = parsed.highlights || [];
    const sanitizedHighlights: MuseRecap['highlights'] = [];

    rawHighlights.forEach((hl) => {
        const start = Number(hl.startTime);
        if (isNaN(start)) return;
        
        let containingSegId = '';
        let minDistance = Infinity;
        let closestSegId = '';

        for (const seg of sanitizedSegments) {
            if (start >= seg.startTime && start <= seg.endTime) {
                containingSegId = seg.id;
                break;
            }
            const dist = Math.min(Math.abs(start - seg.startTime), Math.abs(start - seg.endTime));
            if (dist < minDistance) {
                minDistance = dist;
                closestSegId = seg.id;
            }
        }

        const segmentId = containingSegId || closestSegId;
        if (segmentId) {
            sanitizedHighlights.push({
                segmentId,
                startTime: start,
                reason: hl.reason || 'Key moment'
            });
        }
    });

    const stats: Partial<Record<MuseSegmentType, number>> = {};
    sanitizedSegments.forEach((seg) => {
        const duration = seg.endTime - seg.startTime;
        if (duration > 0) {
            stats[seg.type] = (stats[seg.type] || 0) + duration;
        }
    });

    Object.keys(stats).forEach((k) => {
        const key = k as MuseSegmentType;
        if (stats[key] !== undefined) {
            stats[key] = Math.round(stats[key]!);
        }
    });

    const recap: MuseRecap = {
        title,
        summary: recapSummary,
        highlights: sanitizedHighlights,
        stats,
        generatedAt: new Date().toISOString(),
        model: MUSE_MODEL
    };

    return {
        segments: sanitizedSegments,
        recap
    };
}
