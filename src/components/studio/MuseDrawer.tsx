import React from 'react';

// Define mode types
export interface Mode {
    name: string;
    description: string;
    section: string;
    requiresSecondInput?: boolean;
}

export const MODES: Mode[] = [
    // Word Tools
    { name: 'explode', description: 'Explodes the letters of the word.', section: 'Word Tools' },
    { name: 'fuse', description: 'Fuses two inputs.', section: 'Word Tools', requiresSecondInput: true },

    // TextFX Creative
    { name: 'scene', description: 'Creates scenes from text.', section: 'TextFX Creative' },
    { name: 'acronym', description: 'Creates acronyms from words.', section: 'TextFX Creative' },
    { name: 'simile', description: 'Creates similes based on user input.', section: 'TextFX Creative' },

    // Lyric Tools
    // Additional existing modes should be defined here
    { name: 'existing-mode-1', description: 'Description of existing mode 1.', section: 'Lyric Tools' },
    { name: 'existing-mode-2', description: 'Description of existing mode 2.', section: 'Lyric Tools' },
    { name: 'existing-mode-3', description: 'Description of existing mode 3.', section: 'Lyric Tools' },
];

export const buildPrompt = (mode: string, additionalInput?: string): string => {
    const modeDetail = MODES.find(m => m.name === mode);
    if (!modeDetail) {
        throw new Error('Mode not found!');
    }
    let prompt = `Using the ${modeDetail.name} mode: `;

    if (modeDetail.requiresSecondInput && additionalInput) {
        prompt += ` with the second input: ${additionalInput}`;
    }

    return prompt;
};

const MuseDrawer: React.FC = () => {
    // Render component
    return <div>Muse Drawer Component</div>;
};

export default MuseDrawer;