import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { RecordingSession, AutoSection } from '@/types';
import { randomId } from '@/lib/utils/id';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

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
        <Dialog open={true} onOpenChange={(open) => { if (!open) onCancel(); }}>
            <DialogContent className="max-w-lg p-6 bg-[var(--bg-card)] border-white/10 rounded-3xl shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-[var(--accent)]">Edit Splits</DialogTitle>
                    <DialogDescription className="hidden">Manual split and merge tool for audio sections.</DialogDescription>
                </DialogHeader>

                <div className="mb-6 bg-black/40 rounded-xl p-4">
                    <label className="text-sm font-medium text-[var(--text-secondary)] block mb-4">
                        Set Split Playhead ({(splitPoint).toFixed(2)}s)
                    </label>
                    <Slider
                        min={0}
                        max={session.duration || 100}
                        step={0.1}
                        value={[splitPoint]}
                        onValueChange={(val) => setSplitPoint(val[0])}
                        className="mb-6"
                    />
                    <Button
                        onClick={handleSplit}
                        variant="secondary"
                        className="w-full bg-[var(--text-main)] text-[var(--bg-main)] hover:bg-[var(--text-main)]/90 font-bold rounded-full"
                    >
                        Split Here
                    </Button>
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

                <Button
                    onClick={() => onSave(sections)}
                    className="w-full py-6 rounded-xl font-bold bg-[var(--accent)] text-black hover:brightness-110 active:scale-95 transition-all text-lg gap-2"
                >
                    <Check size={20} />
                    Save Changes
                </Button>
            </DialogContent>
        </Dialog>
    );
};
