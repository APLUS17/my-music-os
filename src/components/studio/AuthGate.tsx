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
    <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
      >
        <h1 className="text-4xl font-bold tracking-tight text-white" style={{ fontFamily: 'var(--font-sans)' }}>
          LYRIQ
        </h1>
        <p className="mt-2 text-sm text-white/40 tracking-widest uppercase">Private Beta</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-sm"
      >
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
          <AnimatePresence mode="wait">
            {step === 'email' ? (
              <motion.form
                key="email"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                onSubmit={handleSendCode}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-lg font-semibold text-white">Sign in</h2>
                  <p className="mt-1 text-sm text-white/50">We'll send a code to your email.</p>
                </div>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#7fff00]/60 focus:ring-1 focus:ring-[#7fff00]/30 transition"
                />
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-[#7fff00] text-black font-semibold py-3 text-sm active:scale-95 transition disabled:opacity-50"
                >
                  {loading ? 'Sending…' : 'Send Code'}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="verify"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                onSubmit={handleVerify}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-lg font-semibold text-white">Check your inbox</h2>
                  <p className="mt-1 text-sm text-white/50">
                    Code sent to <span className="text-white/80">{email}</span>
                  </p>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoFocus
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#7fff00]/60 focus:ring-1 focus:ring-[#7fff00]/30 transition tracking-[0.3em] text-center font-mono"
                />
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || code.length < 6}
                  className="w-full rounded-full bg-[#7fff00] text-black font-semibold py-3 text-sm active:scale-95 transition disabled:opacity-50"
                >
                  {loading ? 'Verifying…' : 'Enter Studio'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(null); setCode(''); }}
                  className="w-full text-xs text-white/30 hover:text-white/60 transition"
                >
                  Use a different email
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <p className="mt-8 text-xs text-white/20 text-center max-w-xs">
        Lyriq Lab is in private beta. Your data is saved to your account and synced across devices.
      </p>
    </div>
  );
}
