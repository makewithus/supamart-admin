import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { AlertCircle } from 'lucide-react';
import { auth } from '../config/firebase';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Stamp session with build id so stale deployments don't linger
      if (typeof __BUILD_ID__ !== 'undefined') {
        localStorage.setItem('ms_admin_build_id', __BUILD_ID__);
      }
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const msgs = {
        'auth/invalid-credential': 'Incorrect email or password.',
        'auth/user-not-found': 'No account found for this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/too-many-requests': 'Too many attempts. Sign-in is locked for 15 minutes.',
        'auth/network-request-failed': 'Network error. Check your connection.',
      };
      setError(msgs[err.code] || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error('Please enter your email address first.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent to your inbox.');
    } catch (err) {
      toast.error('Could not send reset email. Contact store owner.');
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F9FAFB] font-sans antialiased">
      {/* ── Left Deep Green Brand Panel ── */}
      <div className="hidden lg:flex lg:w-[44%] bg-[#084223] flex-col justify-between p-12 lg:p-16 text-white relative">
        {/* Top Logo + Brand */}
        <div className="flex items-center gap-3">
          <img
            src="/branding/ms-traders-horizontal-reversed.svg"
            alt="MS Traders"
            className="h-10 w-auto object-contain"
          />
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 bg-white/10 px-2 py-0.5 rounded-full border border-white/15">
            Admin
          </span>
        </div>

        {/* Bottom Headline, Subtitle, Divider & Footer */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl lg:text-[40px] font-extrabold text-white leading-[1.18] tracking-tight">
              Run the store from one<br />place.
            </h1>
            <p className="text-sm text-[#A7D3B9] leading-relaxed mt-4 max-w-sm">
              Orders, payments, deliveries and stock for the Menamkulam store.
            </p>
          </div>

          <div className="pt-6 border-t border-[#165632] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[#7DAF93] font-medium">
            <span>Staff access only · Menamkulam</span>
            <div className="flex items-center gap-1.5">
              <span>Support / Grievance:</span>
              <a
                href="mailto:hassanramla31@gmail.com"
                className="text-white hover:underline transition-all font-semibold"
              >
                hassanramla31@gmail.com
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          {/* Mobile Top Brand Header */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <img
              src="/branding/ms-traders-horizontal-colour.svg"
              alt="MS Traders"
              className="h-8 w-auto object-contain shrink-0"
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A7C47] bg-[#E6F4EA] px-2 py-0.5 rounded-full border border-[#0A7C47]/20">
              Admin
            </span>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Sign in</h2>
            <p className="text-xs text-gray-500 mt-1">Use the email your store owner invited.</p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-600 rounded-xl px-3.5 py-2.5 mb-5 text-xs font-medium">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@mstraders.in"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700">Password</label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-semibold text-[#0A7C47] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-3.5 pr-14 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="keep-signed-in"
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#0A7C47] focus:ring-[#0A7C47] cursor-pointer"
              />
              <label htmlFor="keep-signed-in" className="text-xs text-gray-600 cursor-pointer select-none">
                Keep me signed in on this computer
              </label>
            </div>

            {/* Sign in Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 rounded-xl bg-[#0A7C47] hover:bg-[#08683A] active:bg-[#06542F] text-white text-xs sm:text-sm font-semibold transition-colors shadow-2xs disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Security lock note */}
          <p className="text-[11px] text-gray-400 text-center mt-5">
            After 5 wrong attempts, sign-in is locked for 15 minutes.
          </p>
        </div>
      </div>
    </div>
  );
}
