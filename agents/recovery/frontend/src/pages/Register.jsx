import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../services/api';
import { ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setError('Please provide a valid name (at least 2 characters).');
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        name: trimmedName,
        full_name: trimmedName,
        email: trimmedEmail,
        password,
        confirm_password: confirmPassword
      });

      // Requirement: Success → Login
      navigate('/login', {
        state: {
          successMessage: 'Account registered successfully. Please log in with your credentials.',
          prefillEmail: trimmedEmail
        }
      });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
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
          <h1 className="text-xl font-bold text-white tracking-tight">Create RecoveryOS Account</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Start auditing dispute charges with deterministic evidence recovery
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Name
            </label>
            <input
              type="text"
              name="name"
              id="name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Morgan"
              className="form-input"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              id="email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@company.com"
              className="form-input"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Password (min. 6 characters)
            </label>
            <input
              type="password"
              name="password"
              id="password-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="form-input"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirm_password"
              id="confirm-password-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="form-input"
              required
            />
          </div>

          <button
            type="submit"
            id="register-submit-btn"
            disabled={loading}
            className="w-full btn btn-primary mt-2"
          >
            <span>{loading ? 'Creating Account...' : 'Register Account'}</span>
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
