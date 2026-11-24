/**
 * Rhyme Detection Engine
 * Phonetic rime extraction and dictionary for real-time songwriting rhyme highlighting.
 */

// Curated high-precision phoneme rimes for songwriting vocabulary
const PHONETIC_RIME_DICT: Record<string, string> = {
  // /aɪt/
  light: 'R_AIT', night: 'R_AIT', bright: 'R_AIT', sight: 'R_AIT', fight: 'R_AIT',
  tight: 'R_AIT', flight: 'R_AIT', knight: 'R_AIT', white: 'R_AIT', bite: 'R_AIT',
  kite: 'R_AIT', spite: 'R_AIT', write: 'R_AIT', midnight: 'R_AIT', tonight: 'R_AIT',
  right: 'R_AIT', alright: 'R_AIT', height: 'R_AIT',

  // /eɪ/
  day: 'R_EI', away: 'R_EI', say: 'R_EI', play: 'R_EI', stay: 'R_EI',
  may: 'R_EI', way: 'R_EI', pray: 'R_EI', grey: 'R_EI', gray: 'R_EI',
  lay: 'R_EI', pay: 'R_EI', today: 'R_EI', delay: 'R_EI', display: 'R_EI',

  // /iː/
  see: 'R_EE', sea: 'R_EE', free: 'R_EE', tree: 'R_EE', be: 'R_EE',
  me: 'R_EE', we: 'R_EE', he: 'R_EE', she: 'R_EE', key: 'R_EE',
  flee: 'R_EE', agree: 'R_EE', knee: 'R_EE', plea: 'R_EE', glee: 'R_EE',
  destiny: 'R_EE', memory: 'R_EE', energy: 'R_EE', melody: 'R_EE', symphony: 'R_EE',

  // /oʊ/
  go: 'R_OH', know: 'R_OH', slow: 'R_OH', glow: 'R_OH', flow: 'R_OH',
  show: 'R_OH', blow: 'R_OH', grow: 'R_OH', throw: 'R_OH', low: 'R_OH',
  snow: 'R_OH', though: 'R_OH', shadow: 'R_OH', window: 'R_OH', below: 'R_OH',

  // /uː/
  you: 'R_OO', through: 'R_OO', true: 'R_OO', blue: 'R_OO', new: 'R_OO',
  knew: 'R_OO', too: 'R_OO', to: 'R_OO', do: 'R_OO', clue: 'R_OO',
  crew: 'R_OO', flew: 'R_OO', view: 'R_OO', review: 'R_OO', due: 'R_OO',

  // /aɪ/
  sky: 'R_AI', fly: 'R_AI', high: 'R_AI', die: 'R_AI', why: 'R_AI',
  cry: 'R_AI', try: 'R_AI', my: 'R_AI', lie: 'R_AI', tie: 'R_AI',
  goodbye: 'R_AI', deny: 'R_AI', reply: 'R_AI', supply: 'R_AI', bye: 'R_AI',

  // /aʊnd/
  sound: 'R_OUND', round: 'R_OUND', ground: 'R_OUND', bound: 'R_OUND', found: 'R_OUND',
  around: 'R_OUND', drowned: 'R_OUND', profound: 'R_OUND',

  // /eɪn/
  rain: 'R_EIN', pain: 'R_EIN', chain: 'R_EIN', brain: 'R_EIN', plane: 'R_EIN',
  lane: 'R_EIN', stain: 'R_EIN', remain: 'R_EIN', explain: 'R_EIN', vein: 'R_EIN',
  main: 'R_EIN', gain: 'R_EIN', drain: 'R_EIN', train: 'R_EIN', insane: 'R_EIN',

  // /aɪn/
  line: 'R_AIN', fine: 'R_AIN', shine: 'R_AIN', mine: 'R_AIN', sign: 'R_AIN',
  wine: 'R_AIN', divine: 'R_AIN', refine: 'R_AIN', design: 'R_AIN', decline: 'R_AIN',

  // /ɑːrt/
  heart: 'R_ART', part: 'R_ART', start: 'R_ART', dart: 'R_ART', apart: 'R_ART',
  smart: 'R_ART', art: 'R_ART', chart: 'R_ART',

  // /aɪər/
  fire: 'R_IRE', higher: 'R_IRE', wire: 'R_IRE', desire: 'R_IRE', tire: 'R_IRE',
  admire: 'R_IRE', choir: 'R_IRE', inspire: 'R_IRE', entire: 'R_IRE',

  // /oʊld/
  cold: 'R_OLD', hold: 'R_OLD', gold: 'R_OLD', bold: 'R_OLD', told: 'R_OLD',
  fold: 'R_OLD', sold: 'R_OLD', old: 'R_OLD', behold: 'R_OLD', untold: 'R_OLD',

  // /iːp/
  deep: 'R_EEP', sleep: 'R_EEP', keep: 'R_EEP', weep: 'R_EEP', creep: 'R_EEP',
  steep: 'R_EEP', leap: 'R_EEP', sweep: 'R_EEP', reap: 'R_EEP',

  // /ɛst/
  best: 'R_EST', rest: 'R_EST', west: 'R_EST', chest: 'R_EST', nest: 'R_EST',
  test: 'R_EST', quest: 'R_EST', blessed: 'R_EST', stressed: 'R_EST', confessed: 'R_EST',

  // /ɪŋ/
  sing: 'R_ING', ring: 'R_ING', king: 'R_ING', wing: 'R_ING', spring: 'R_ING',
  bring: 'R_ING', thing: 'R_ING', sting: 'R_ING', cling: 'R_ING',

  // /ɔːl/
  all: 'R_ALL', fall: 'R_ALL', call: 'R_ALL', tall: 'R_ALL', ball: 'R_ALL',
  wall: 'R_ALL', small: 'R_ALL', stall: 'R_ALL', crawl: 'R_ALL',

  // /aɪm/
  time: 'R_IME', rhyme: 'R_IME', climb: 'R_IME', prime: 'R_IME', chime: 'R_IME',
  crime: 'R_IME', dime: 'R_IME', sublime: 'R_IME', lifetime: 'R_IME',

  // /iːm/
  dream: 'R_EEM', stream: 'R_EEM', beam: 'R_EEM', scream: 'R_EEM', theme: 'R_EEM',
  seem: 'R_EEM', team: 'R_EEM', gleam: 'R_EEM', supreme: 'R_EEM',

  // /ɛd/
  bed: 'R_ED', red: 'R_ED', said: 'R_ED', dead: 'R_ED', head: 'R_ED',
  lead: 'R_ED', fed: 'R_ED', bled: 'R_ED', thread: 'R_ED', instead: 'R_ED',

  // /eɪt/
  late: 'R_ATE', wait: 'R_ATE', fate: 'R_ATE', straight: 'R_ATE', hate: 'R_ATE',
  great: 'R_ATE', weight: 'R_ATE', gate: 'R_ATE', state: 'R_ATE', rate: 'R_ATE',
  create: 'R_ATE', date: 'R_ATE', debate: 'R_ATE', relate: 'R_ATE',

  // /aʊ/
  now: 'R_OW', how: 'R_OW', cow: 'R_OW', vow: 'R_OW', brow: 'R_OW',
  allow: 'R_OW', somehow: 'R_OW',

  // /aʊn/
  down: 'R_OWN', town: 'R_OWN', brown: 'R_OWN', drown: 'R_OWN', crown: 'R_OWN',
  frown: 'R_OWN', renown: 'R_OWN',

  // /æns/
  dance: 'R_ANCE', chance: 'R_ANCE', glance: 'R_ANCE', trance: 'R_ANCE', advance: 'R_ANCE',

  // /ʌv/
  love: 'R_OVE', above: 'R_OVE', dove: 'R_OVE', glove: 'R_OVE',

  // /ɛnd/
  end: 'R_END', friend: 'R_END', send: 'R_END', bend: 'R_END', mend: 'R_END',
  spend: 'R_END', blend: 'R_END', pretend: 'R_END', defend: 'R_END', depend: 'R_END',

  // /eɪs/
  face: 'R_ACE', place: 'R_ACE', trace: 'R_ACE', space: 'R_ACE', race: 'R_ACE',
  chase: 'R_ACE', grace: 'R_ACE', base: 'R_ACE', case: 'R_ACE', embrace: 'R_ACE',

  // /ɔːŋ/
  song: 'R_ONG', long: 'R_ONG', strong: 'R_ONG', wrong: 'R_ONG', belong: 'R_ONG',

  // /ɑːrk/
  dark: 'R_ARK', spark: 'R_ARK', mark: 'R_ARK', park: 'R_ARK', bark: 'R_ARK',

  // /ɪs/
  miss: 'R_ISS', kiss: 'R_ISS', bliss: 'R_ISS', this: 'R_ISS', abyss: 'R_ISS',

  // /aɪz/
  eyes: 'R_IZE', lies: 'R_IZE', cries: 'R_IZE', skies: 'R_IZE', wise: 'R_IZE',
  realize: 'R_IZE', disguise: 'R_IZE', rise: 'R_IZE', ties: 'R_IZE', surprise: 'R_IZE',

  // /ʌn/
  sun: 'R_UN', run: 'R_UN', one: 'R_UN', won: 'R_UN', done: 'R_UN',
  none: 'R_UN', gun: 'R_UN', begun: 'R_UN', stun: 'R_UN',

  // /iːl/
  feel: 'R_EEL', heal: 'R_EEL', real: 'R_EEL', steel: 'R_EEL', wheel: 'R_EEL',
  deal: 'R_EEL', reveal: 'R_EEL', conceal: 'R_EEL',

  // /ɛər/
  air: 'R_AIR', care: 'R_AIR', share: 'R_AIR', bear: 'R_AIR', bare: 'R_AIR',
  stare: 'R_AIR', fair: 'R_AIR', hair: 'R_AIR', there: 'R_AIR', where: 'R_AIR',
  wear: 'R_AIR', prayer: 'R_AIR', despair: 'R_AIR', declare: 'R_AIR',

  // /ɪər/
  hear: 'R_EAR', clear: 'R_EAR', fear: 'R_EAR', tear: 'R_EAR', near: 'R_EAR',
  dear: 'R_EAR', cheer: 'R_EAR', here: 'R_EAR', disappear: 'R_EAR', severe: 'R_EAR',

  // /ʊk/
  look: 'R_OOK', book: 'R_OOK', took: 'R_OOK', shook: 'R_OOK', cook: 'R_OOK', hook: 'R_OOK',

  // /ɒk/
  rock: 'R_OCK', clock: 'R_OCK', block: 'R_OCK', lock: 'R_OCK', shock: 'R_OCK', knock: 'R_OCK',

  // /æst/
  past: 'R_AST', fast: 'R_AST', last: 'R_AST', cast: 'R_AST', blast: 'R_AST',

  // /eɪv/
  save: 'R_AVE', wave: 'R_AVE', brave: 'R_AVE', crave: 'R_AVE', grave: 'R_AVE',

  // /oʊn/
  alone: 'R_ONE', stone: 'R_ONE', bone: 'R_ONE', phone: 'R_ONE', tone: 'R_ONE',
  zone: 'R_ONE', known: 'R_ONE', grown: 'R_ONE', thrown: 'R_ONE',

  // /ɜːrn/
  burn: 'R_URN', turn: 'R_URN', learn: 'R_URN', earn: 'R_URN', return: 'R_URN',

  // /ænd/
  hand: 'R_AND', stand: 'R_AND', land: 'R_AND', sand: 'R_AND', brand: 'R_AND', understand: 'R_AND',

  // /iːt/
  beat: 'R_EET', street: 'R_EET', meet: 'R_EET', feet: 'R_EET', heat: 'R_EET',
  sweet: 'R_EET', repeat: 'R_EET', treat: 'R_EET', defeat: 'R_EET',

  // /ɒp/
  stop: 'R_OP', drop: 'R_OP', top: 'R_OP', pop: 'R_OP', shop: 'R_OP', crop: 'R_OP',

  // /aʊt/
  out: 'R_OUT', shout: 'R_OUT', doubt: 'R_OUT', about: 'R_OUT', without: 'R_OUT',
};

// Distinct underline colors for each detected rhyme scheme group
const RHYME_COLOR_PALETTES = [
  'decoration-amber-400',
  'decoration-cyan-400',
  'decoration-violet-400',
  'decoration-rose-400',
  'decoration-emerald-400',
  'decoration-sky-400',
  'decoration-fuchsia-400',
  'decoration-yellow-400',
  'decoration-teal-400',
  'decoration-orange-400'
];

/**
 * Extracts normalized phonetic rhyme key from any word
 */
function getRhymeKey(word: string): string {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (clean.length < 2) return '';

  // 1. Exact dictionary match
  if (PHONETIC_RIME_DICT[clean]) {
    return PHONETIC_RIME_DICT[clean];
  }

  // 2. Common rule-based phonetic normalization for English endings
  const normalized = clean;
  if (normalized.endsWith('ight') || normalized.endsWith('ite')) return 'R_AIT';
  if (normalized.endsWith('eigh') || normalized.endsWith('ay') || normalized.endsWith('ey')) return 'R_EI';
  if (normalized.endsWith('tion') || normalized.endsWith('sion')) return 'R_SHUN';
  if (normalized.endsWith('ound')) return 'R_OUND';
  if (normalized.endsWith('eam') || normalized.endsWith('eme')) return 'R_EEM';
  if (normalized.endsWith('ain') || normalized.endsWith('ane')) return 'R_EIN';
  if (normalized.endsWith('ear') || normalized.endsWith('eer') || normalized.endsWith('ere')) return 'R_EAR';
  if (normalized.endsWith('air') || normalized.endsWith('are')) return 'R_AIR';
  if (normalized.endsWith('old')) return 'R_OLD';
  if (normalized.endsWith('art') || normalized.endsWith('eart')) return 'R_ART';
  if (normalized.endsWith('eep')) return 'R_EEP';
  if (normalized.endsWith('ack')) return 'R_ACK';
  if (normalized.endsWith('ice') || normalized.endsWith('ise')) return 'R_ICE';
  if (normalized.endsWith('ove')) return 'R_OVE';
  if (normalized.endsWith('ire') || normalized.endsWith('yri')) return 'R_IRE';
  if (normalized.endsWith('ate') || normalized.endsWith('ait') || normalized.endsWith('eight')) return 'R_ATE';
  if (normalized.endsWith('all') || normalized.endsWith('awl')) return 'R_ALL';
  if (normalized.endsWith('ing')) return 'R_ING';
  if (normalized.endsWith('est')) return 'R_EST';
  if (normalized.endsWith('ace') || normalized.endsWith('ase')) return 'R_ACE';
  if (normalized.endsWith('eed') || normalized.endsWith('ead')) return 'R_EED';
  if (normalized.endsWith('one') || normalized.endsWith('own')) return 'R_ONE';

  // 3. Fallback: Last vowel + following consonant phonetic pattern
  const match = normalized.match(/([aeiouy]+[^aeiouy]*)$/i);
  if (match && match[1].length >= 2) {
    return `GEN_${match[1]}`;
  }

  return clean.length >= 3 ? `GEN_${clean.slice(-3)}` : `GEN_${clean}`;
}

export interface RhymeWordInfo {
  word: string;
  rhymeKey: string;
  colorClass: string;
}

/**
 * Scans all typed song lyrics and finds words that have at least one rhyming counterpart
 */
export function buildRhymeWordMap(allLyricsText: string): Map<string, RhymeWordInfo> {
  const rhymeMap = new Map<string, RhymeWordInfo>();
  if (!allLyricsText || !allLyricsText.trim()) return rhymeMap;

  // Extract all individual clean words
  const rawWords = allLyricsText.match(/\b[a-zA-Z]+(?:'[a-zA-Z]+)?\b/g) || [];
  if (rawWords.length < 2) return rhymeMap;

  // Group words by rhymeKey
  const keyToWords = new Map<string, Set<string>>();

  for (const raw of rawWords) {
    const clean = raw.toLowerCase().replace(/[^a-z]/g, '');
    if (clean.length < 2) continue;

    // Filter out common minor functional words that don't add to rhyming meter
    if (['a', 'an', 'the', 'of', 'at', 'in', 'on', 'is', 'it'].includes(clean)) {
      continue;
    }

    const key = getRhymeKey(clean);
    if (!key) continue;

    if (!keyToWords.has(key)) {
      keyToWords.set(key, new Set());
    }
    keyToWords.get(key)!.add(clean);
  }

  // Filter keys that have 2 or more distinct rhyming occurrences
  let colorIndex = 0;
  for (const [key, wordSet] of keyToWords.entries()) {
    // A rhyme exists if there are 2+ distinct words, OR if the same word appears at least twice in rhyming position
    if (wordSet.size >= 2) {
      const colorClass = RHYME_COLOR_PALETTES[colorIndex % RHYME_COLOR_PALETTES.length];
      colorIndex++;

      for (const word of wordSet) {
        rhymeMap.set(word, {
          word,
          rhymeKey: key,
          colorClass
        });
      }
    } else {
      // Check if this single word occurs multiple times across the lyrics (e.g. repeated end-word)
      const singleWord = Array.from(wordSet)[0];
      const regex = new RegExp(`\\b${singleWord}\\b`, 'gi');
      const matches = allLyricsText.match(regex);
      if (matches && matches.length >= 2) {
        const colorClass = RHYME_COLOR_PALETTES[colorIndex % RHYME_COLOR_PALETTES.length];
        colorIndex++;
        rhymeMap.set(singleWord, {
          word: singleWord,
          rhymeKey: key,
          colorClass
        });
      }
    }
  }

  return rhymeMap;
}
