import React, { useState, useEffect } from 'react';
import { X, ChevronDown, Copy, Sparkles, RefreshCw, ArrowRight } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface MuseDrawerProps {
  onClose: () => void;
  contextText: string;
}

type MuseMode = 'rhyme' | 'synonym' | 'antonym' | 'related' | 'explode' | 'fuse' | 'scene' | 'acronym' | 'simile' | 'next_line' | 'rewrite';

const MODES: { id: MuseMode; label: string; icon: string; placeholder: string; section?: string }[] = [
  { id: 'rhyme', label: 'Rhyme', icon: 'A-A', placeholder: 'Enter a word...', section: 'words' },
  { id: 'synonym', label: 'Synonym', icon: '≈', placeholder: 'Enter a word...', section: 'words' },
  { id: 'antonym', label: 'Antonym', icon: '≠', placeholder: 'Enter a word...', section: 'words' },
  { id: 'related', label: 'Related', icon: '#', placeholder: 'Enter a topic...', section: 'words' },
  { id: 'explode', label: 'Explode', icon: '↗', placeholder: 'Enter a word...', section: 'textfx' },
  { id: 'fuse', label: 'Fuse', icon: '⚗', placeholder: 'Word 1 + Word 2...', section: 'textfx' },
  { id: 'scene', label: 'Scene', icon: '🎬', placeholder: 'Enter a concept...', section: 'textfx' },
  { id: 'acronym', label: 'Acronym', icon: 'Σ', placeholder: 'Enter a word...', section: 'textfx' },
  { id: 'simile', label: 'Simile', icon: '~=', placeholder: 'Enter emotion/thing...', section: 'textfx' },
  { id: 'next_line', label: 'Next Line', icon: '→', placeholder: 'Paste previous line...', section: 'lyric' },
  { id: 'rewrite', label: 'Rewrite', icon: '✎', placeholder: 'Paste line to rewrite...', section: 'lyric' },
];

export const MuseDrawer: React.FC<MuseDrawerProps> = ({ onClose, contextText }) => {
  const [query, setQuery] = useState('');
  const [secondQuery, setSecondQuery] = useState('');
  const [mode, setMode] = useState<MuseMode>('rhyme');
  const [isModeOpen, setIsModeOpen] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeMode = MODES.find(m => m.id === mode) || MODES[0];

  useEffect(() => {
    if (contextText && contextText.length < 50) {
      setQuery(contextText);
    }
  }, [contextText]);

  const buildPrompt = (mode: MuseMode, query: string, secondQuery?: string): string => {
    switch (mode) {
      case 'rhyme':
        return `List 15 creative rhymes (perfect and near) for the word "${query}". Return only a JSON array of strings.`;
      case 'synonym':
        return `List 10 poetic synonyms for "${query}". Return only a JSON array of strings.`;
      case 'antonym':
        return `List 10 antonyms for "${query}". Return only a JSON array of strings.`;
      case 'related':
        return `List 10 words or short phrases conceptually related to "${query}" suitable for song lyrics. Return only a JSON array of strings.`;
      case 'explode':
        return `Break the word "${query}" into similar-sounding phrases and words. Examples: "cat" → ["fat cat", "kat", "scat", "attack"]. Return a JSON array of 8 creative variations.`;
      case 'fuse':
        return `Combine the concepts "${query}" and "${secondQuery}" into powerful single words or short phrases for song lyrics. Return a JSON array of 8 fusions.`;
      case 'scene':
        return `Generate vivid, sensory-rich descriptions for the concept "${query}". Include visual, auditory, and tactile details. Return a JSON array of 6 descriptions (1-2 sentences each).`;
      case 'acronym':
        return `Create memorable acronyms from the word "${query}". Each letter starts a meaningful word for song lyrics. Return a JSON array of 5 acronyms.`;
      case 'simile':
        return `Generate creative similes and metaphors for "${query}". Suggest unexpected comparisons for song lyrics. Return a JSON array of 8 poetic comparisons.`;
      case 'next_line':
        return `Given the lyric line "${query}", suggest 5 creative following lines. Return only a JSON array of strings.`;
      case 'rewrite':
        return `Rewrite the lyric line "${query}" in 5 different ways. Return only a JSON array of strings.`;
      default:
        return '';
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    if (mode === 'fuse' && !secondQuery.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error('Google API key not configured');
      }
      const ai = new GoogleGenAI({ apiKey });
      const prompt = buildPrompt(mode, query, secondQuery);

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          setResults(parsed);
        } else if (Array.isArray(parsed.items)) {
          setResults(parsed.items);
        } else {
          setResults(["No results format matched."]);
        }
      }
    } catch (err) {
      console.error(err);
      setError("The Muse is silent right now. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const wordModes = MODES.filter(m => m.section === 'words');
  const textfxModes = MODES.filter(m => m.section === 'textfx');
  const lyricModes = MODES.filter(m => m.section === 'lyric');

  return (
    <div className="absolute inset-y-0 right-0 w-[85%] max-w-sm bg-[var(--bg-card)] border-l border-[var(--border-main)] shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-50 flex flex-col animate-in slide-in-from-right duration-300">

      <div className="flex items-center justify-between p-4 border-b border-[var(--border-main)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--accent)]" />
          <h2 className="text-sm font-medium tracking-wide">MUSE</h2>
        </div>
        <button onClick={onClose} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-main)] rounded-full hover:bg-[var(--bg-hover)]">
          <X size={18} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div className="relative group">
          <div className="flex items-center w-full h-12 bg-[var(--bg-main)] border border-[var(--border-main)] rounded-xl overflow-hidden focus-within:border-[var(--accent)] transition-colors shadow-sm">

            <button
              onClick={() => setIsModeOpen(!isModeOpen)}
              className="h-full px-3 flex items-center gap-2 bg-[var(--bg-secondary)] border-r border-[var(--border-main)] hover:bg-[var(--bg-hover)] transition-colors min-w-[100px] justify-between"
            >
              <span className="text-[10px] mono uppercase tracking-wider font-medium text-[var(--text-main)]">{activeMode.label}</span>
              <ChevronDown size={12} className={`text-[var(--text-secondary)] transition-transform ${isModeOpen ? 'rotate-180' : ''}`} />
            </button>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeMode.placeholder}
              className="flex-1 bg-transparent px-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-tertiary)] focus:outline-none font-sans"
              autoFocus
            />

            <button
              onClick={handleSearch}
              disabled={loading || !query.trim() || (mode === 'fuse' && !secondQuery.trim())}
              className="pr-3 pl-2 text-[var(--accent)] hover:scale-110 transition-transform disabled:opacity-30 disabled:hover:scale-100"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={18} />}
            </button>
          </div>

          {mode === 'fuse' && (
            <div className="mt-2 flex items-center w-full h-10 bg-[var(--bg-main)] border border-[var(--border-main)] rounded-lg overflow-hidden shadow-sm">
              <input
                value={secondQuery}
                onChange={(e) => setSecondQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter second word..."
                className="flex-1 bg-transparent px-3 text-xs text-[var(--text-main)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
              />
            </div>
          )}

          {isModeOpen && (
            <>
              <div className="fixed inset-0 z-10 cursor-default" onClick={() => setIsModeOpen(false)} />
              <div className="absolute top-14 left-0 w-56 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl shadow-xl z-20 py-2 animate-in fade-in zoom-in-95 duration-150 max-h-96 overflow-y-auto">

                {wordModes.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 text-[8px] mono uppercase tracking-widest text-[var(--text-tertiary)] font-bold">Word Tools</div>
                    {wordModes.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setMode(m.id); setIsModeOpen(false); setSecondQuery(''); }}
                        className={`w-full text-left px-4 py-2.5 text-xs flex items-center gap-3 hover:bg-[var(--bg-hover)] ${mode === m.id ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
                      >
                        <span className="w-5 text-center opacity-50 font-mono">{m.icon}</span>
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </>
                )}

                {textfxModes.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 mt-1 text-[8px] mono uppercase tracking-widest text-[var(--accent)] font-bold">TextFX Creative</div>
                    {textfxModes.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setMode(m.id); setIsModeOpen(false); setSecondQuery(''); }}
                        className={`w-full text-left px-4 py-2.5 text-xs flex items-center gap-3 hover:bg-[var(--bg-hover)] ${mode === m.id ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
                      >
                        <span className="w-5 text-center opacity-50 font-mono">{m.icon}</span>
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </>
                )}

                {lyricModes.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 mt-1 text-[8px] mono uppercase tracking-widest text-[var(--text-tertiary)] font-bold">Lyric Tools</div>
                    {lyricModes.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setMode(m.id); setIsModeOpen(false); setSecondQuery(''); }}
                        className={`w-full text-left px-4 py-2.5 text-xs flex items-center gap-3 hover:bg-[var(--bg-hover)] ${mode === m.id ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
                      >
                        <span className="w-5 text-center opacity-50 font-mono">{m.icon}</span>
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
            {error}
          </div>
        )}

        {results.length === 0 && !loading && !error && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 text-center space-y-2 pb-20">
            <Sparkles size={40} strokeWidth={1} />
            <p className="text-xs max-w-[150px]">Select a tool and cast your query.</p>
          </div>
        )}

        <div className={['next_line', 'rewrite', 'scene', 'acronym', 'simile'].includes(mode) ? "flex flex-col gap-2" : "grid grid-cols-2 gap-2"}>
          {results.map((res, i) => (
            <div
              key={i}
              onClick={() => copyToClipboard(res)}
              className="group relative p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-main)] hover:border-[var(--accent)] hover:shadow-[0_0_15px_var(--accent-dim)] transition-all cursor-pointer active:scale-95 animate-in slide-in-from-bottom-2 fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <p className="text-sm text-[var(--text-main)] line-clamp-3">{res}</p>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Copy size={12} className="text-[var(--text-tertiary)]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 text-center border-t border-[var(--border-main)]">
        <p className="text-[9px] mono uppercase text-[var(--text-tertiary)]">Tap card to copy</p>
      </div>

    </div>
  );
};
