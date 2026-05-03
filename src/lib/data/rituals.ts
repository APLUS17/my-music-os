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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
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
        ]
    }
];
