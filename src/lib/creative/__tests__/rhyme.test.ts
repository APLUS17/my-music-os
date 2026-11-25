import { describe, it, expect } from 'vitest';
import { buildRhymeWordMap } from '../rhyme';

describe('buildRhymeWordMap', () => {
    it('groups words that rhyme and gives each group its own color', () => {
        const map = buildRhymeWordMap('I walk alone tonight\nChasing the city light\nRain on the glass\nPain in the past');
        expect(map.get('tonight')?.rhymeKey).toBe(map.get('light')?.rhymeKey);
        expect(map.get('rain')?.rhymeKey).toBe(map.get('pain')?.rhymeKey);
        expect(map.get('tonight')?.colorClass).not.toBe(map.get('rain')?.colorClass);
    });

    it('does not flag words that rhyme with nothing', () => {
        const map = buildRhymeWordMap('Banana window staple\nGlow tonight');
        expect(map.has('banana')).toBe(false);
    });

    it('catches rhymes the dictionary does not know via suffix rules', () => {
        const map = buildRhymeWordMap('Flashing neon\nWaiting for the sun\nHoping nothing\nLoving anyone');
        // -ing endings group together
        expect(map.get('flashing')?.rhymeKey).toBe(map.get('hoping')?.rhymeKey);
    });

    it('flags a repeated word even when it has no rhyming partner', () => {
        const map = buildRhymeWordMap('Mountain high\nMountain low\nMountain deep');
        expect(map.has('mountain')).toBe(true);
    });

    it('is case-insensitive and ignores punctuation', () => {
        const map = buildRhymeWordMap('Night!\nLIGHT,');
        expect(map.get('night')?.rhymeKey).toBe(map.get('light')?.rhymeKey);
    });

    it('handles empty and tiny input', () => {
        expect(buildRhymeWordMap('').size).toBe(0);
        expect(buildRhymeWordMap('   ').size).toBe(0);
        expect(buildRhymeWordMap('hello').size).toBe(0);
    });

    it('keeps contractions as one word', () => {
        const map = buildRhymeWordMap("Don't wait\nIt's late");
        expect(map.get('wait')?.rhymeKey).toBe(map.get('late')?.rhymeKey);
    });
});
