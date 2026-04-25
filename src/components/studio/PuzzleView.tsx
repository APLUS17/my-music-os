import React, { useState, useCallback } from 'react';
import { LyricScrap, SectionType } from '@/types';
import { Plus, Send, Copy, Check, Shuffle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Songwriter Core ───────────────────────────────────────────────────────────
const SONGWRITER_CORE = [
  {
    category: 'Flashback',
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
    category: 'Fear',
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
    category: 'Love',
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
    category: 'Identity',
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
    category: 'Life',
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
      'Write about your life right now as if it were a tv show.',
    ],
  },
  {
    category: 'Signals',
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
    category: 'Undefined',
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
    category: 'Catching',
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
    category: 'Heard',
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
    category: 'Noticed',
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
    category: 'Comparison',
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
    category: 'Gen',
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
    category: 'Favorites',
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

const ALL_PROMPTS = SONGWRITER_CORE.flatMap(c => c.prompts.map(p => ({ text: p, category: c.category })));

// ─── Component ─────────────────────────────────────────────────────────────────

interface PuzzleViewProps {
  scraps: LyricScrap[];
  onAdd: (text: string, type: SectionType) => void;
  onUpdateType: (id: string, type: SectionType) => void;
  onStartProject: (text: string, type: SectionType) => void;
  onSendToStudio?: (text: string) => void;
  onUpdateTags?: (id: string, tags: string[]) => void;
}

export const PuzzleView: React.FC<PuzzleViewProps> = ({ scraps, onAdd, onStartProject, onSendToStudio, onUpdateTags }) => {
  const [newText, setNewText] = useState("");
  const [selectedType, setSelectedType] = useState<SectionType>('idea');

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [currentPrompt, setCurrentPrompt] = useState<{ text: string; category: string }>(() => {
    const idx = Math.floor(Math.random() * ALL_PROMPTS.length);
    return ALL_PROMPTS[idx];
  });
  const [copied, setCopied] = useState(false);
  const [lastIndex, setLastIndex] = useState<number>(-1);

  const drawCard = useCallback(() => {
    const pool = activeCategory === 'All'
      ? ALL_PROMPTS
      : ALL_PROMPTS.filter(p => p.category === activeCategory);

    let idx = Math.floor(Math.random() * pool.length);
    // avoid repeating the same prompt back-to-back if pool is large enough
    if (pool.length > 1 && idx === lastIndex) {
      idx = (idx + 1) % pool.length;
    }
    setLastIndex(idx);
    setCurrentPrompt(pool[idx]);
    setCopied(false);
  }, [activeCategory, lastIndex]);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentPrompt.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-end justify-between shrink-0">
        <h1 className="text-2xl font-bold tracking-tighter text-[var(--text-main)]">Muse</h1>
        <Badge variant="outline" className="text-xs mono border-[var(--border-main)] text-[var(--text-tertiary)] mb-0.5">{scraps.length} ITEMS</Badge>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pb-32">

        {/* ── Category pills ── */}
        <div className="overflow-x-auto scrollbar-hide flex items-center gap-2 py-2 -mx-1 px-1 mb-4">
          {['All', ...SONGWRITER_CORE.map(c => c.category)].map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setLastIndex(-1);
                const pool = cat === 'All' ? ALL_PROMPTS : ALL_PROMPTS.filter(p => p.category === cat);
                setCurrentPrompt(pool[Math.floor(Math.random() * pool.length)]);
                setCopied(false);
              }}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 text-xs uppercase tracking-widest font-medium transition-all duration-200 rounded-full whitespace-nowrap",
                activeCategory === cat
                  ? 'bg-[var(--text-main)]/10 text-[var(--text-main)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-main)]'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Prompt card ── */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="w-full min-h-[280px] bg-[var(--bg-card)]/50 border border-[var(--border-main)]/50 rounded-xl overflow-hidden">
            <article className="min-h-[280px] p-6 flex flex-col justify-center gap-4 border-l-4 border-l-[var(--accent)] animate-in fade-in slide-in-from-bottom-2 duration-300">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">{currentPrompt.category}</span>
              <p className="leading-relaxed tracking-tight text-[var(--text-main)] text-xl" style={{ fontFamily: 'Georgia, serif' }}>
                {currentPrompt.text}
              </p>
            </article>
          </div>

          <button
            onClick={drawCard}
            className="w-full px-5 py-3 uppercase tracking-widest font-medium bg-[var(--text-main)] text-[var(--bg-main)] rounded-lg transition-all duration-200 text-xs hover:opacity-90 active:scale-[0.98]"
          >
            Draw Card
          </button>

          <div className="flex items-center gap-4">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-[var(--text-tertiary)] hover:text-[var(--text-main)] transition-colors duration-200"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              {onSendToStudio && (
                <button
                  onClick={() => onSendToStudio(currentPrompt.text)}
                  className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-[var(--text-tertiary)] hover:text-[var(--text-main)] transition-colors duration-200"
                >
                  <Send className="w-3 h-3" />
                  <span>Send to Studio</span>
                </button>
              )}
              <button
                onClick={drawCard}
                className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-[var(--text-tertiary)] hover:text-[var(--text-main)] transition-colors duration-200 ml-auto"
              >
                <Shuffle className="w-3 h-3" />
                <span>Another</span>
              </button>
            </div>
        </div>

        {/* ── Capture area ── */}
        <div className="mb-6 bg-[var(--bg-card)]/50 border border-[var(--border-main)]/50 rounded-xl p-4">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Capture an idea..."
            className="w-full bg-transparent p-2 text-sm font-sans text-[var(--text-main)] focus:outline-none min-h-[72px] resize-none placeholder:text-[var(--text-tertiary)]"
          />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-main)]/50">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
              {(['idea', 'verse', 'chorus', 'bridge'] as SectionType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedType(t)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs mono uppercase tracking-wide transition-all",
                    selectedType === t
                      ? 'bg-[var(--text-main)] text-[var(--bg-main)] font-bold'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-main)]'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              onClick={() => { if (newText.trim()) { onAdd(newText, selectedType); setNewText(""); } }}
              disabled={!newText.trim()}
              className="w-9 h-9 bg-[var(--accent)] text-black rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all disabled:opacity-30"
            >
              <Plus size={16} strokeWidth={3} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
