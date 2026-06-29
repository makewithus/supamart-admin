import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Mail, Lock, Eye, EyeOff, Zap, AlertCircle } from 'lucide-react';
import { auth } from '../config/firebase';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const msgs = {
        'auth/invalid-credential':      'Incorrect email or password.',
        'auth/user-not-found':          'No account found for this email.',
        'auth/wrong-password':          'Incorrect password.',
        'auth/too-many-requests':       'Too many attempts. Try again later.',
        'auth/network-request-failed':  'Network error. Check your connection.',
      };
      setError(msgs[err.code] || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-neutral-50 font-sans">
      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex w-2/5 bg-primary-900 flex-col justify-between p-10 relative overflow-hidden">
        {/* Decorative shapes */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-secondary-300/10" />
        <div className="absolute bottom-24 -left-12 w-48 h-48 rounded-full bg-tertiary-200/10" />
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-secondary-300/5 rounded-tl-[80px]" />

        {/* Brand mark */}
        <div className="flex items-center gap-3 relative z-10">
          <img src="/logo.png" alt="SupaMart" className="h-12 w-auto object-contain" />
          <div>
            <p className="text-white font-bold text-xl leading-none">Admin</p>
            <p className="text-neutral-500 text-xs mt-0.5">Console</p>
          </div>
        </div>

        {/* Center art */}
        <div className="relative z-10 space-y-4">
          <div className="flex gap-4">
            <div className="w-24 h-24 rounded-2xl bg-secondary-300/20 border border-secondary-300/20" />
            <div className="w-16 h-16 rounded-xl bg-tertiary-200/20 border border-tertiary-200/20 self-end" />
          </div>
          <div className="flex gap-3 items-end">
            <div className="w-12 h-20 rounded-xl bg-white/5 border border-white/10" />
            <div className="w-20 h-12 rounded-xl bg-secondary-300/15 border border-secondary-300/20" />
            <div className="w-10 h-16 rounded-lg bg-tertiary-200/15 border border-tertiary-200/20" />
          </div>
        </div>

        {/* Tagline */}
        <div className="relative z-10">
          <p className="text-white font-semibold text-xl leading-snug mb-2">
            The smarter way<br />to run your store.
          </p>
          <p className="text-neutral-500 text-sm leading-relaxed">
            Real-time orders, inventory, analytics — all in one place.
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          {/* Mobile brand mark */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <img src="/logo.png" alt="SupaMart" className="h-10 w-auto object-contain" />
            <p className="text-primary-900 font-bold text-lg">Admin</p>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary-900 mb-1.5">Welcome back</h1>
            <p className="text-neutral-400 text-sm">Sign in to your admin account to continue.</p>
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 mb-6 text-sm">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="email"
              label="Email address"
              icon={Mail}
              placeholder="admin@supamart.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Password</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                  <Lock size={16} strokeWidth={2} />
                </div>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-neutral-50 border border-neutral-200 text-primary-900 rounded-xl py-3 pl-10 pr-11 text-sm font-medium
                    placeholder:text-neutral-400 focus:outline-none focus:border-primary-900 focus:ring-2 focus:ring-primary-900/10
                    transition-all duration-150"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <p className="text-center text-xs text-neutral-300 mt-8">
            SupaMart Admin · Restricted access
          </p>
        </div>
      </div>
    </div>
  );
}
