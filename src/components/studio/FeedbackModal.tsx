import React, { useState } from 'react';
import { X } from 'lucide-react';

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-md h-[80vh] bg-[var(--bg-card)] border border-[var(--border-main)] ring-1 ring-white/10 rounded-2xl shadow-2xl relative m-4 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-[var(--border-main)] bg-[var(--bg-secondary)]">
                    <h3 className="text-sm font-medium text-[var(--text-main)] ml-2">Beta Feedback</h3>
                    <button
                        onClick={onClose}
                        className="text-[var(--text-tertiary)] hover:text-[var(--text-main)] transition-colors p-1 rounded-md hover:bg-[var(--bg-main)]"
                    >
                        <X size={18} />
                    </button>
                </div>

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
            </div>
        </div>
    );
};
