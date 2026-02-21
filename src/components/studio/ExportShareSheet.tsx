'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, FileText, FileDown, Check } from 'lucide-react';
import { LyricSection } from '../../types';

interface ExportShareSheetProps {
    sections: LyricSection[];
    projectTitle: string;
    onClose: () => void;
}

const sectionLabel = (type: string, index: number, sections: LyricSection[]): string => {
    const sameType = sections.filter(s => s.type === type);
    const typeIndex = sameType.length > 1
        ? sameType.findIndex(s => s === sections[index]) + 1
        : 0;
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    return typeIndex > 0 ? `${label} ${typeIndex}` : label;
};

const formatLyrics = (sections: LyricSection[], includeHeaders = true): string => {
    return sections
        .map((section, i) => {
            const header = includeHeaders ? `[${sectionLabel(section.type, i, sections)}]` : '';
            const text = section.text?.trim() || '';
            return header ? `${header}\n${text}` : text;
        })
        .filter(block => block.trim().length > 0)
        .join('\n\n');
};

export const ExportShareSheet: React.FC<ExportShareSheetProps> = ({
    sections,
    projectTitle,
    onClose
}) => {
    const [copied, setCopied] = useState(false);
    const [activeAction, setActiveAction] = useState<string | null>(null);
    const printFrameRef = useRef<HTMLIFrameElement>(null);

    const title = projectTitle || 'Untitled Project';
    const dateStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Copy all lyrics to clipboard
    const handleCopy = async () => {
        const text = `${title}\n\n${formatLyrics(sections)}`;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setActiveAction('copy');
            setTimeout(() => {
                setCopied(false);
                setActiveAction(null);
            }, 2000);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setActiveAction('copy');
            setTimeout(() => {
                setCopied(false);
                setActiveAction(null);
            }, 2000);
        }
    };

    // Download as .txt
    const handleExportTxt = () => {
        setActiveAction('txt');
        const text = `${title}\n${dateStr}\n${'─'.repeat(40)}\n\n${formatLyrics(sections)}`;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setTimeout(() => setActiveAction(null), 1500);
    };

    // Export as PDF via print
    const handleExportPdf = () => {
        setActiveAction('pdf');
        const lyrics = formatLyrics(sections);
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            padding: 60px 48px;
            color: #111;
            background: #fff;
            line-height: 1.6;
        }
        .header {
            border-bottom: 2px solid #111;
            padding-bottom: 16px;
            margin-bottom: 40px;
        }
        .title {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
            margin-bottom: 6px;
        }
        .date {
            font-size: 12px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .section-block {
            margin-bottom: 32px;
        }
        .section-header {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 3px;
            color: #666;
            margin-bottom: 8px;
        }
        .section-text {
            font-size: 15px;
            white-space: pre-wrap;
            line-height: 1.8;
        }
        .footer {
            margin-top: 60px;
            padding-top: 16px;
            border-top: 1px solid #ddd;
            font-size: 10px;
            color: #aaa;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        @media print {
            body { padding: 40px 32px; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">${title}</div>
        <div class="date">${dateStr}</div>
    </div>
    ${sections
                .filter(s => s.text?.trim())
                .map((s, i) => `
    <div class="section-block">
        <div class="section-header">${sectionLabel(s.type, i, sections)}</div>
        <div class="section-text">${(s.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>`)
                .join('')}
    <div class="footer">Created with Lyriq</div>
</body>
</html>`;

        // Use a hidden iframe for printing
        const iframe = printFrameRef.current;
        if (iframe) {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc) {
                doc.open();
                doc.write(html);
                doc.close();
                setTimeout(() => {
                    iframe.contentWindow?.print();
                    setActiveAction(null);
                }, 300);
            }
        } else {
            // Fallback: open in new window
            const win = window.open('', '_blank');
            if (win) {
                win.document.write(html);
                win.document.close();
                setTimeout(() => {
                    win.print();
                    setActiveAction(null);
                }, 300);
            }
        }
    };

    const actions = [
        {
            id: 'copy',
            icon: copied ? <Check size={22} /> : <Copy size={22} />,
            label: copied ? 'Copied!' : 'Copy All',
            desc: 'Copy formatted lyrics to clipboard',
            onClick: handleCopy,
        },
        {
            id: 'txt',
            icon: <FileText size={22} />,
            label: 'Export .txt',
            desc: 'Download as plain text file',
            onClick: handleExportTxt,
        },
        {
            id: 'pdf',
            icon: <FileDown size={22} />,
            label: 'Export PDF',
            desc: 'Print or save as PDF',
            onClick: handleExportPdf,
        },
    ];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-end justify-center"
                onClick={onClose}
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                {/* Sheet */}
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-lg mx-auto"
                >
                    <div className="bg-[var(--bg-card)] border-t border-x border-[var(--border-main)] rounded-t-3xl shadow-[0_-20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
                        {/* Handle */}
                        <div className="w-full flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 rounded-full bg-white/20" />
                        </div>

                        {/* Header */}
                        <div className="px-6 pt-2 pb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-[var(--text-main)] tracking-tight">Export</h2>
                                <p className="text-[11px] text-[var(--text-tertiary)] mono uppercase tracking-widest mt-0.5">{title}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-9 h-9 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all active:scale-95"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="px-6 pb-8 space-y-3">
                            {actions.map((action) => (
                                <button
                                    key={action.id}
                                    onClick={action.onClick}
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 active:scale-[0.98] group ${activeAction === action.id
                                            ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]'
                                            : 'bg-[var(--bg-secondary)] border-[var(--border-main)] text-[var(--text-main)] hover:border-[var(--text-tertiary)]'
                                        }`}
                                >
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${activeAction === action.id
                                            ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                                            : 'bg-[var(--bg-main)] text-[var(--text-secondary)] group-hover:text-[var(--accent)]'
                                        }`}>
                                        {action.icon}
                                    </div>
                                    <div className="text-left">
                                        <div className="text-sm font-medium">{action.label}</div>
                                        <div className="text-[11px] text-[var(--text-tertiary)]">{action.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Safe area padding for mobile */}
                        <div className="h-6" />
                    </div>
                </motion.div>

                {/* Hidden iframe for PDF printing */}
                <iframe
                    ref={printFrameRef}
                    className="hidden"
                    title="print-frame"
                />
            </motion.div>
        </AnimatePresence>
    );
};
