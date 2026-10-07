import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(location.state?.prefillEmail || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(location.state?.successMessage || null);
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(trimmedEmail, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      <div className="w-full max-w-md saas-card p-8 border border-slate-800 shadow-2xl">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center text-white mb-3 shadow-md">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">RecoveryOS</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Deterministic chargeback audit and evidence verification platform
          </p>
        </div>

        {/* Success Alert (e.g. from registration) */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              id="login-email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@company.com"
              className="form-input"
              required
              autoFocus={!email}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300 uppercase">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <input
              type="password"
              name="password"
              id="login-password-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="form-input"
              required
            />
          </div>

          <button
            type="submit"
            id="login-submit-btn"
            disabled={loading}
            className="w-full btn btn-primary mt-2"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-400 font-semibold hover:underline">
            Register here
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="modal-overlay" onClick={() => setShowForgotModal(false)}>
          <div className="modal-card max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-2">Password Reset</h3>
            <p className="text-xs text-slate-400 mb-4">
              Password self-service is managed by your organization's workspace administrator. Please reach out to your IT or security administrator.
            </p>
            <button
              onClick={() => setShowForgotModal(false)}
              className="btn btn-primary btn-sm w-full"
            >
              Back to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
