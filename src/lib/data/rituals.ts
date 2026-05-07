import { Ritual } from '../../types';

export const MASTER_RITUALS: Ritual[] = [
    {
        id: 'vault-dive',
        title: 'Vault Dive',
        category: 'Idea Curation',
        durationMinutes: 30,
        timeOfDay: '11:00 AM',
        description: 'Resurface buried ideas.',
        energyLevel: 'Low',
        prepSteps: [
            'Open notes or voice memos',
            'Skim without judging',
            'Flag 3 sparks',
            'Move 1 to "Next Up"'
        ],
        methods: ['inspiration-banking', 'angle-shaping'],
        exercises: [
            {
                title: 'The Angle Filter',
                instruction: 'Pick the 3 ideas you flagged. For each one, assign a POV angle (I / You / Observer) and write a one-sentence "what this song is really about." This sharpens the idea before you ever open a session.',
                inputFields: ['Idea 1 — angle + one-sentence core', 'Idea 2 — angle + one-sentence core', 'Idea 3 — angle + one-sentence core', 'The one moving to "Next Up" and why'],
            },
        ],
        promptCategory: 'flashback-feels',
        liveTools: [
            { type: 'rhyme', label: 'Rhyme a keyword' },
            { type: 'gemini-prompt', label: 'AI: What should I write next?' },
        ],
    },
    {
        id: 'reference-stack-builder',
        title: 'Reference Stack Builder',
        category: 'Idea Curation',
        durationMinutes: 25,
        timeOfDay: '10:30 AM',
        description: 'Collect 3 references for one emotional direction.',
        energyLevel: 'Medium',
        prepSteps: [
            'Choose an emotion or vibe',
            'Find 1 song for rhythm',
            'Find 1 song for melody/harmony',
            'Find 1 song for arrangement/production'
        ],
        methods: ['emotion-mapping', '5-senses'],
        exercises: [
            {
                title: 'The Sense Map Per Reference',
                instruction: 'For each of your 3 reference songs, write one sensory detail per sense that the song evokes. This trains your ear to extract feeling — not just genre.',
                inputFields: [
                    'Reference 1 — title + Sight / Sound / Touch / Smell / Taste',
                    'Reference 2 — title + Sight / Sound / Touch / Smell / Taste',
                    'Reference 3 — title + Sight / Sound / Touch / Smell / Taste',
                    'The shared emotional thread across all 3',
                ],
            },
        ],
        promptCategory: 'love-and-longing',
        liveTools: [
            { type: 'synonym', label: 'Find synonyms for your vibe word' },
        ],
    },
    {
        id: 'idea-sprint',
        title: 'Idea Sprint',
        category: 'Idea Generation',
        durationMinutes: 30,
        timeOfDay: '9:00 AM',
        description: 'Quantity over quality. No judgment.',
        energyLevel: 'High',
        prepSteps: [
            'Set a BPM and key',
            'Load a simple drum loop or metronome',
            'Record 5 different melodic ideas quickly',
            'Save without editing'
        ],
        methods: ['stream-of-consciousness', 'title-first'],
        exercises: [
            {
                title: 'Stream of Consciousness Write',
                instruction: 'Before you record: pick a trigger word (an emotion, object, or memory). Set a 4-minute timer. Write nonstop without lifting your pen — no editing, no deleting. Pull 2-3 lines to hum into the session.',
                inputFields: ['Trigger word', 'Your nonstop writing (4 min)', '2-3 lines to carry into the session'],
            },
            {
                title: 'Title First Spark',
                instruction: 'Generate one title before you open your DAW. It becomes the north star for the session — everything you record should sound like it belongs to that title.',
                inputFields: ['Your title', 'The theme it unlocks', 'The emotion it points at'],
            },
        ],
        promptCategory: 'everyday-signals',
        liveTools: [
            { type: 'rhyme', label: 'Rhyme your trigger word' },
            { type: 'gemini-prompt', label: 'AI: Give me an idea spark' },
        ],
    },
    {
        id: 'constraint-session',
        title: 'Constraint Session',
        category: 'Idea Generation',
        durationMinutes: 30,
        timeOfDay: '2:00 PM',
        description: 'Use one deliberate limitation (e.g., only 3 tracks, or only one synth).',
        energyLevel: 'Medium',
        prepSteps: [
            'Define your constraint (e.g., 1 synth only)',
            'Set up the project with only allowed tools',
            'Focus on maximizing the limited palette',
            'Document what worked well'
        ],
        methods: ['familiar-flip'],
        exercises: [
            {
                title: 'The Cliché Speed Round',
                instruction: 'Set a 5-minute timer. Flip 5 clichés — one minute each. Write the first twist that comes to mind. The best flip becomes the hook concept for your constraint session.',
                inputFields: [
                    '"What goes around comes around" → flip:',
                    '"Love conquers all" → flip:',
                    '"Better late than never" → flip:',
                    '"The grass is greener" → flip:',
                    '"Blood is thicker than water" → flip:',
                    'Best flip to build on',
                ],
            },
        ],
        promptCategory: 'catching-yourself',
        liveTools: [],
    },
    {
        id: 'sketch-expansion',
        title: 'Sketch Expansion',
        category: 'Idea Development',
        durationMinutes: 35,
        timeOfDay: '1:00 PM',
        description: 'Turn a loop into a full rough arrangement.',
        energyLevel: 'High',
        prepSteps: [
            'Duplicate the 8-bar loop across the timeline',
            'Mute elements to create an intro and verse',
            'Add a transition element to the chorus',
            'Map out a basic song structure'
        ],
        methods: ['simile-build', 'immersion-frame'],
        exercises: [
            {
                title: 'Simile for the Chorus Concept',
                instruction: 'Before you arrange, build a Simile for the emotional core of your chorus. This becomes your sonic north star for the whole expansion.',
                inputFields: [
                    'Core emotion of the chorus',
                    'Layer 1 — Simile: "It felt like ___"',
                    'Layer 2 — Ground: connect it to the real situation',
                    'Layer 3 — Texture: add one vivid sensory detail',
                    'Lyric line built from all three layers',
                ],
            },
            {
                title: 'Immersion Frame for the Intro',
                instruction: 'Design an immersive opening for the song using Time + Place + Sensory anchor + Emotional state.',
                inputFields: [
                    'Time (specific — "2:17am", "the Sunday after")',
                    'Place (specific — not "my room" but "the bathroom floor with the light off")',
                    'Sensory anchor (first thing the listener experiences)',
                    'Opening lyric line',
                ],
            },
        ],
        promptCategory: 'undefined-connections',
        liveTools: [
            { type: 'synonym', label: 'Find synonyms for your chorus word' },
        ],
    },
    {
        id: 'section-deepening',
        title: 'Section Deepening',
        category: 'Idea Development',
        durationMinutes: 30,
        timeOfDay: '3:00 PM',
        description: 'Strengthen one weak section.',
        energyLevel: 'Medium',
        prepSteps: [
            'Identify the weakest part of the song',
            'Isolate it and loop it',
            'Add ear candy or rhythmic variation',
            'Check how it transitions in and out'
        ],
        methods: ['zoom-in', 'overflow-line'],
        exercises: [
            {
                title: 'Three-Level Zoom on the Weakest Line',
                instruction: 'Find the most generic line in the section. Run it through three levels of zoom until you\'d never read that line as belonging to anyone else.',
                inputFields: [
                    'The weak line (copy it exactly)',
                    'Level 1 — Wide shot (the general feeling)',
                    'Level 2 — Mid shot (the specific situation)',
                    'Level 3 — Close-up (the detail only you would notice)',
                    'Rewritten line using the close-up detail',
                ],
            },
            {
                title: 'The Overflow Insert',
                instruction: 'Write 3 tight metered lines for the section, then let one line run over the bar — pile words until the feeling exhausts itself.',
                inputFields: ['Tight line 1', 'Tight line 2', 'Tight line 3', 'Overflow line — no word limit'],
            },
        ],
        promptCategory: 'small-things-you-noticed',
        liveTools: [
            { type: 'rhyme', label: 'Rhyme your key word' },
        ],
    },
    {
        id: 'critical-listen',
        title: 'Critical Listen',
        category: 'Idea Review',
        durationMinutes: 30,
        timeOfDay: '4:00 PM',
        description: 'Objective distance listening.',
        energyLevel: 'Low',
        prepSteps: [
            'Export the current mix',
            'Step away from the screen',
            'Listen on 3 different devices (e.g., phone, car, headphones)',
            'Take notes without making immediate changes'
        ],
        methods: ['shiny-honest'],
        exercises: [
            {
                title: 'The Shiny/Honest Audit',
                instruction: 'After your listen, go section by section. For each section write the "Shiny" version (polished, safe) and the "Honest" version (what the song is actually about if you removed the pretty words). The gap between them is where you revise.',
                inputFields: [
                    'Section 1 — Shiny vs. Honest',
                    'Section 2 — Shiny vs. Honest',
                    'Chorus — Shiny vs. Honest',
                    'The one line you need to make more honest',
                ],
            },
        ],
        promptCategory: 'fear-and-pressure',
        liveTools: [],
    },
    {
        id: 'reduction-pass',
        title: 'Reduction Pass',
        category: 'Idea Review',
        durationMinutes: 25,
        timeOfDay: '5:30 PM',
        description: 'Improve by removing elements.',
        energyLevel: 'Medium',
        prepSteps: [
            'Mute any track not serving the main groove or melody',
            'Consolidate duplicate layers',
            'Simplify busy drum patterns',
            'Check if the song feels more impactful'
        ],
        methods: ['contradiction-mirror'],
        exercises: [
            {
                title: 'Find the Contradiction',
                instruction: 'After your reduction pass, find one contradiction in the song\'s core emotion — two things that are both true simultaneously. Write a line that holds both without resolving the tension.',
                inputFields: [
                    'Truth A — what the song genuinely feels',
                    'Truth B — the opposite that\'s also true',
                    'A lyric line that holds both without resolving them',
                ],
            },
        ],
        promptCategory: 'catching-yourself',
        liveTools: [],
    },
    {
        id: 'library-reset',
        title: 'Library Reset',
        category: 'Optimization',
        durationMinutes: 30,
        timeOfDay: '12:00 PM',
        description: 'Organize sounds/samples.',
        energyLevel: 'Low',
        prepSteps: [
            'Delete unused or duplicate samples',
            'Create a folder for current favorites',
            'Tag 10 new sounds',
            'Backup current projects'
        ],
        methods: ['inspiration-banking'],
        exercises: [
            {
                title: 'Inspiration Banking Tags',
                instruction: 'As you tag sounds, apply the Inspiration Banking formula to 5 of them. This turns passive organization into active creative fuel.',
                inputFields: [
                    'Sound 1 → Genre + Aesthetic + Emotion + Search Term',
                    'Sound 2 → Genre + Aesthetic + Emotion + Search Term',
                    'Sound 3 → Genre + Aesthetic + Emotion + Search Term',
                    'Sound 4 → Genre + Aesthetic + Emotion + Search Term',
                    'Sound 5 → Genre + Aesthetic + Emotion + Search Term',
                ],
            },
        ],
        promptCategory: 'everyday-signals',
        liveTools: [],
    },
    {
        id: 'workflow-audit',
        title: 'Workflow Audit',
        category: 'Optimization',
        durationMinutes: 30,
        timeOfDay: '6:00 PM',
        description: 'Improve the system, not the song.',
        energyLevel: 'Medium',
        prepSteps: [
            'Review friction points from recent sessions',
            'Update your default project template',
            'Map new MIDI controllers or shortcuts',
            'Clear physical workspace'
        ],
        methods: [],
        exercises: [
            {
                title: 'The 3 Questions Audit',
                instruction: 'Answer the three review questions honestly about your creative process this week.',
                inputFields: [
                    'What worked? (be specific)',
                    'What felt off? (friction, confusion, resistance)',
                    'What\'s missing? (tools, habits, knowledge)',
                    'One thing to change before next session',
                ],
            },
        ],
        promptCategory: 'life-and-the-world',
        liveTools: [
            { type: 'gemini-prompt', label: 'AI: How can I improve my workflow?' },
        ],
    },
    {
        id: 'vocal-training',
        title: 'Vocal Training',
        category: 'Technique',
        durationMinutes: 30,
        timeOfDay: '10:00 AM',
        description: 'Focused vocal exercises.',
        energyLevel: 'High',
        prepSteps: [
            'Do 5 minutes of physical stretching',
            'Perform lip trills and sirens',
            'Practice scale runs with different vowels',
            'Sing through a challenging phrase slowly'
        ],
        methods: ['conversational-technique'],
        exercises: [
            {
                title: 'The Pre-Session Voice Note',
                instruction: 'Before you sing, make a voice note to yourself about what you\'re trying to say in today\'s session. Don\'t write lyrics — talk. Then pull the most natural phrases from how you spoke and carry them into your warm-up melody.',
                inputFields: [
                    'What you\'d say to a friend about what this song is about',
                    '2-3 natural phrases pulled from how you spoke',
                    'How you\'ll shape these into melody',
                ],
            },
        ],
        promptCategory: 'identity-and-growing-up',
        liveTools: [],
    },
    {
        id: 'guitar-practice',
        title: 'Guitar Practice',
        category: 'Technique',
        durationMinutes: 30,
        timeOfDay: '3:00 PM',
        description: 'Muscle memory and technique.',
        energyLevel: 'High',
        prepSteps: [
            'Tune the instrument',
            'Run through scale shapes with a metronome',
            'Practice a difficult chord transition',
            'Learn one new riff or technique'
        ],
        methods: ['call-and-response'],
        exercises: [
            {
                title: 'Call & Response Phrase',
                instruction: 'After your scales, compose one Call & Response melodic phrase over your practice chord progression. The Response should surprise — not just echo the Call.',
                inputFields: [
                    'Your practice chord progression',
                    'The Call phrase (melodic statement)',
                    'The Response phrase (reframes or deepens — doesn\'t just echo)',
                    'How you\'ll use this phrase in a future song',
                ],
            },
        ],
        promptCategory: 'generational-observations',
        liveTools: [
            { type: 'rhyme', label: 'Rhyme a lyric phrase' },
        ],
    }
];
