import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { orchestratorApi } from '../apiClient'
import '../App.css'

export default function Register() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Password and confirmation password do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setLoading(true)
    try {
      await orchestratorApi.register(email.trim(), password, confirmPassword, name.trim())
      navigate('/app')
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--ground)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius)',
        maxWidth: '460px',
        width: '100%',
        padding: '36px',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #3b82f6, #0284c7)',
            }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/>
              </svg>
            </span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>Cube Orchestrator</span>
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
            Register Operator Account
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Create your account to run autonomous agent workspaces.
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--stop-soft)',
            border: '1px solid var(--stop-edge)',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '18px',
            fontSize: '0.85rem',
            color: 'var(--stop)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
              Full Name
            </label>
            <input
              type="text"
              placeholder="e.g. Sarah Connor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px',
                background: 'var(--surface2)',
                border: '1px solid var(--edge)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="operator@cube.build"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px',
                background: 'var(--surface2)',
                border: '1px solid var(--edge)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>
                Password
              </label>
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'none', border: 'none', color: 'var(--brand-400)', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Min 8 chars, uppercase & digit"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px',
                background: 'var(--surface2)',
                border: '1px solid var(--edge)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px',
                background: 'var(--surface2)',
                border: '1px solid var(--edge)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              marginTop: '10px',
              padding: '13px',
              fontWeight: 700,
              fontSize: '0.95rem',
              justifyContent: 'center',
            }}
          >
            {loading ? 'Creating Account...' : 'Complete Registration'}
          </button>
        </form>

        <div style={{ 
          marginTop: '22px', 
          paddingTop: '18px', 
          borderTop: '1px solid var(--edge)', 
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--brand-400)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
