// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as transcribePOST } from '../transcribe-audio/route';
import { GET as healthGET } from '../health/route';
import { POST as analyzePOST } from '../analyze-beat/route';
import { POST as assistantPOST } from '../song-assistant/route';
import { resetRateLimits } from '@/lib/server/apiGuard';

const wavBody = () => new Uint8Array(2000).buffer;
const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
    new NextRequest('http://localhost/api/transcribe-audio', {
        method: 'POST',
        headers: { 'content-type': 'audio/wav', 'x-forwarded-for': '1.2.3.4', ...headers },
        body,
    });

const groqOk = (json: unknown) => new Response(JSON.stringify(json), { status: 200, headers: { 'content-type': 'application/json' } });

describe('/api/health', () => {
    const original = process.env.GROQ_API_KEY;
    afterEach(() => { if (original === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = original; });

    it('reports transcription off without a key and keeps the other features off', async () => {
        delete process.env.GROQ_API_KEY;
        const body = await (await healthGET()).json();
        expect(body).toEqual({ status: 'ok', ai: false, features: { transcription: false, arrangement: false, suggestions: false } });
    });
    it('reports transcription on with a key', async () => {
        process.env.GROQ_API_KEY = 'gsk_test';
        const body = await (await healthGET()).json();
        expect(body.ai).toBe(true);
        expect(body.features).toMatchObject({ transcription: true, arrangement: false });
    });
});

describe('stub routes', () => {
    it('analyze-beat and song-assistant say unavailable with the client\'s error envelope', async () => {
        for (const res of [await analyzePOST(), await assistantPOST()]) {
            expect(res.status).toBe(503);
            const body = await res.json();
            expect(body.error).toBe('ai_unavailable');
            expect(typeof body.message).toBe('string');
        }
    });
});

describe('/api/transcribe-audio', () => {
    const original = process.env.GROQ_API_KEY;
    beforeEach(() => { resetRateLimits(); process.env.GROQ_API_KEY = 'gsk_test'; });
    afterEach(() => {
        vi.unstubAllGlobals();
        if (original === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = original;
    });

    it('503 ai_unavailable when no key is configured', async () => {
        delete process.env.GROQ_API_KEY;
        const res = await transcribePOST(post(wavBody()));
        expect(res.status).toBe(503);
        expect((await res.json()).error).toBe('ai_unavailable');
    });

    it('400 on an empty body, 413 on an oversized one', async () => {
        expect((await transcribePOST(post(new Uint8Array(0)))).status).toBe(400);
        const big = new Uint8Array(12_000_001);
        const res = await transcribePOST(post(big));
        expect(res.status).toBe(413);
        expect((await res.json()).error).toBe('audio_too_large');
    });

    it('sends the audio to Groq with word timestamps, language and the lyrics hint, and returns timed lines', async () => {
        const fetchMock = vi.fn().mockResolvedValue(groqOk({
            text: 'walking home tonight',
            segments: [{ text: ' walking home tonight', start: 0, end: 5 }],
            words: [{ word: ' walking', start: 1, end: 1.4 }, { word: ' home', start: 1.5, end: 1.8 }, { word: ' tonight', start: 1.9, end: 2.5 }],
        }));
        vi.stubGlobal('fetch', fetchMock);
        const lyrics = Buffer.from('Walking home tonight\nChasing every light', 'utf8').toString('base64');
        const res = await transcribePOST(post(wavBody(), { 'x-audio-duration-sec': '6', 'x-written-lyrics-b64': lyrics }));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ lines: [{ text: 'walking home tonight', startSec: 1, endSec: 2.5 }] });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gsk_test');
        const form = init.body as FormData;
        expect(form.get('model')).toBe('whisper-large-v3-turbo');
        expect(form.get('response_format')).toBe('verbose_json');
        expect(form.getAll('timestamp_granularities[]')).toEqual(['word', 'segment']);
        expect(form.get('language')).toBe('en');
        expect(form.get('prompt')).toBe('Walking home tonight Chasing every light');
        expect(form.get('file')).toBeInstanceOf(Blob);
    });

    it('omits the prompt when no lyrics were written', async () => {
        const fetchMock = vi.fn().mockResolvedValue(groqOk({ segments: [] }));
        vi.stubGlobal('fetch', fetchMock);
        await transcribePOST(post(wavBody()));
        expect((fetchMock.mock.calls[0][1].body as FormData).has('prompt')).toBe(false);
    });

    it('returns an empty list when nothing intelligible was heard', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(groqOk({ text: '', segments: [] })));
        const res = await transcribePOST(post(wavBody()));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ lines: [] });
    });

    it.each([
        [429, 429, 'rate_limited'],
        [413, 413, 'audio_too_large'],
        [400, 422, 'unprocessable_audio'],
        [401, 502, 'upstream_auth'],
        [500, 503, 'service_busy'],
    ])('maps a Groq %i to our %i %s', async (groqStatus, ours, code) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'boom' } }), { status: groqStatus })));
        const res = await transcribePOST(post(wavBody()));
        expect(res.status).toBe(ours);
        expect((await res.json()).error).toBe(code);
    });

    it('never leaks the API key in an error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'bad key gsk_test' } }), { status: 401 })));
        const res = await transcribePOST(post(wavBody()));
        expect(JSON.stringify(await res.json())).not.toContain('gsk_test');
    });

    it('504 when Groq times out, 502 when it is unreachable', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('t', 'TimeoutError')));
        expect((await transcribePOST(post(wavBody()))).status).toBe(504);
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
        expect((await transcribePOST(post(wavBody()))).status).toBe(502);
    });

    it('rate-limits a flood from one address, but not another', async () => {
        vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(groqOk({ segments: [] }))));
        let last = 200;
        for (let i = 0; i < 31; i++) last = (await transcribePOST(post(wavBody()))).status;
        expect(last).toBe(429);
        const other = await transcribePOST(post(wavBody(), { 'x-forwarded-for': '9.9.9.9' }));
        expect(other.status).toBe(200);
    });
});
