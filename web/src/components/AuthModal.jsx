import React, { useState } from 'react'
import { orchestratorApi } from '../apiClient'

export default function AuthModal({ isOpen, onClose, initialMode = 'login', onAuthSuccess }) {
  const [mode, setMode] = useState(initialMode) // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  if (!isOpen) return null

  const resetForm = () => {
    setError(null)
    setPassword('')
    setConfirmPassword('')
  }

  const fillDemoCredentials = () => {
    setEmail('demo@cube.build')
    setPassword('DemoPassword123!')
    setConfirmPassword('DemoPassword123!')
    setName('Demo Operator')
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'login') {
        const data = await orchestratorApi.login(email.trim(), password)
        if (onAuthSuccess) onAuthSuccess(data.user)
        onClose()
      } else {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.')
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long.')
        }
        const data = await orchestratorApi.register(email.trim(), password, confirmPassword, name.trim())
        if (onAuthSuccess) onAuthSuccess(data.user)
        onClose()
      }
    } catch (err) {
      setError(err.message || 'Authentication error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius)',
          maxWidth: '440px',
          width: '100%',
          padding: '32px',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '18px',
          }}
          aria-label="Close"
        >
          ✕
        </button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--accent-soft)',
            border: '1px solid var(--border-strong)',
            marginBottom: '12px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sydon-blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
            {mode === 'login' ? 'Sign In to Orchestrator' : 'Create Operator Account'}
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            {mode === 'login' 
              ? 'Access independent agent workspaces & audit pipeline.'
              : 'Register to manage private executions & inspection evidence.'}
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
          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                Full Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--edge)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
              Work Email Address
            </label>
            <input
              type="email"
              required
              placeholder="operator@cube.build"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
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
              placeholder={mode === 'register' ? 'Min 8 chars, uppercase & digit' : '••••••••'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--surface2)',
                border: '1px solid var(--edge)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem',
              }}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--edge)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              marginTop: '8px',
              padding: '12px',
              fontWeight: 700,
              fontSize: '0.95rem',
              justifyContent: 'center',
            }}
          >
            {loading ? 'Authenticating...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div style={{ 
          marginTop: '18px', 
          paddingTop: '16px', 
          borderTop: '1px solid var(--edge)', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '10px',
          alignItems: 'center',
        }}>
          <button
            type="button"
            onClick={fillDemoCredentials}
            style={{
              background: 'none',
              border: '1px dashed var(--brand-500)',
              color: 'var(--brand-300)',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'center',
            }}
          >
            ⚡ Auto-Fill Demo Credentials (demo@cube.build)
          </button>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            {mode === 'login' ? "Don't have an account? " : "Already registered? "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login')
                resetForm()
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand-400)',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {mode === 'login' ? 'Create one now' : 'Sign in here'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
