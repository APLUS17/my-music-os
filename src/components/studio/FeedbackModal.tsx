import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface FeedbackModalProps {
    onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose }) => {
    // ---------------------------------------------------------
    // TODO: Replace this with your actual Tally Form URL
    // Create form at tally.so -> Share -> Get Link
    const TALLY_FORM_URL = "https://tally.so/embed/5Bx67N?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1";
    // ---------------------------------------------------------

    return (
        <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-md h-[80vh] p-0 overflow-hidden flex flex-col bg-[var(--bg-card)] border-[var(--border-main)]">
                <DialogHeader className="p-4 border-b border-[var(--border-main)] bg-[var(--bg-secondary)] space-y-0">
                    <DialogTitle className="text-sm font-medium text-[var(--text-main)] ml-2">
                        Beta Feedback
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 bg-[var(--bg-main)]">
                    <iframe
                        src={TALLY_FORM_URL}
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        marginHeight={0}
                        marginWidth={0}
                        title="Feedback Form"
                        className="w-full h-full"
                    ></iframe>
                </div>
            </DialogContent>
        </Dialog>
    );
};
