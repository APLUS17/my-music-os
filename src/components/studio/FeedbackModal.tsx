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
            <DialogContent className="max-w-md h-[80vh] p-0 overflow-hidden flex flex-col bg-card border-border">
                <DialogHeader className="p-4 border-b border-border bg-secondary space-y-0">
                    <DialogTitle className="text-sm font-medium text-foreground ml-2">
                        Beta Feedback
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 bg-background">
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
