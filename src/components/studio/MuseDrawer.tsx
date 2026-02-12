import React, { useState } from 'react';
import { Dropdown } from 'semantic-ui-react';

// Updated MuseMode type
export type MuseMode = 'explode' | 'fuse' | 'scene' | 'acronym' | 'simile';

// MODES array organized by sections
const MODES = {
    words: ['explode', 'fuse'],
    textfx: ['scene', 'acronym', 'simile'],
    lyric: []
};

const MuseDrawer = () => {
    const [mode, setMode] = useState<MuseMode>('explode');
    const [input1, setInput1] = useState('');
    const [input2, setInput2] = useState('');
    const [results, setResults] = useState([]);

    const buildPrompt = () => {
        switch(mode) {
            case 'explode':
                return `Explode this: ${input1}`;
            case 'fuse':
                return `Fuse these: ${input1} ${input2}`;
            case 'scene':
                return `Create a scene from: ${input1}`;
            case 'acronym':
                return `Generate an acronym for: ${input1}`;
            case 'simile':
                return `Create a simile for: ${input1}`;
            default:
                return '';
        }
    };

    const handleSearch = () => {
        const prompt = buildPrompt();
        // Perform search with the generated prompt
        // Mock results for demonstration
        const mockResults = ['Result 1', 'Result 2', 'Result 3'];
        setResults(mockResults);
    };

    return (
        <div>
            <Dropdown
                onChange={(e, { value }) => setMode(value as MuseMode)}
                options={Object.keys(MODES).flatMap(section => 
                    MODES[section].map(mode => ({ key: mode, text: mode, value: mode }))
                )}
                value={mode}
            />
            {mode === 'fuse' && (
                <input type='text' placeholder='Second input' value={input2} onChange={(e) => setInput2(e.target.value)} />
            )}
            <input type='text' placeholder='Input' value={input1} onChange={(e) => setInput1(e.target.value)} />
            <button onClick={handleSearch}>Search</button>
            <div className={mode === 'scene' || mode === 'acronym' || mode === 'simile' ? 'full-width' : 'grid'}>
                {results.map((result, index) => (
                    <div key={index}>{result}</div>
                ))}
            </div>
        </div>
    );
};

export default MuseDrawer;