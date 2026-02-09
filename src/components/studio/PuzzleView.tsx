
import React, { useState } from 'react';
import { LyricScrap, SectionType } from '@/types';
import { Plus, GripVertical, Hash, FilePlus2, Send, Tag } from 'lucide-react';

interface PuzzleViewProps {
  scraps: LyricScrap[];
  onAdd: (text: string, type: SectionType) => void;
  onUpdateType: (id: string, type: SectionType) => void;
  onStartProject: (text: string, type: SectionType) => void;
  onSendToStudio?: (text: string) => void;
  onUpdateTags?: (id: string, tags: string[]) => void;
}

export const PuzzleView: React.FC<PuzzleViewProps> = ({ scraps, onAdd, onUpdateType, onStartProject, onSendToStudio, onUpdateTags }) => {
  const [newText, setNewText] = useState("");
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [selectedType, setSelectedType] = useState<SectionType>('idea');

  const getCardStyle = (type: SectionType) => {
    switch(type) {
      case 'chorus': return 'border-[var(--accent)] shadow-[0_0_15px_rgba(0,0,0,0.3)]';
      case 'verse': return 'border-[var(--border-main)]';
      case 'bridge': return 'border-[var(--text-secondary)]';
      default: return 'border-dashed border-[var(--text-tertiary)] opacity-80';
    }
  };

  return (
    <div className="h-full flex flex-col pt-4 pb-36 px-4 overflow-y-auto scrollbar-hide">
      
      {/* Header */}
      <div className="mb-6 px-2 flex items-end justify-between">
        <h1 className="text-2xl font-medium tracking-tight text-[var(--text-main)]">Muse</h1>
        <span className="text-[10px] mono text-[var(--text-secondary)] mb-1">{scraps.length} ITEMS</span>
      </div>

      {/* Dynamic Input Area */}
      <div className="mb-8 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[1.5rem] p-4 shadow-xl z-10 relative">
        <textarea 
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Capture an idea..."
          className="w-full bg-transparent p-2 text-sm font-sans text-[var(--text-main)] focus:outline-none min-h-[60px] resize-none placeholder:text-[var(--text-tertiary)]"
        />
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-main)]">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
            {['idea', 'verse', 'chorus', 'bridge'].map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t as SectionType)}
                className={`px-3 py-1 rounded-full text-[9px] mono uppercase tracking-widest transition-all ${
                  selectedType === t 
                    ? 'bg-[var(--text-main)] text-[var(--bg-main)]' 
                    : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-main)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button 
            onClick={() => { if(newText.trim()) { onAdd(newText, selectedType); setNewText(""); } }}
            disabled={!newText.trim()}
            className="w-10 h-10 bg-[var(--accent)] text-[var(--bg-main)] rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all disabled:opacity-50 disabled:shadow-none"
          >
            <Plus size={18} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* The Spatial Board */}
      <div className="columns-2 gap-4 space-y-4 pb-20">
        {scraps.map((scrap, idx) => (
          <div 
            key={scrap.id} 
            className={`break-inside-avoid relative p-4 rounded-xl bg-[var(--bg-card)] border transition-all hover:-translate-y-1 group ${getCardStyle(scrap.type)}`}
          >
            <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[8px] mono uppercase tracking-widest text-[var(--text-secondary)] group-hover:text-[var(--text-main)] transition-colors cursor-pointer">
                 <Hash size={8} /> {scrap.type}
               </div>
               <GripVertical size={12} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]" />
            </div>
            
            <p className="text-sm font-sans text-[var(--text-main)] leading-relaxed whitespace-pre-wrap">
              {scrap.text}
            </p>

            {/* Tags */}
            {scrap.tags && scrap.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {scrap.tags.map((tag, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] text-[8px] mono">#{tag}</span>
                ))}
              </div>
            )}

            {/* Tag editor */}
            {editingTagsId === scrap.id && (
              <div className="mt-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      const existing = scrap.tags || [];
                      onUpdateTags?.(scrap.id, [...existing, tagInput.trim()]);
                      setTagInput("");
                    }
                    if (e.key === 'Escape') { setEditingTagsId(null); setTagInput(""); }
                  }}
                  placeholder="Add tag..."
                  className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded px-2 py-1 text-[9px] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            )}

            {/* Actions */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all">
              <button
                onClick={(e) => { e.stopPropagation(); setEditingTagsId(editingTagsId === scrap.id ? null : scrap.id); setTagInput(""); }}
                className="p-1.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all shadow-sm"
                title="Add Tag"
              >
                <Tag size={12} />
              </button>
              {onSendToStudio && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSendToStudio(scrap.text); }}
                  className="p-1.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all shadow-sm"
                  title="Send to Studio"
                >
                  <Send size={12} />
                </button>
              )}
              {scrap.type !== 'idea' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onStartProject(scrap.text, scrap.type); }}
                  className="p-1.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--accent)] hover:text-[var(--bg-main)] transition-all shadow-sm"
                  title="Start New Project"
                >
                  <FilePlus2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
        
        {scraps.length === 0 && (
            <div className="break-inside-avoid flex flex-col items-center justify-center opacity-20 py-10 col-span-2">
                <Hash size={48} strokeWidth={1} />
                <p className="mt-4 text-[10px] mono uppercase tracking-widest">Board Empty</p>
            </div>
        )}
      </div>
    </div>
  );
};
