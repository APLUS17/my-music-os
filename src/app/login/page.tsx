"use client";

import React, { useState, Suspense } from 'react';

export const dynamic = 'force-dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Music, Eye, EyeOff, Loader2 } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const errorParam = searchParams.get('error');

  React.useEffect(() => {
    if (errorParam) {
      toast.error(errorParam);
    }
  }, [errorParam]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Successfully logged in!');
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });

      if (error) {
        toast.error(error.message);
        setIsGoogleLoading(false);
      }
    } catch (err) {
      toast.error('Failed to initialize Google login.');
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--accent)]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--accent)]/5 blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white/[0.02] border border-white/5 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-[var(--accent)] text-[var(--bg-main)] flex items-center justify-center mb-4 shadow-lg shadow-[var(--accent)]/20">
            <Music size={24} className="stroke-[2.5]" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
            Welcome back
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1.5">
            Log in to continue your creative workflow
          </p>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mono uppercase tracking-wider text-[var(--text-secondary)] mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@domain.com"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 focus:border-[var(--accent)]/50 focus:bg-white/[0.05] transition-all text-sm outline-none placeholder:text-[var(--text-tertiary)] text-[var(--text-main)]"
              disabled={isLoading || isGoogleLoading}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold mono uppercase tracking-wider text-[var(--text-secondary)]">
                Password
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-10 rounded-xl bg-white/[0.03] border border-white/5 focus:border-[var(--accent)]/50 focus:bg-white/[0.05] transition-all text-sm outline-none placeholder:text-[var(--text-tertiary)] text-[var(--text-main)]"
                disabled={isLoading || isGoogleLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-white/90 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none mt-2 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              'Log In'
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/5"></div>
          </div>
          <div className="relative flex justify-center text-xs mono uppercase">
            <span className="bg-[var(--bg-main)] px-3 text-[var(--text-tertiary)]">
              Or connect with
            </span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading || isGoogleLoading}
          className="w-full py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 active:scale-[0.98] transition-all text-sm font-medium flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          {isGoogleLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <p className="text-center text-xs text-[var(--text-secondary)] mt-8">
          Don't have an account?{' '}
          <Link href="/signup" className="text-white hover:text-[var(--accent)] font-semibold transition-colors">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex items-center justify-center p-6">
        <Loader2 className="animate-spin text-[var(--accent)]" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
