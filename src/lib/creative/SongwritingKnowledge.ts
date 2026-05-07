// SongwritingKnowledge.ts
// Codified from: Creative Foundations Vol.2, Write Songs That Work, 100+ Songstarter Prompts
// by SongwriterCore / soundbyayo@gmail.com

export type EngineId = 'spark' | 'feeling' | 'fracture' | 'word' | 'hook';
export type StageId = 'curation' | 'generation' | 'development' | 'review' | 'optimization';
export type AppView = 'flow' | 'write' | 'puzzle' | 'rituals' | 'player';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface Stage {
  id: StageId;
  name: string;
  description: string;
  quickWins: string[];
}

export interface Exercise {
  title: string;
  prompt: string;
  inputLabels?: string[];
}

export interface Method {
  id: string;
  name: string;
  engine: EngineId;
  tagline: string;
  formula: string;
  when: string;
  exercises: Exercise[];
}

export interface MethodGroup {
  engine: EngineId;
  label: string;
  useWhen: string;
  methods: Method[];
}

export interface PromptCategory {
  id: string;
  label: string;
  prompts: string[];
}

// ─── THE 5 STAGES OF THE MUSICAL CREATIVE PROCESS ────────────────────────────
// Source: Creative Foundations Vol.2

export const MUSICAL_CREATIVE_PROCESS: Stage[] = [
  {
    id: 'curation',
    name: 'Idea Curation',
    description: 'Before you create, you collect and curate. Organize inspiration, build Reference Stacks, tag samples, study what moves you. Fuel matters.',
    quickWins: [
      'Reference Stack: Choose 5 tracks and tag what each offers (groove, harmony, arrangement, tone, texture)',
      'Sound Vault: Organize your top 10 drum one-shots, FX, and synth patches into go-to folders',
      'Inspiration Playlist: Go on a drive or put on headphones, hit shuffle, create a playlist of music that inspires you to create',
    ],
  },
  {
    id: 'generation',
    name: 'Idea Generation',
    description: 'Your sketching phase. No pressure. Just output. The more ideas you generate, the better your instincts become.',
    quickWins: [
      '3 Ideas in 30: Set a timer and create 3 eight-bar loops in 30 mins without editing — just move',
      'Minimal Toolkit: Start a project with just 1 synth, 1 drum rack, 3 FX plugins — creativity loves constraints',
      'Sample Flip: Grab or record a random sample and make something out of it in under 20 minutes',
    ],
  },
  {
    id: 'development',
    name: 'Idea Development',
    description: 'This is where loops become songs. You structure, arrange, expand. Focus on tension, flow, and emotional pacing.',
    quickWins: [
      'The 4C Framework: Copy your loop across your project for 4 minutes, then Cut, Carve, and Connect the sections',
      'Arrangement Borrow: Use a proven song structure from a song you love as a guide, then customize it',
      'Ruthlessly Cut: Ask yourself "Does this sound have a purpose?" If not, cut it',
    ],
  },
  {
    id: 'review',
    name: 'Idea Review',
    description: 'You zoom out. You listen objectively. You remove friction and refine what matters. This is where your signature sound gets shaped.',
    quickWins: [
      'One Sit Listen: No tweaking allowed. Just listen. Then take honest notes with timestamps',
      '3 Questions: What do I love? What feels off? What\'s missing?',
      'Phone Test: Bounce to MP3, listen on your phone — if it works there, it works anywhere',
    ],
  },
  {
    id: 'optimization',
    name: 'Process Optimization',
    description: 'You build the rituals, time blocks, and workflows that keep the whole machine running. This is the difference between short bursts and long-term momentum.',
    quickWins: [
      'Block Sessions: Schedule two 1-hour focused sessions next week, protect them at all costs',
      'Default Workflow: Set up your DAW template and warm-up ritual — make it easy to begin',
      'Track Your Output: Keep a journal or spreadsheet. Track sketches, hours, and completions. Make progress visible.',
    ],
  },
];

// ─── THE 25 SONGWRITING METHODS ──────────────────────────────────────────────
// Source: Write Songs That Work by SongwriterCore

export const SONGWRITING_METHODS: MethodGroup[] = [
  {
    engine: 'spark',
    label: 'The Spark Engine',
    useWhen: 'You have no core idea, feel blank before writing, or need a starting concept',
    methods: [
      {
        id: 'inspiration-banking',
        name: 'Inspiration Banking',
        engine: 'spark',
        tagline: 'Build a concrete concept from a formula before you write a single word',
        formula: '(Genre) + (Aesthetic) + (Emotion) + (Search Term) = Concrete Concept',
        when: 'You have no starting point and need to generate a concept from scratch',
        exercises: [
          {
            title: 'The Concept Builder',
            prompt: 'Fill in each slot to generate a concrete song concept. Be specific — not "sad" but "that hollow feeling the morning after".',
            inputLabels: ['Genre', 'Aesthetic / Visual', 'Core Emotion', 'Search Term / Image', 'Your Concept'],
          },
        ],
      },
      {
        id: 'angle-shaping',
        name: 'The Angle Shaping',
        engine: 'spark',
        tagline: 'Lock in ONE distinct perspective or POV before you write a single line',
        formula: 'Pick ONE angle: First Person (I), Second Person (you), Third Person (they/she/he), or Observer — then commit to it for the whole song',
        when: 'You have a topic but your lyrics feel unfocused or shifting between perspectives',
        exercises: [
          {
            title: 'The POV Audit',
            prompt: 'Write your topic in 1 sentence. Then rewrite it from 3 different angles (I, You, Observer). Circle the version that feels most visceral and honest.',
            inputLabels: ['Topic sentence', 'Angle 1 — First Person (I)', 'Angle 2 — Second Person (You)', 'Angle 3 — Observer (They/She/He)', 'Chosen angle and why'],
          },
        ],
      },
      {
        id: 'stream-of-consciousness',
        name: 'Stream of Consciousness',
        engine: 'spark',
        tagline: 'Bypass the inner critic by writing nonstop from a trigger word for 3-5 minutes',
        formula: 'Pick a Trigger Word or Emotion → Set a Timer for 3-5 Minutes → Write nonstop without lifting pen (no editing, no deleting)',
        when: 'You feel blocked, self-conscious, or too "in your head" to start',
        exercises: [
          {
            title: 'The Nonstop Write',
            prompt: 'Pick a trigger word below or write your own. Set a 4-minute timer. Write without stopping or editing — anything that comes out is valid raw material.',
            inputLabels: ['Trigger word (e.g. "leaving", "3am", "glass")', 'Your nonstop writing'],
          },
        ],
      },
      {
        id: 'title-first',
        name: '"Title First" Songwriting',
        engine: 'spark',
        tagline: 'Find a title that sparks curiosity or image — that becomes your theme',
        formula: 'Title → Theme → Support: Find a compelling title, define the theme it unlocks, then write everything to support that theme',
        when: 'You want direction before you start — a north star to write toward',
        exercises: [
          {
            title: 'Title Generator',
            prompt: 'Generate titles from each category. Circle the one that sparks the most imagery or curiosity.',
            inputLabels: [
              'Time-Based title (e.g. "3am", "last summer", "before sunrise")',
              'Action title (e.g. "walking away", "staying up")',
              'Visual Imagery title (e.g. "shattered glass", "shoes by the door")',
              'Question or Statement (e.g. "what if?", "never again")',
              'Single Word (a noun, verb, or adjective)',
              'Chosen title → Theme it unlocks',
            ],
          },
        ],
      },
    ],
  },
  {
    engine: 'feeling',
    label: 'The Feeling Machine',
    useWhen: 'Your lyrics feel flat, purely descriptive, or emotionally generic',
    methods: [
      {
        id: 'simile-build',
        name: 'The Simile Build',
        engine: 'feeling',
        tagline: 'Turn abstract emotion into a vivid picture with a three-layer simile',
        formula: 'Simile (Picture) → Ground (Anchor the simile to the real situation) → Texture (Add one vivid sensory detail)',
        when: 'A line feels vague or could have been written by anyone — it needs a specific image',
        exercises: [
          {
            title: 'The Three-Layer Build',
            prompt: 'Pick any emotion from your song. Build it through all three layers.',
            inputLabels: [
              'Emotion or feeling',
              'Layer 1 — Simile: "It felt like ___"',
              'Layer 2 — Ground: Connect it to your actual situation',
              'Layer 3 — Texture: Add one specific sensory detail (sound, smell, color, temperature)',
              'Combined lyric line',
            ],
          },
        ],
      },
      {
        id: 'emotion-mapping',
        name: 'The Emotion Mapping Technique',
        engine: 'feeling',
        tagline: 'Map an emotion to its body sensation, color, and memory to unlock precise language',
        formula: 'Emotion → Body sensation (where does it live?) → Color or texture → Specific memory or moment it first appeared',
        when: 'You know what you feel but can\'t find the right words to describe it',
        exercises: [
          {
            title: 'The Emotion Map',
            prompt: 'Pick the core emotion of your song and map it through each layer.',
            inputLabels: [
              'Core emotion',
              'Where do you feel it in your body?',
              'What color or texture does it have?',
              'What memory or moment does it connect to?',
              'Write one lyric line using these details',
            ],
          },
        ],
      },
      {
        id: 'emotion-driven',
        name: 'The Emotion-Driven Method',
        engine: 'feeling',
        tagline: 'Lead with feeling first — let the emotion dictate the words, not the other way around',
        formula: 'State the feeling raw → Write 10 words that live inside that feeling → Build lines from those words without forcing rhyme or structure',
        when: 'Your writing feels cerebral, calculated, or performed rather than felt',
        exercises: [
          {
            title: 'The Feeling-First Write',
            prompt: 'Name the feeling. Then list every word that lives inside it. Build from there.',
            inputLabels: [
              'The feeling (be specific — not "sad" but "that specific kind of tired that\'s actually grief")',
              '10 words that live inside this feeling',
              '3 raw lines built from those words (no forced rhyme)',
            ],
          },
        ],
      },
      {
        id: '5-senses',
        name: 'The 5 Senses Method',
        engine: 'feeling',
        tagline: 'Place the listener inside a scene by writing one concrete detail for each sense',
        formula: 'Sight + Sound + Touch + Smell + Taste → Combine 2-3 sensory details into a single lyric passage',
        when: 'A verse feels like a summary instead of a scene — the listener can\'t picture being there',
        exercises: [
          {
            title: 'The Sense Map',
            prompt: 'Pick the scene your verse takes place in. Write one specific detail for each sense.',
            inputLabels: [
              'The scene or moment',
              'Sight — what do you see?',
              'Sound — what do you hear?',
              'Touch — what do you feel physically?',
              'Smell — what\'s in the air?',
              'Taste — what\'s in your mouth / throat?',
              'Combined lyric using 2-3 of these',
            ],
          },
        ],
      },
      {
        id: 'immersion-frame',
        name: 'The Immersion Frame Method',
        engine: 'feeling',
        tagline: 'Open a song by placing the listener inside a specific moment with environmental cues',
        formula: 'Time + Place + Sensory anchor + Emotional state = A listener who feels present, not just informed',
        when: 'Your opening lines feel like a summary or announcement rather than a moment',
        exercises: [
          {
            title: 'The Opening Frame',
            prompt: 'Build an immersive opening for your song using the four elements.',
            inputLabels: [
              'Time (specific — "2:17am", "the Sunday after", "that August")',
              'Place (specific — not "my room" but "the bathroom floor with the light off")',
              'Sensory anchor (what\'s the first thing the listener experiences?)',
              'Emotional state (not told — shown through action or detail)',
              'Your opening lyric',
            ],
          },
        ],
      },
      {
        id: 'bad-guy',
        name: 'The Bad Guy',
        engine: 'feeling',
        tagline: 'Own the antagonist or morally grey position in a relationship — write from the blamed side',
        formula: 'Identify the "bad" behavior → Find the real reason behind it → Reframe it with honest, non-defensive language → Own it without apology',
        when: 'Your lyrics feel one-sided, too righteous, or lack the complexity of real human behavior',
        exercises: [
          {
            title: 'The Honest Admission',
            prompt: 'Write from the perspective of the person who "caused" the conflict. Be honest, not defensive.',
            inputLabels: [
              'The behavior you\'re owning',
              'The real reason behind it (not the excuse — the truth)',
              'How you\'d say it without defending yourself',
              'Your lyric line from the bad guy\'s POV',
            ],
          },
        ],
      },
    ],
  },
  {
    engine: 'fracture',
    label: 'The Fracture Lab',
    useWhen: 'Lyrics sound too safe, polished, performative, or like they could have been written by anyone',
    methods: [
      {
        id: 'shiny-honest',
        name: 'The Shiny/Honest Method',
        engine: 'fracture',
        tagline: 'Interrupt a sequence of glossy lines with one blunt, raw truth',
        formula: 'Write 3-4 "shiny" lines (beautiful, polished) → Insert 1 "honest" line (blunt, unfiltered, slightly uncomfortable)',
        when: 'Every line in a verse sounds equally polished — nothing has texture or grit',
        exercises: [
          {
            title: 'The Shiny/Honest Split',
            prompt: 'Write your verse with "shiny" language first. Then insert one line that\'s too honest to ignore.',
            inputLabels: [
              'Shiny line 1',
              'Shiny line 2',
              'Shiny line 3',
              'Honest line — the one that breaks the pattern (make it blunt)',
              'Shiny line 4 (optional — return to polish after the fracture)',
            ],
          },
        ],
      },
      {
        id: 'contradiction-mirror',
        name: 'The Contradiction Mirror',
        engine: 'fracture',
        tagline: 'State two opposite truths that are both real simultaneously',
        formula: 'Truth A (what you feel) + "but also" + Truth B (the contradiction) → Let both be true without resolving the tension',
        when: 'A song feels one-dimensional or emotionally neat — real feelings are usually contradictory',
        exercises: [
          {
            title: 'The Both/And',
            prompt: 'Find the contradiction inside your song\'s emotion. Write both truths without resolving them.',
            inputLabels: [
              'Truth A — what you genuinely feel',
              'Truth B — the opposite that\'s also true',
              'Lyric that holds both truths at once (don\'t resolve it)',
            ],
          },
        ],
      },
      {
        id: 'overflow-line',
        name: 'The Overflow Line',
        engine: 'fracture',
        tagline: 'Let one line run long — break the meter on purpose for emotional weight',
        formula: 'Write 3 metrically tight lines → On the 4th, let it overflow past the bar — pile words in until the feeling exhausts itself → Return to tight meter',
        when: 'Every line is the same length and the song feels too controlled or metronomic',
        exercises: [
          {
            title: 'The Overflow Write',
            prompt: 'Write 3 tight lines, then one line that breaks — let it run as long as it needs to.',
            inputLabels: [
              'Tight line 1',
              'Tight line 2',
              'Tight line 3',
              'Overflow line — let it go wherever it needs to go, no word limit',
            ],
          },
        ],
      },
      {
        id: 'hot-topic-stance',
        name: 'The Hot Topic Stance',
        engine: 'fracture',
        tagline: 'Take a bold, specific position on something people argue about — make the song a stance',
        formula: 'Pick a Hot Take → Frame it as YOUR truth, not a debate → Write lyrics that own the stance without hedging',
        when: 'A song feels too neutral, too "both sides" — you want something that makes a listener feel something specific',
        exercises: [
          {
            title: 'The Stance Finder',
            prompt: 'Choose one of the four Hot Topic formats and write your stance + the lyrics that deliver it.',
            inputLabels: [
              'Your hot stance (be specific and bold)',
              'Format: Anti-Gatekeeper / Villain Arc / Trend Reject / Boundary Flex',
              'Lyric lines that deliver the stance without hedging',
            ],
          },
        ],
      },
    ],
  },
  {
    engine: 'word',
    label: 'Word Sharpening',
    useWhen: 'A draft exists but lines don\'t land — they sound generic, flat, or like they could be anyone\'s words',
    methods: [
      {
        id: 'conversational-technique',
        name: 'The Conversational Technique',
        engine: 'word',
        tagline: 'Write what you\'d say to a friend, not what sounds like a lyric — then shape it',
        formula: 'Voice Note: say it out loud to an imaginary friend → transcribe exactly → edit for rhythm only, keep the raw language',
        when: 'Lines sound "written" — too crafted, too careful, missing the texture of how people actually speak',
        exercises: [
          {
            title: 'The Voice Note',
            prompt: 'You\'re making a voice note to your best friend. Talk about what\'s been on your mind most today related to this song. Don\'t write lyrics — write exactly what you\'d say.',
            inputLabels: ['What you\'d say to your friend (no lyric polish)', 'Best lines to pull from it'],
          },
          {
            title: 'The Question Spiral',
            prompt: 'Write a verse made entirely of questions. Each question builds on the last. You\'re not looking for answers — you\'re spiraling.',
            inputLabels: ['Question 1', 'Question 2 (builds on Q1)', 'Question 3 (goes deeper)', 'Question 4 (the one you\'re afraid to ask)'],
          },
        ],
      },
      {
        id: 'zoom-in',
        name: 'The Zoom-in Method',
        engine: 'word',
        tagline: 'Grab the one high-definition physical detail from the exact second a feeling hit',
        formula: 'Wide shot (the general feeling) → Mid shot (the situation) → Close-up (one specific, un-repeatable physical detail)',
        when: 'Lines describe feelings instead of showing them — they\'re telling, not placing you in the moment',
        exercises: [
          {
            title: 'Three-Level Zoom',
            prompt: 'Pick any emotion. Write it at three levels of specificity. Check: could someone else have written your Level 3? If yes, zoom in more.',
            inputLabels: [
              'Level 1 — Wide shot (the general feeling)',
              'Level 2 — Mid shot (the specific situation)',
              'Level 3 — Close-up (the detail only you would notice)',
            ],
          },
          {
            title: 'Camera Roll Dig',
            prompt: 'Open your phone. Pick a photo that makes you feel something you can\'t immediately name. Use it as source material.',
            inputLabels: [
              'What\'s in the photo?',
              'What were you feeling when you took it?',
              'The detail as a lyric line',
            ],
          },
        ],
      },
      {
        id: 'wishlist',
        name: 'The Wishlist',
        engine: 'word',
        tagline: 'List 10-15 things you want (tangible, intangible, weird) — circle 4-5 that fit the mood',
        formula: 'Write 10-15 wants mixing: tangible things + intangible things + feelings + specific moments + weird/unexpected ones → Circle the 4-5 that fit the song\'s mood → Build them into verse or chorus',
        when: 'A song needs texture, longing, or detail — it\'s missing the specific objects and moments of a real life',
        exercises: [
          {
            title: 'The Wishlist',
            prompt: 'Write 10-15 things you want right now. Mix the categories: real things, feelings, moments, and weird/unexpected ones. Don\'t filter.',
            inputLabels: [
              'Your wishlist (10-15 items)',
              '4-5 items that match your song\'s mood (circled)',
              'Verse or chorus built from the circled items',
            ],
          },
          {
            title: 'The Absence Stack',
            prompt: 'Think of someone or something you\'ve lost — a relationship, friendship, or version of yourself. List the small, specific, embarrassingly ordinary things that are gone now.',
            inputLabels: [
              'Who or what is gone?',
              '3-4 specific ordinary details that are gone with them',
              'Your feeling about what\'s changed (better or worse?)',
              'Verse or chorus built from these details',
            ],
          },
        ],
      },
    ],
  },
  {
    engine: 'hook',
    label: 'The Hook Factory',
    useWhen: 'A song lacks a sticky center, a memorable phrase, or a reason for the listener to replay it',
    methods: [
      {
        id: 'call-and-response',
        name: 'The Call & Response Method',
        engine: 'hook',
        tagline: 'Write a statement line and an answer line that reframes or deepens it',
        formula: 'Call (the statement — sets up the tension) → Response (the answer — doesn\'t resolve, reframes or deepens)',
        when: 'A chorus feels like a declaration without momentum — it lands but doesn\'t bounce',
        exercises: [
          {
            title: 'The Call & Response Build',
            prompt: 'Write 3 Call/Response pairs from your song\'s core tension. The Response should surprise or deepen, not just confirm the Call.',
            inputLabels: [
              'Call 1 + Response 1',
              'Call 2 + Response 2',
              'Call 3 + Response 3 (the strongest one)',
            ],
          },
        ],
      },
      {
        id: 'familiar-flip',
        name: 'The Familiar Flip',
        engine: 'hook',
        tagline: 'Take a cliché or familiar phrase and twist it into something unexpected',
        formula: 'Find a cliché → Identify what\'s true in it → Subvert the ending or reframe the assumption → The flip becomes the hook',
        when: 'A song is missing a quotable line — something that makes a listener pause and go "wait, that\'s not how it usually goes"',
        exercises: [
          {
            title: 'The Speed Round',
            prompt: 'Flip 5 clichés in 5 minutes. Set a timer — one minute per flip. Write the first twist that comes to mind.',
            inputLabels: [
              '"What goes around comes around" → flip:',
              '"Love conquers all" → flip:',
              '"Money can\'t buy happiness" → flip:',
              '"Better late than never" → flip:',
              '"The grass is greener" → flip:',
              'Best flip to use as a hook',
            ],
          },
        ],
      },
      {
        id: 'escape-plan',
        name: 'The Escape Plan',
        engine: 'hook',
        tagline: 'Give the listener a fantasy exit from the song\'s emotional situation',
        formula: 'Identify the emotional trap of the song → Write the fantasy alternative the listener secretly wants → Frame it as a hook that acknowledges both the reality and the escape',
        when: 'A song is emotionally heavy — the listener needs a moment of release or fantasy before the weight returns',
        exercises: [
          {
            title: 'The Fantasy Frame',
            prompt: 'What\'s the emotional situation the song is stuck in? Write the escape version — the fantasy that lives in the listener\'s head.',
            inputLabels: [
              'The emotional situation (what the song is stuck in)',
              'The escape fantasy (what the listener secretly wants)',
              'The hook line that holds both the reality and the fantasy',
            ],
          },
        ],
      },
      {
        id: 'loaded-question',
        name: 'The Loaded Question',
        engine: 'hook',
        tagline: 'End a hook with a question that lands like a punchline — unanswered on purpose',
        formula: 'Build emotional tension → Release it into a question that the listener feels, not a question that needs an answer → The silence after the question is the hook',
        when: 'A chorus or hook feels like a statement that ends too neatly — no tension lingers after it',
        exercises: [
          {
            title: 'The Question Hook',
            prompt: 'Write 3 versions of a question that could end your hook. It should land like a punchline. Leave it unanswered.',
            inputLabels: [
              'Question version 1',
              'Question version 2 (more specific)',
              'Question version 3 (the most uncomfortable to leave unanswered)',
            ],
          },
        ],
      },
      {
        id: 'replay-line',
        name: 'The Replay Line',
        engine: 'hook',
        tagline: 'Engineer a line that loops in the listener\'s head using 5 layers',
        formula: 'Echo-pivot (repeatable) + Melody Lock (hummable) + Memory Grab (fits one breath) + Micro-gap (leaves something unresolved) + Compression (carries the whole song in one line)',
        when: 'A chorus has words but not a phrase — something people want to sing along to and still be thinking about after the song ends',
        exercises: [
          {
            title: 'Compression Sprint',
            prompt: 'Think about the chorus situation. Compress the entire emotional experience into 8 words or fewer. Don\'t summarize — compress.',
            inputLabels: [
              'The emotional situation (what actually happened or keeps happening)',
              'Compressed version 1 (8 words or fewer)',
              'Compressed version 2 (go even more specific)',
              'Score your best version: Does it fit one breath? Does it loop? Does it leave something unresolved?',
            ],
          },
        ],
      },
    ],
  },
];

// ─── 100+ SONGSTARTER PROMPTS ─────────────────────────────────────────────────
// Source: 100+ Songstarter Prompts by SongwriterCore

export const SONGSTARTER_PROMPTS: PromptCategory[] = [
  {
    id: 'flashback-feels',
    label: 'Flashback Feels',
    prompts: [
      'Name a part of your past you tend to romanticise.',
      'Name something you miss even though you know it was not good for you.',
      'Write about a version of yourself you still compare yourself to.',
      'Write about something you thought adulthood would automatically fix.',
      'Name a habit you picked up early that you still have.',
      'Write about something that still makes you feel safe.',
      'Write about something from your past that still affects how you love.',
      'Write about a belief you had growing up that you no longer agree with.',
      'Name something you wish someone had explained to you sooner.',
      'Write about a part of your past that feels unresolved.',
    ],
  },
  {
    id: 'fear-and-pressure',
    label: 'Fear and Pressure',
    prompts: [
      'Write about something important you keep avoiding.',
      'Name a fear you often justify with logic.',
      'Write about something you would try if embarrassment was not a factor.',
      'Write about a decision you still think about.',
      'Write about the thing you overthink the most.',
      'Write about the area of your life that feels the most fragile right now.',
      'Write about what scares you about actually getting what you want.',
      'Write about something you are afraid to admit out loud.',
      'Write about what courage would look like for you right now.',
      'Write about how your life might change if fear was not in charge.',
    ],
  },
  {
    id: 'love-and-longing',
    label: 'Love and Longing',
    prompts: [
      'Write about how you know when you are in love.',
      'Write about what missing someone actually feels like to you.',
      'Write about why certain people stay in your head longer than others.',
      'Write about the type of love you tend to chase.',
      'Write about what you need most from love right now.',
      'Write about when you feel most connected to someone.',
      'Write about what makes you emotionally pull away.',
      'Write about something you wish people asked you more often.',
      'Write about a type of love that feels unrealistic but tempting.',
      'Write about what healthy love would look like in your life.',
    ],
  },
  {
    id: 'identity-and-growing-up',
    label: 'Identity and Growing Up',
    prompts: [
      'Write about the part of yourself you edit around others.',
      'Write about when you feel most like yourself.',
      'Write about the version of you that people assume.',
      'Write about something you feel misunderstood about.',
      'Write about a label you resist being given.',
      'Write about something you pretend does not matter but does.',
      'Write about how your personality has changed over time.',
      'Write about something you miss about who you used to be.',
      'Write about something you are learning to accept.',
      'Write about something you are actively unlearning.',
    ],
  },
  {
    id: 'life-and-the-world',
    label: 'Life and the World',
    prompts: [
      'Write about what makes a day feel like a good day to you.',
      'Write about what you procrastinate on the most and why.',
      'Write about what your inner monologue sounds like.',
      'Write about something that feels harder now than it used to.',
      'Write about a part of life that feels performative to you.',
      'Write about something you wish people were more honest about.',
      'Write about what makes life feel repetitive lately.',
      'Write about what you use to mentally escape.',
      'Write about something that has been keeping you hopeful.',
      'Write about your life right now as if it were a TV show.',
    ],
  },
  {
    id: 'everyday-signals',
    label: 'Everyday Signals',
    prompts: [
      'What is one useless item you still hold onto?',
      'Write about something you saw today that stayed in your head.',
      'Write about something someone said casually that you took personally.',
      'What is one thing you notice every time you\'re outside?',
      'Have you ever been inspired by something completely ordinary?',
      'Write about a moment that felt important for no obvious reason.',
      'What is something you always notice in other people first?',
      'What is one detail from today you didn\'t expect to remember?',
      'Write about a moment that felt familiar even though it was new.',
      'What is something ordinary that feels symbolic to you?',
    ],
  },
  {
    id: 'undefined-connections',
    label: 'Undefined Connections',
    prompts: [
      'Have you ever not known where you stood with someone?',
      'What does mixed energy feel like?',
      'Have you ever pretended not to care when you did?',
      'Write about the part of the day you don\'t talk about.',
      'Write about an ending that never really happened.',
      'Have you ever stayed longer than you should have?',
      'Write about something that never became what it could have been.',
      'Have you ever delayed a conversation to keep the peace?',
      'What does uncertainty do to your behaviour?',
      'What does it feel like when nothing is wrong but nothing is right?',
    ],
  },
  {
    id: 'catching-yourself',
    label: 'Catching Yourself',
    prompts: [
      'Have you ever known better and still done it?',
      'Write about a pattern you notice but repeat anyway.',
      'What do you do when you\'re avoiding something?',
      'Write about choosing comfort over honesty.',
      'Have you ever talked yourself into a bad idea?',
      'Write about doing something you said you wouldn\'t.',
      'What do you reach for when you\'re bored?',
      'Write about realising too late what you were doing.',
      'Have you ever ignored your own advice?',
      'Write about the moment you knew you were the problem.',
    ],
  },
  {
    id: 'things-you-heard',
    label: 'Things You Heard',
    prompts: [
      'Write about something someone said casually that stuck with you.',
      'Write about a sentence you overheard and kept thinking about.',
      'What is the last thing someone said to you that changed your mood?',
      'Write about advice you did not ask for but remember.',
      'Write about a joke that landed more seriously than intended.',
      'What is something someone said that you wish you could forget?',
      'Write about a comment that sounded normal but felt loaded.',
      'Write about words you replay even though they were small.',
      'What is something someone said once that still affects you?',
      'Write about hearing something at the wrong time.',
    ],
  },
  {
    id: 'small-things-you-noticed',
    label: 'Small Things You Noticed',
    prompts: [
      'Write about something you saw today that stayed with you.',
      'Write about watching someone react without saying anything.',
      'What is something you noticed about someone else before they noticed it?',
      'Write about seeing someone try to hide how they felt.',
      'Write about a moment you witnessed but were not part of.',
      'What is something visual you cannot get out of your head?',
      'Write about seeing someone get news they did not expect.',
      'Write about watching someone leave without a goodbye.',
      'What is something you saw that changed how you felt about someone?',
      'Write about noticing something small most people would miss.',
    ],
  },
  {
    id: 'comparison',
    label: 'Comparison',
    prompts: [
      'How do you feel about the pace people your age are expected to live at?',
      'What do you notice people your age feeling behind on?',
      'Write about something that feels harder now than it should be.',
      'How do you feel about everyone acting like they\'re busy all the time?',
      'What do you notice people pretending is normal?',
      'Write about a pressure that feels shared, not personal.',
      'How do you feel about rest needing to be justified?',
      'What do you notice people quietly worrying about?',
      'What is something you realised it\'s not just you dealing with this.',
      'How do you feel about always needing to be improving something?',
    ],
  },
  {
    id: 'generational-observations',
    label: 'Generational Observations',
    prompts: [
      'What is something you realised a lot of people your age are dealing with?',
      'What struggle feels personal but is actually common?',
      'What did you think was just your problem until someone said it out loud?',
      'What is something everyone pretends they have figured out?',
      'What pressure do you see people carrying quietly?',
      'What do people your age complain about the most?',
      'What is something you hear friends talk about over and over?',
      'What feels normal now that didn\'t used to be?',
      'What problem feels generational?',
      'What do people bond over without planning to?',
    ],
  },
  {
    id: 'favorites',
    label: 'Favorites',
    prompts: [
      'What is your favourite time of day and why?',
      'What is your favourite place to disappear to?',
      'What is your favourite way to avoid something?',
      'What is your favourite thing to do when no one expects anything from you?',
      'Describe the favourite version of yourself.',
      'What is your favourite habit you know is bad for you?',
      'What is your favourite excuse to cancel plans?',
      'What is your favourite thing to do alone?',
      'What is your favourite memory you never talk about?',
      'What is your favourite feeling that doesn\'t last long?',
    ],
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export function getRandomPrompt(categoryId: string): string {
  const category = SONGSTARTER_PROMPTS.find(c => c.id === categoryId);
  if (!category || category.prompts.length === 0) return '';
  return category.prompts[Math.floor(Math.random() * category.prompts.length)];
}

export function getMethodById(id: string): Method | undefined {
  for (const group of SONGWRITING_METHODS) {
    const found = group.methods.find(m => m.id === id);
    if (found) return found;
  }
  return undefined;
}

export function getMethodsForContext(view: AppView | 'idea' | 'review'): Method[] {
  const enginePriority: Record<string, EngineId[]> = {
    flow: ['spark', 'feeling'],
    write: ['word', 'hook'],
    puzzle: ['spark', 'fracture'],
    rituals: ['spark', 'feeling', 'word'],
    player: ['feeling', 'hook'],
    idea: ['spark'],
    review: ['fracture', 'word'],
  };
  const engines = enginePriority[view] ?? ['spark', 'feeling', 'word', 'hook', 'fracture'];
  return SONGWRITING_METHODS
    .filter(g => engines.includes(g.engine))
    .flatMap(g => g.methods);
}

export function buildSystemPromptKnowledgeBlock(): string {
  const methodLines = SONGWRITING_METHODS.flatMap(group =>
    group.methods.map(m =>
      `    • ${m.name} [${group.label}]: ${m.tagline}. Formula: ${m.formula}. Use when: ${m.when}`
    )
  ).join('\n');

  const stageLines = MUSICAL_CREATIVE_PROCESS.map(s =>
    `    • ${s.name}: ${s.description}`
  ).join('\n');

  const promptCategoryLines = SONGSTARTER_PROMPTS.map(c =>
    `    • ${c.label} (${c.prompts.length} prompts) — e.g. "${c.prompts[0]}"`
  ).join('\n');

  return `
### THE 5 STAGES OF THE MUSICAL CREATIVE PROCESS
${stageLines}

### ALL 25 SONGWRITING METHODS (Complete Playbook)
${methodLines}

### 100+ SONGSTARTER PROMPT CATEGORIES
When a user is stuck or starting cold, suggest ONE prompt from a relevant category:
${promptCategoryLines}`;
}
