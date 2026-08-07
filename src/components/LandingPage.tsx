'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Mic, Waves, Sparkles, Check } from 'lucide-react';
import { saveEmailCapture } from '@/app/actions';

interface LandingPageProps {
    onEnterApp: () => void;
}

const fadeUp = {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
};

export default function LandingPage({ onEnterApp }: LandingPageProps) {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
            onEnterApp();
            return;
        }
        setSubmitting(true);
        await saveEmailCapture(email, 'landing_page');
        setSubmitted(true);
        setSubmitting(false);
        setTimeout(onEnterApp, 1200);
    };

    return (
        <div className="min-h-screen bg-[#000000] text-white flex flex-col overflow-x-hidden">
            {/* Nav */}
            <nav className="flex items-center justify-between px-6 pt-8 pb-4 max-w-5xl mx-auto w-full">
                <span className="text-sm font-bold tracking-[0.2em] uppercase text-white/90">Lyriq Lab</span>
                <button
                    onClick={onEnterApp}
                    className="text-xs text-white/50 hover:text-white transition-colors"
                >
                    Open App →
                </button>
            </nav>

            {/* Hero */}
            <section className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-20 max-w-2xl mx-auto w-full text-center">
                <motion.div
                    {...fadeUp}
                    transition={{ duration: 0.5 }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#7fff00]/10 border border-[#7fff00]/20 text-[#7fff00] text-[11px] font-semibold tracking-widest uppercase mb-8"
                >
                    <Sparkles size={11} />
                    AI that listens to your beat
                </motion.div>

                <motion.h1
                    {...fadeUp}
                    transition={{ duration: 0.5, delay: 0.08 }}
                    className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.1] mb-6"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                    The only songwriting app that{' '}
                    <span className="text-[#7fff00]">listens to your beat.</span>
                </motion.h1>

                <motion.p
                    {...fadeUp}
                    transition={{ duration: 0.5, delay: 0.15 }}
                    className="text-base text-white/60 leading-relaxed mb-10 max-w-lg"
                >
                    Write lyrics, record ideas, and finish songs — with an AI that hears your music and coaches your creative process in real time.
                </motion.p>

                {/* Email capture / CTA */}
                <motion.div
                    {...fadeUp}
                    transition={{ duration: 0.5, delay: 0.22 }}
                    className="w-full max-w-md"
                >
                    {submitted ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center justify-center gap-2 text-[#7fff00] font-semibold"
                        >
                            <Check size={18} />
                            You're in — opening Lyriq now...
                        </motion.div>
                    ) : (
                        <form onSubmit={handleEmailSubmit} className="flex gap-2">
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7fff00]/40 transition-colors"
                            />
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex items-center gap-2 px-6 py-3 bg-[#7fff00] text-black text-sm font-bold rounded-full hover:bg-[#7fff00]/90 active:scale-95 transition-all whitespace-nowrap disabled:opacity-60"
                            >
                                {submitting ? 'Opening...' : 'Start free'}
                                <ArrowRight size={14} />
                            </button>
                        </form>
                    )}
                    <p className="text-xs text-white/30 mt-3">No credit card. No setup. Free forever.</p>
                </motion.div>
            </section>

            {/* Problem */}
            <section className="px-6 py-16 border-t border-white/5 max-w-2xl mx-auto w-full">
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <p className="text-lg sm:text-xl text-white/70 leading-relaxed text-center">
                        The idea hits at 2am. You record a voice memo. Open your notes app. Type a few lines. Switch to GarageBand. Switch back to notes.{' '}
                        <span className="text-white">Then you forget what feeling you were chasing.</span>
                    </p>
                    <p className="text-center text-white/40 mt-6 text-sm">Three apps. One unfinished song. Again.</p>
                </motion.div>
            </section>

            {/* Features */}
            <section className="px-6 py-16 max-w-5xl mx-auto w-full">
                <div className="grid sm:grid-cols-3 gap-6">
                    {[
                        {
                            icon: <Sparkles size={20} className="text-[#7fff00]" />,
                            title: 'It hears your beat.',
                            body: 'Upload any beat. The AI analyzes the structure — where the verse feels right, where the chorus wants to hit, what mood the production is giving. Then it helps you write lyrics that actually fit.',
                        },
                        {
                            icon: <Mic size={20} className="text-[#7fff00]" />,
                            title: 'Record over your beat.',
                            body: 'Voice memo → text in seconds. Never lose what you were feeling in the moment. Every take is saved, timestamped, and searchable.',
                        },
                        {
                            icon: <Waves size={20} className="text-[#7fff00]" />,
                            title: 'Write in Flow or Structure.',
                            body: 'Freeform when ideas are raw. Structured cards when you\'re polishing. No friction switching between the two — same song, same data.',
                        },
                    ].map((f, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
                        >
                            <div className="w-10 h-10 rounded-xl bg-[#7fff00]/10 flex items-center justify-center mb-4">
                                {f.icon}
                            </div>
                            <h3 className="font-bold text-sm mb-2">{f.title}</h3>
                            <p className="text-xs text-white/50 leading-relaxed">{f.body}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Pricing */}
            <section className="px-6 py-16 border-t border-white/5 max-w-3xl mx-auto w-full">
                <motion.h2
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="text-center text-xl font-bold mb-10"
                >
                    Free forever. Upgrade when you're ready.
                </motion.h2>
                <div className="grid sm:grid-cols-2 gap-4">
                    {[
                        {
                            name: 'Free',
                            price: '$0',
                            features: ['3 projects', '20 AI messages / day', 'Beat upload + playback', 'Write + record'],
                            cta: 'Start free',
                            highlight: false,
                        },
                        {
                            name: 'Pro',
                            price: '$9 / mo',
                            alt: '$79 / yr',
                            features: ['Unlimited AI', 'Export as PDF or TXT', 'Multi-device sync', 'Everything in Free'],
                            cta: 'Go Pro',
                            highlight: true,
                        },
                    ].map((tier, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className={`p-6 rounded-2xl border flex flex-col gap-4 ${
                                tier.highlight
                                    ? 'bg-[#7fff00]/5 border-[#7fff00]/30'
                                    : 'bg-white/[0.03] border-white/[0.06]'
                            }`}
                        >
                            <div>
                                <div className="text-xs font-bold tracking-widest uppercase text-white/50 mb-1">{tier.name}</div>
                                <div className="text-2xl font-black">{tier.price}</div>
                                {tier.alt && <div className="text-xs text-white/30 mt-0.5">or {tier.alt}</div>}
                            </div>
                            <ul className="space-y-2">
                                {tier.features.map(f => (
                                    <li key={f} className="flex items-center gap-2 text-xs text-white/70">
                                        <Check size={12} className="text-[#7fff00] flex-shrink-0" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={onEnterApp}
                                className={`w-full h-10 rounded-full text-sm font-bold transition-all active:scale-95 ${
                                    tier.highlight
                                        ? 'bg-[#7fff00] text-black hover:bg-[#7fff00]/90'
                                        : 'bg-white/10 text-white hover:bg-white/15'
                                }`}
                            >
                                {tier.cta}
                            </button>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Footer CTA */}
            <section className="px-6 py-16 text-center border-t border-white/5">
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                >
                    <p className="text-lg font-bold mb-2">Your next song is waiting.</p>
                    <p className="text-sm text-white/40 mb-8">It doesn't need another app. It needs the right one.</p>
                    <button
                        onClick={onEnterApp}
                        className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black text-sm font-bold rounded-full hover:bg-white/90 active:scale-95 transition-all"
                    >
                        Start writing free <ArrowRight size={16} />
                    </button>
                </motion.div>
                <p className="text-xs text-white/20 mt-12">
                    © 2026 Lyriq Lab — built for independent artists
                </p>
            </section>
        </div>
    );
}
