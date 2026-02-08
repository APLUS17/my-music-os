import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Check } from 'lucide-react';

interface Step {
    targetId: string;
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    action?: () => void;
}

interface OnboardingTourProps {
    onComplete: () => void;
    setViewMode: (v: 'collection' | 'studio' | 'board' | 'settings') => void;
    setStudioMode: (s: 'flow' | 'arrange') => void;
    setShowRecorder: (b: boolean) => void;
    setRecorderMinimized: (b: boolean) => void;
    viewMode: string;
    studioMode: string;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
    onComplete,
    setViewMode,
    setStudioMode,
    setShowRecorder,
    setRecorderMinimized,
    viewMode,
    studioMode
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [rect, setRect] = useState<DOMRect | null>(null);

    const STEPS: Step[] = [
        {
            targetId: 'welcome-step',
            title: 'Welcome to Lyriq',
            content: "Your creative music OS. Let's walk through the essentials: from finding your vibe to recording bars.",
            position: 'bottom'
        },
        {
            targetId: 'tour-nav-library',
            title: 'Library',
            content: 'Your vault. All your projects, beats, and recordings live here. Start here to find your sound.',
            position: 'top',
            action: () => setViewMode('collection')
        },
        {
            targetId: 'tour-nav-studio',
            title: 'The Studio',
            content: 'Your creative canvas. This is where the magic happens—writing, recording, and arranging.',
            position: 'top',
            action: () => setViewMode('studio')
        },
        {
            targetId: 'tour-audio-controls',
            title: 'Beat Upload & Loop Controls',
            content: 'Upload a beat or loop here. The vibe starts with the instrumental—everything else follows.',
            position: 'bottom',
            action: () => setViewMode('studio')
        },
        {
            targetId: 'tour-mode-toggle',
            title: 'Flow & Write',
            content: 'Flow Mode: pure stream-of-consciousness. Write Mode: structured verses and hooks. Switch anytime—they stay in sync.',
            position: 'bottom'
        },
        {
            targetId: 'tour-nav-record',
            title: 'Capture & Pin',
            content: 'Hit this to record. Lay down bars, punch in takes, then pin your best take directly to any lyric section.',
            position: 'top',
            action: () => {
                setShowRecorder(true);
                setRecorderMinimized(true);
            }
        },
        {
            targetId: 'tour-lyric-card',
            title: 'Lyric Cards',
            content: 'Each section is a card with built-in recording. Record directly into verses, attach takes, and organize your song.',
            position: 'bottom',
            action: () => {
                setViewMode('studio');
                setStudioMode('arrange');
            }
        }
    ];

    const params = STEPS[currentStep];

    useEffect(() => {
        // Execute action associated with the step
        if (params.action) {
            params.action();
        }
    }, [currentStep, params]);

    useEffect(() => {
        const updateRect = () => {
            if (params.targetId === 'welcome-step') {
                const top = window.innerHeight / 2;
                const left = window.innerWidth / 2;
                setRect({ top, left, width: 0, height: 0, bottom: top, right: left, x: left, y: top, toJSON: () => { } });
                return;
            }

            const el = document.getElementById(params.targetId);
            if (el) {
                const r = el.getBoundingClientRect();
                const padding = 12;
                setRect({
                    top: r.top - padding,
                    left: r.left - padding,
                    width: r.width + (padding * 2),
                    height: r.height + (padding * 2),
                    bottom: r.bottom + padding,
                    right: r.right + padding,
                    x: r.left - padding,
                    y: r.top - padding,
                    toJSON: () => { }
                });
            } else {
                setRect(null);
            }
        };

        updateRect();
        window.addEventListener('resize', updateRect);
        const interval = setInterval(updateRect, 100);
        return () => {
            window.removeEventListener('resize', updateRect);
            clearInterval(interval);
        };
    }, [currentStep, params.targetId, viewMode, studioMode]);

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onComplete();
        }
    };

    if (!rect && params.targetId !== 'welcome-step') return null;

    const isWelcome = params.targetId === 'welcome-step';
    const tooltipX = isWelcome ? window.innerWidth / 2 : rect!.left + (rect!.width / 2);
    const clampedX = Math.max(160, Math.min(window.innerWidth - 160, tooltipX));

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-auto touch-none">
            {/* The Spotlight Overlay */}
            {!isWelcome && rect && (
                <div
                    className="absolute transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) shadow-[0_0_0_9999px_rgba(0,0,0,0.85)] rounded-2xl pointer-events-none border border-[var(--accent)]"
                    style={{
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height,
                    }}
                />
            )}

            {isWelcome && <div className="absolute inset-0 bg-[rgba(0,0,0,0.85)] backdrop-blur-md" />}

            {/* The Tooltip/Card */}
            <div
                className="absolute flex flex-col p-8 rounded-3xl bg-[#121212] border border-[var(--border-main)] shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 pointer-events-auto w-[calc(100%-48px)] max-w-[320px]"
                style={{
                    top: isWelcome
                        ? '50%'
                        : params.position === 'top'
                            ? rect!.top - 24
                            : rect!.bottom + 24,
                    left: clampedX,
                    transform: isWelcome
                        ? 'translate(-50%, -50%)'
                        : params.position === 'top'
                            ? 'translate(-50%, -100%)'
                            : 'translate(-50%, 0)'
                }}
            >
                <div className="mb-6">
                    <span className="text-[10px] mono uppercase tracking-widest text-[var(--accent)] mb-2 block">Step {currentStep + 1} of {STEPS.length}</span>
                    <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{params.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed font-light">{params.content}</p>
                </div>

                <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-1.5">
                        {STEPS.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1 rounded-full transition-all duration-500 ${idx === currentStep ? 'w-8 bg-[var(--accent)]' : 'w-1 bg-[var(--border-main)]'}`}
                            />
                        ))}
                    </div>

                    <button
                        onClick={handleNext}
                        className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
                    >
                        {currentStep === STEPS.length - 1 ? 'Start Flow' : 'Next'}
                        {currentStep === STEPS.length - 1 ? <Check size={14} strokeWidth={3} /> : <ChevronRight size={14} strokeWidth={3} />}
                    </button>
                </div>

                <button
                    onClick={onComplete}
                    className="absolute top-6 right-6 text-gray-600 hover:text-white transition-colors p-1"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
};
