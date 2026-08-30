'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthGate() {
  const { signInWithEmail, verifyOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const { error } = await signInWithEmail(email.trim());
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      setStep('verify');
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    const { error } = await verifyOtp(email.trim(), code.trim());
    setLoading(false);
    if (error) setError(error);
    // On success auth state change fires — middleware redirects
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      {/* Wordmark — the only decoration on the page */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-14 text-center"
      >
        <h1 className="text-2xl font-semibold tracking-tight text-white">Lyriq</h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[320px]"
      >
        <AnimatePresence mode="wait">
          {step === 'email' ? (
            <motion.form
              key="email"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleSendCode}
              className="space-y-4"
            >
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3.5 text-base text-white placeholder-white/30 outline-none focus:border-white/25 transition-colors"
              />
              {error && <p className="text-xs text-[var(--studio-red)] px-1">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[var(--accent)] text-black font-medium py-3.5 text-sm active:scale-[0.98] transition disabled:opacity-40"
              >
                {loading ? 'Sending…' : 'Continue'}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="verify"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleVerify}
              className="space-y-4"
            >
              <p className="text-sm text-white/40 text-center px-1">
                Code sent to <span className="text-white/70">{email}</span>
              </p>
              <input
                type="text"
                inputMode="numeric"
                placeholder="––––––"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
                className="w-full rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3.5 text-lg text-white placeholder-white/20 outline-none focus:border-white/25 transition-colors tracking-[0.5em] text-center font-mono"
              />
              {error && <p className="text-xs text-[var(--studio-red)] text-center">{error}</p>}
              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full rounded-full bg-[var(--accent)] text-black font-medium py-3.5 text-sm active:scale-[0.98] transition disabled:opacity-40"
              >
                {loading ? 'Verifying…' : 'Enter'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setError(null); setCode(''); }}
                className="w-full text-xs text-white/30 hover:text-white/60 transition-colors py-1"
              >
                Use a different email
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
