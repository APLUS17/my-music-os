
import React, { useRef, useEffect, useState, useLayoutEffect, useMemo } from 'react';
import { Mic, Play, Pause, GripVertical, Trash2, X } from 'lucide-react';
import { LyricSection, RecordingSession } from '@/types';
import { randomId } from '@/lib/utils/id';

interface SandboxViewProps {
  sections: LyricSection[];
  sessions: RecordingSession[];
  onUpdateSections: (sections: LyricSection[]) => void;
  onRecordStart: (lineId: string) => void;
  onPlaySession: (sessionId: string) => void;
  currentlyPlayingSessionId: string | null;
}

const AutoResizeTextarea = ({
  id,
  value,
  onChange,
  onKeyDown,
  onFocus,
  placeholder,
  autoFocus
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <textarea
      id={id}
      ref={textareaRef}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      rows={1}
      className="w-full bg-transparent border-none focus:outline-none text-[var(--text-main)] text-base leading-relaxed font-sans placeholder:text-[var(--text-tertiary)] resize-none overflow-hidden py-0 whitespace-pre-wrap break-words block"
      placeholder={placeholder}
      spellCheck={false}
    />
  );
};

export const SandboxView: React.FC<SandboxViewProps> = ({
  sections,
  sessions,
  onUpdateSections,
  onRecordStart,
  onPlaySession,
  currentlyPlayingSessionId
}) => {
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);

  // Flatten sections into editable lines for Flow mode
  type FlowLine = { id: string; text: string; sectionId: string; sessionId?: string };
  const lines: FlowLine[] = sections.flatMap(section =>
    section.text.split('\n').map((lineText, idx) => ({
      id: `${section.id}-line-${idx}`,
      text: lineText,
      sectionId: section.id,
      sessionId: section.pinnedSessionId
    }))
  );

  // Ensure at least one line exists
  if (lines.length === 0) {
    lines.push({ id: 'initial', text: '', sectionId: sections[0]?.id || 'default' });
  }

  // Pre-calculate session map to optimize O(N*M) lookup in render loop
  const sessionMap = useMemo(() => {
    const map = new Map<string, RecordingSession>();
    for (const session of sessions) {
      map.set(session.id, session);
    }
    return map;
  }, [sessions]);

  const handleLineChange = (lineId: string, newText: string) => {
    const lineIndex = lines.findIndex(l => l.id === lineId);
    if (lineIndex === -1) return;

    const updatedLines = [...lines];
    updatedLines[lineIndex] = { ...updatedLines[lineIndex], text: newText };

    // Convert lines back to sections
    const sectionMap = new Map<string, string>();
    updatedLines.forEach(line => {
      const existing = sectionMap.get(line.sectionId) || '';
      sectionMap.set(line.sectionId, existing ? `${existing}\n${line.text}` : line.text);
    });

    const updatedSections = sections.map(section => ({
      ...section,
      text: sectionMap.get(section.id) || ''
    }));

    onUpdateSections(updatedSections);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentLine = lines[index];
      const currentSection = sections.find(s => s.id === currentLine.sectionId);
      if (!currentSection) return;

      // Double Enter detection: If current line is empty, creating a new section break
      if (currentLine.text.trim() === '') {
        // We are splitting the section or creating a new one
        const sectionLines = currentSection.text.split('\n');
        // Find the index of this line within the section's lines
        // We need robust index finding since multiple lines might have same text
        // relying on the ID format `${section.id}-line-${idx}` we constructed
        const lineIdxStr = currentLine.id.split('-line-').pop();
        const lineIdx = lineIdxStr ? parseInt(lineIdxStr) : -1;

        if (lineIdx !== -1) {
          const textBefore = sectionLines.slice(0, lineIdx).join('\n');
          const textAfter = sectionLines.slice(lineIdx + 1).join('\n'); // lines after the empty one

          // 1. Update current section with textBefore
          const updatedCurrentSection = { ...currentSection, text: textBefore };

          // 2. Create new section with textAfter (or empty)
          const newSection: LyricSection = {
            id: randomId(),
            type: 'verse', // Default to verse, can be changed in write mode
            repeats: 1,
            text: textAfter
          };

          const currentSectionIndex = sections.findIndex(s => s.id === currentSection.id);
          const newSections = [...sections];
          newSections[currentSectionIndex] = updatedCurrentSection;
          newSections.splice(currentSectionIndex + 1, 0, newSection);

          onUpdateSections(newSections);

          // Focus the first line of the new section
          setTimeout(() => {
            setFocusedLineId(`${newSection.id}-line-0`);
          }, 0);
          return;
        }
      }

      // Normal Enter: Add new line to current section
      const updatedText = currentSection.text + '\n';
      const updatedSections = sections.map(s =>
        s.id === currentSection.id ? { ...s, text: updatedText } : s
      );
      onUpdateSections(updatedSections);

      // Focus the new line
      setTimeout(() => {
        const newLineId = `${currentSection.id}-line-${currentSection.text.split('\n').length}`;
        setFocusedLineId(newLineId);
      }, 0);
    } else if (e.key === 'Backspace' && lines[index].text === '' && lines.length > 1) {
      e.preventDefault();
      const prevLineId = lines[index - 1]?.id;

      // Remove empty line by updating section text
      const updatedLines = lines.filter(l => l.id !== id);
      const sectionMap = new Map<string, string>();
      updatedLines.forEach(line => {
        const existing = sectionMap.get(line.sectionId) || '';
        sectionMap.set(line.sectionId, existing ? `${existing}\n${line.text}` : line.text);
      });

      const updatedSections = sections.map(section => ({
        ...section,
        text: sectionMap.get(section.id) || ''
      }));
      onUpdateSections(updatedSections);

      if (prevLineId) {
        setTimeout(() => {
          document.getElementById(`line-${prevLineId}`)?.focus();
        }, 0);
      }
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      const prevId = lines[index - 1].id;
      const el = document.getElementById(`line-${prevId}`) as HTMLTextAreaElement;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    } else if (e.key === 'ArrowDown' && index < lines.length - 1) {
      e.preventDefault();
      const nextId = lines[index + 1].id;
      const el = document.getElementById(`line-${nextId}`) as HTMLTextAreaElement;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetLineId: string) => {
    e.preventDefault();
    const sessionId = e.dataTransfer.getData('text/plain');

    // Remove session from any other line and add to target
    const newLines = lines.map(line => {
      if (line.id === targetLineId) return { ...line, sessionId };
      if (line.sessionId === sessionId) return { ...line, sessionId: undefined };
      return line;
    });

    // Convert back to sections (simplified - just update the pinned session on the section)
    const targetLine = lines.find(l => l.id === targetLineId);
    if (targetLine) {
      const updatedSections = sections.map(s =>
        s.id === targetLine.sectionId ? { ...s, pinnedSessionId: sessionId } : s
      );
      onUpdateSections(updatedSections);
    }
    setDraggedSessionId(null);
  };

  const removeSessionFromLine = (lineId: string) => {
    const targetLine = lines.find(l => l.id === lineId);
    if (targetLine) {
      const updatedSections = sections.map(s =>
        s.id === targetLine.sectionId ? { ...s, pinnedSessionId: undefined } : s
      );
      onUpdateSections(updatedSections);
    }
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-500 relative min-h-full">
      {lines.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40 gap-4 px-8 text-center">
          <span className="text-sm font-medium text-[var(--text-main)]">Start writing your lyrics</span>
          <div className="space-y-1 text-xs mono text-[var(--text-secondary)]">
            <p>Just type freely - no rules here</p>
            <p>Try rhyming the ends of lines</p>
            <p>Hit Enter twice to start a new section</p>
          </div>
        </div>
      )}

      {lines.map((line, index) => {
        const session = line.sessionId ? sessionMap.get(line.sessionId) ?? null : null;
        const isPlaying = session && currentlyPlayingSessionId === session.id;

        const isLastLineOfSection = lines[index + 1]?.sectionId !== line.sectionId;
        // Negative margin to pull lines together and eliminate browser rendering gaps
        const marginBottom = isLastLineOfSection ? 'mb-12' : '-mb-1';

        return (
          <div
            key={line.id}
            className={`group flex items-start ${marginBottom} relative pl-3 border-l-2 border-transparent hover:border-[var(--border-main)] transition-all`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, line.id)}
          >
            {/* Section Divider Indicator (Visual only) */}
            {isLastLineOfSection && index !== lines.length - 1 && (
              <div className="absolute -bottom-8 left-0 right-0 h-4 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="h-[1px] w-full bg-[var(--border-main)] opacity-50"></div>
              </div>
            )}
            {/* Controls - Absolute Positioned to left of content */}
            <div className="absolute -left-8 top-0 w-6 flex justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
              {!session ? (
                <button
                  onClick={() => onRecordStart(line.id)}
                  className="text-[var(--text-tertiary)] hover:text-red-500 transition-all hover:scale-125 p-1 active:scale-90"
                  title="Record Session"
                >
                  <Mic size={14} />
                </button>
              ) : (
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', session.id);
                    setDraggedSessionId(session.id);
                  }}
                  className="cursor-grab active:cursor-grabbing text-[var(--accent)] hover:text-[var(--text-main)] p-1 transition-transform hover:scale-110"
                >
                  <GripVertical size={14} />
                </div>
              )}
            </div>

            {/* Line Input */}
            <div className="flex-1 relative min-w-0">
              <AutoResizeTextarea
                id={`line-${line.id}`}
                value={line.text}
                onChange={(e) => handleLineChange(line.id, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index, line.id)}
                onFocus={() => setActiveLineId(line.id)}
                placeholder={index === 0 && lines.length === 1 ? "Start writing..." : ""}
                autoFocus={focusedLineId === line.id}
              />

              {/* Delete X for Line */}
              <button
                onClick={() => {
                  if (lines.length > 1) {
                    // Remove this line by updating section text
                    const updatedLines = lines.filter(l => l.id !== line.id);
                    const sectionMap = new Map<string, string>();
                    updatedLines.forEach(l => {
                      const existing = sectionMap.get(l.sectionId) || '';
                      sectionMap.set(l.sectionId, existing ? `${existing}\n${l.text}` : l.text);
                    });
                    const updatedSections = sections.map(section => ({
                      ...section,
                      text: sectionMap.get(section.id) || ''
                    }));
                    onUpdateSections(updatedSections);
                  } else {
                    handleLineChange(line.id, "");
                  }
                }}
                className="absolute -right-6 top-1 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-40 hover:opacity-100 hover:text-red-500 transition-all duration-300 active:scale-90"
              >
                <X size={12} />
              </button>
            </div>

            {/* Audio Pill */}
            {session && (
              <div
                className={`flex items-center gap-2 ml-3 pr-2 pl-1 py-1 rounded-full border transition-all select-none flex-shrink-0 ${isPlaying ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--bg-main)]' : 'bg-[var(--bg-secondary)] border-[var(--border-main)] text-[var(--text-secondary)]'}`}
              >
                <button onClick={() => onPlaySession(session.id)} className="p-0.5 hover:scale-110 transition-transform">
                  {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                </button>
                <button
                  onClick={() => removeSessionFromLine(line.id)}
                  className={`ml-1 hover:text-red-500 transition-colors ${isPlaying ? 'text-[var(--bg-main)] opacity-70' : 'text-[var(--text-tertiary)]'}`}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            )}
          </div>
        );
      })}


    </div>
  );
};
