import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { RecordingSession, AutoSection } from '@/types';
import { randomId } from '@/lib/utils/id';

interface SplitEditorProps {
    session: RecordingSession;
    onSave: (sections: AutoSection[]) => void;
    onCancel: () => void;
}

export const SplitEditor: React.FC<SplitEditorProps> = ({ session, onSave, onCancel }) => {
    const [sections, setSections] = useState<AutoSection[]>(session.sections);
    const [splitPoint, setSplitPoint] = useState<number>(Math.min(2.0, (session.duration || 0) / 2));

    // Placeholder simplified editor for manual split/merge.
    // In a full implementation, this uses a robust waveform UI.
    // Here we provide a slider to pick a spot and cut the selected section.

    const handleSplit = () => {
        // Find section crossing the splitPoint
        const targetIdx = sections.findIndex(s => s.startTime < splitPoint && s.endTime > splitPoint);
        if (targetIdx !== -1) {
            const target = sections[targetIdx];
            const part1: AutoSection = {
                ...target,
                id: randomId(),
                endTime: splitPoint
            };
            const part2: AutoSection = {
                ...target,
                id: randomId(),
                startTime: splitPoint
            };
            const newSections = [...sections];
            newSections.splice(targetIdx, 1, part1, part2);
            setSections(newSections.sort((a, b) => a.startTime - b.startTime));
        }
    };

    const handleMerge = (index: number) => {
        if (index >= sections.length - 1) return;
        const s1 = sections[index];
        const s2 = sections[index + 1];

        // Merge only if contiguous or close
        const merged: AutoSection = {
            ...s1,
            id: randomId(),
            endTime: s2.endTime
        };

        const newSections = [...sections];
        newSections.splice(index, 2, merged);
        setSections(newSections);
    };

    return (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[var(--bg-card)] border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative"
            >
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                    <X size={20} />
                </button>

                <h3 className="text-xl font-bold mb-6 text-[var(--accent)]">Edit Splits</h3>

                <div className="mb-6 bg-black/40 rounded-xl p-4">
                    <label className="text-sm font-medium text-[var(--text-secondary)] block mb-4">Set Split Playhead ({(splitPoint).toFixed(2)}s)</label>
                    <input
                        type="range"
                        min="0"
                        max={session.duration || 0}
                        step="0.1"
                        value={splitPoint}
                        onChange={(e) => setSplitPoint(parseFloat(e.target.value))}
                        className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer mb-4"
                    />
                    <button
                        onClick={handleSplit}
                        className="px-4 py-2 bg-[var(--text-main)] text-[var(--bg-main)] rounded-full text-sm font-bold w-full"
                    >
                        Split Here
                    </button>
                </div>

                <div className="max-h-64 overflow-y-auto pr-2 mb-6 border border-white/5 rounded-xl p-2 bg-black/20">
                    <div className="text-xs uppercase tracking-widest text-white/50 mb-2 font-bold px-2">Sections</div>
                    {sections.map((sec, i) => (
                        <div key={sec.id} className="flex items-center justify-between bg-white/5 p-3 rounded-lg mb-2">
                            <span className="text-sm">{(sec.startTime).toFixed(2)}s - {(sec.endTime).toFixed(2)}s</span>
                            <div className="flex gap-2">
                                {i < sections.length - 1 && (
                                    <button
                                        onClick={() => handleMerge(i)}
                                        className="text-xs bg-white/10 px-2 py-1 rounded text-[var(--text-secondary)] hover:text-white"
                                    >
                                        Merge Next
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => onSave(sections)}
                    className="w-full py-4 rounded-xl font-bold bg-[var(--accent)] text-black flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all text-lg"
                >
                    <Check size={20} />
                    Save Changes
                </button>

            </motion.div>
        </div>
    );
};
