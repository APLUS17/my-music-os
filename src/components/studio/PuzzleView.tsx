import React, { useState } from 'react';
import { LyricScrap, SectionType } from '@/types';
import { Plus, GripVertical, Hash, FilePlus2, Send, Tag } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
    switch (type) {
      case 'chorus': return 'border-[var(--accent)] shadow-[0_0_15px_rgba(0,0,0,0.3)] shadow-[var(--accent)]/5';
      case 'verse': return 'border-[var(--border-main)]';
      case 'bridge': return 'border-[var(--border-focus)]';
      default: return 'border-dashed border-[var(--border-main)] opacity-70';
    }
  };

  return (
    <div className="h-full flex flex-col pt-4 pb-36 px-4 overflow-y-auto scrollbar-hide">

      {/* Header */}
      <div className="mb-6 px-2 flex items-end justify-between">
        <h1 className="text-3xl font-bold tracking-tighter text-[var(--text-main)] display">Muse</h1>
        <Badge variant="outline" className="text-[10px] mono border-[var(--border-main)] text-[var(--text-tertiary)] mb-1">{scraps.length} ITEMS</Badge>
      </div>

      {/* Dynamic Input Area */}
      <div className="mb-8 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[1.5rem] p-4 shadow-xl z-10 relative focus-within:border-[var(--border-focus)] transition-all">
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Capture an idea..."
          className="w-full bg-transparent p-2 text-sm font-sans text-[var(--text-main)] focus:outline-none min-h-[80px] resize-none placeholder:text-[var(--text-tertiary)]"
        />
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-main)]">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
            {['idea', 'verse', 'chorus', 'bridge'].map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t as SectionType)}
                className={cn(
                  "px-3 py-1 rounded-full text-[9px] mono uppercase tracking-widest transition-all",
                  selectedType === t
                    ? 'bg-[var(--accent)] text-[var(--bg-main)] font-bold'
                    : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-secondary)]'
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Button
            size="icon"
            onClick={() => { if (newText.trim()) { onAdd(newText, selectedType); setNewText(""); } }}
            disabled={!newText.trim()}
            className="w-10 h-10 bg-[var(--accent)] text-black rounded-full shadow-lg active:scale-90 transition-all disabled:opacity-50 hover:brightness-110"
          >
            <Plus size={18} strokeWidth={3} />
          </Button>
        </div>
      </div>

      {/* The Spatial Board */}
      <div className="columns-2 gap-4 space-y-4 pb-20">
        {scraps.map((scrap, idx) => (
          <div
            key={scrap.id}
            className={cn(
              "break-inside-avoid relative p-4 rounded-xl bg-[var(--bg-card)] border transition-all hover:scale-[1.02] shadow-sm group",
              getCardStyle(scrap.type)
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <Badge variant="ghost" className="h-5 px-1.5 text-[8px] mono uppercase tracking-widest bg-[var(--bg-hover)] text-[var(--text-secondary)] group-hover:text-[var(--text-main)] transition-colors cursor-pointer gap-1">
                <Hash size={8} className="opacity-40" /> {scrap.type}
              </Badge>
              <GripVertical size={12} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]" />
            </div>

            <p className="text-sm font-sans text-[var(--text-main)] leading-relaxed whitespace-pre-wrap selection:bg-[var(--accent)] selection:text-[var(--bg-main)]">
              {scrap.text}
            </p>

            {/* Tags */}
            {scrap.tags && scrap.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {scrap.tags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="px-1.5 h-4 border-[var(--accent)]/20 bg-[var(--accent)]/5 text-[var(--accent)] text-[8px] mono rounded-md">#{tag}</Badge>
                ))}
              </div>
            )}

            {/* Tag editor */}
            {editingTagsId === scrap.id && (
              <div className="mt-3 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Input
                  autoFocus
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      const existing = scrap.tags || [];
                      onUpdateTags?.(scrap.id, [...existing, tagInput.trim()]);
                      setTagInput("");
                      setEditingTagsId(null);
                    }
                    if (e.key === 'Escape') { setEditingTagsId(null); setTagInput(""); }
                  }}
                  placeholder="Add tag..."
                  className="h-7 text-[10px] bg-[var(--bg-secondary)] border-[var(--border-main)] rounded-lg focus:ring-[var(--accent)]"
                />
              </div>
            )}

            {/* Actions */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); setEditingTagsId(editingTagsId === scrap.id ? null : scrap.id); setTagInput(""); }}
                    className="h-8 w-8 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
                  >
                    <Tag size={12} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Tag</TooltipContent>
              </Tooltip>

              {onSendToStudio && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); onSendToStudio(scrap.text); }}
                      className="h-8 w-8 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10"
                    >
                      <Send size={12} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Send to Studio</TooltipContent>
                </Tooltip>
              )}

              {scrap.type !== 'idea' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); onStartProject(scrap.text, scrap.type); }}
                      className="h-8 w-8 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--bg-main)] hover:bg-[var(--accent)]"
                    >
                      <FilePlus2 size={12} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Start Project</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        ))}

        {scraps.length === 0 && (
          <div className="break-inside-avoid flex flex-col items-center justify-center opacity-30 py-16 col-span-2 text-[var(--text-secondary)]">
            <Hash size={64} strokeWidth={1} />
            <p className="mt-4 text-[11px] mono uppercase tracking-[0.2em]">Board Empty</p>
          </div>
        )}
      </div>
    </div>
  );
};
