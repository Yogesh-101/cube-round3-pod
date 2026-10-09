import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
import {
  ShieldCheck, Activity, Database, Network,
  ArrowRight, Box, PackageCheck, RefreshCcw, AlertTriangle, Play
} from 'lucide-react';
import Hero from './components/ui/animated-shader-hero';

// ------------------------------------------------------------------
// STAGE CARD
// ------------------------------------------------------------------
const StageCard = ({ icon: Icon, title, desc, color, delay }) => (
  <div
    data-aos="fade-up"
    data-aos-delay={delay}
    style={{
      background: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(16px)',
      border: `1px solid rgba(255, 255, 255, 0.05)`,
      borderTop: `2px solid ${color}`,
      borderRadius: '16px',
      padding: '32px',
      flex: '1 1 280px',
      maxWidth: '340px',
      transition: 'all 0.3s ease',
      cursor: 'default',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-6px)';
      e.currentTarget.style.boxShadow = `0 20px 40px -10px ${color}44`;
      e.currentTarget.style.background = 'rgba(30, 41, 59, 0.8)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)';
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
      <div style={{ padding: '12px', background: `${color}1A`, borderRadius: '12px', color: color, flexShrink: 0 }}>
        <Icon size={26} />
      </div>
      <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc', fontWeight: 600 }}>{title}</h3>
    </div>
    <p style={{ margin: 0, color: '#94a3b8', lineHeight: 1.65, fontSize: '0.92rem' }}>{desc}</p>
  </div>
);

// ------------------------------------------------------------------
// FEATURE ROW
// ------------------------------------------------------------------
const FeatureRow = ({ title, desc, icon: Icon, reversed }) => (
  <div
    data-aos={reversed ? 'fade-left' : 'fade-right'}
    style={{
      display: 'flex',
      flexDirection: reversed ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: '48px',
      padding: '56px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      flexWrap: 'wrap'
    }}
  >
    <div style={{ flex: '1 1 380px' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '64px', height: '64px', borderRadius: '16px',
        background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', marginBottom: '24px'
      }}>
        <Icon size={32} />
      </div>
      <h2 style={{ fontSize: '2rem', color: '#f8fafc', margin: '0 0 16px 0', fontWeight: 700, lineHeight: 1.2 }}>{title}</h2>
      <p style={{ fontSize: '1.05rem', color: '#94a3b8', lineHeight: 1.75, margin: 0 }}>{desc}</p>
    </div>
    <div style={{ flex: '1 1 360px', display: 'flex', justifyContent: 'center' }}>
      <div style={{
        width: '100%', minHeight: '260px', borderRadius: '20px',
        background: 'linear-gradient(145deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9))',
        border: '1px solid rgba(59,130,246,0.1)',
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.07, backgroundImage: 'radial-gradient(circle at center, #60a5fa 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <Icon size={90} color="rgba(96,165,250,0.08)" />
      </div>
    </div>
  </div>
);

// ------------------------------------------------------------------
// MAIN LANDING COMPONENT
// ------------------------------------------------------------------
export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    AOS.init({ duration: 800, once: true, easing: 'ease-out-cubic', offset: 50 });
  }, []);

  return (
    <div style={{
      width: '100vw', minHeight: '100vh',
      background: '#020617', color: '#f8fafc',
      overflowX: 'hidden',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>

      {/* ── NAVBAR ───────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
        <nav style={{
          maxWidth: '1300px', margin: '0 auto',
          background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)', borderBottom: '2px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '999px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 10px 8px 20px', boxShadow: '0 8px 32px -8px rgba(59, 130, 246, 0.2)'
        }}>
          {/* Brand */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Box size={18} color="#60a5fa" />
            </div>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              Orchestrator
            </span>
          </div>

          {/* Center links */}
          <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
            {[
              { label: 'Home', href: '#' },
              { label: 'Features', href: '#features' },
              { label: 'Architecture', href: '#architecture' },
            ].map(({ label, href }) => (
              <a
                key={label} href={href}
                style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s' }}
                onMouseOver={e => e.currentTarget.style.color = '#fff'}
                onMouseOut={e => e.currentTarget.style.color = '#94a3b8'}
              >
                {label}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <a
              href="#"
              style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s' }}
              onMouseOver={e => e.currentTarget.style.color = '#fff'}
              onMouseOut={e => e.currentTarget.style.color = '#94a3b8'}
            >
              Sign In
            </a>
            <button
              onClick={() => navigate('/app')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '11px 22px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
                border: 'none', borderRadius: '999px', fontSize: '0.9rem',
                fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: '0 4px 14px rgba(59,130,246,0.4)'
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(59,130,246,0.6)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(59,130,246,0.4)'; }}
            >
              Enter Platform <ArrowRight size={16} />
            </button>
          </div>
        </nav>
      </div>

      {/* ── HERO (WebGL Shader) ───────────────────────────────── */}
      <Hero
        trustBadge={{ text: 'Multi-Agent Orchestrator' }}
        headline={{ line1: 'Sovereign Fulfillment.', line2: 'Cryptographic Trust.' }}
        subtitle="A deterministic orchestrator uniting 5 independent AI agents. From receiving docks to return flows — every stage produces auditable, cryptographic evidence."
        buttons={{
          primary: { text: 'Open Live Dashboard', onClick: () => navigate('/app') },
          secondary: { text: 'Explore Agents', icon: <Play size={18} />, onClick: () => { document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' }); } }
        }}
      />

      {/* ── AGENT FLEET ──────────────────────────────────────── */}
      <section id="architecture" style={{ padding: '120px 24px', background: '#020617' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div data-aos="fade-up" style={{ textAlign: 'center', marginBottom: '72px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '999px', color: '#60a5fa', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '1px', marginBottom: '20px' }}>
              AGENT ARCHITECTURE
            </div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 700, margin: '0 0 20px 0', color: '#f8fafc' }}>The Agent Fleet</h2>
            <p style={{ fontSize: '1.1rem', color: '#94a3b8', maxWidth: '640px', margin: '0 auto', lineHeight: 1.65 }}>
              The orchestrator manages distinct, loosely-coupled agents handling specific physical fulfillment states. Every stage produces cryptographic evidence.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'center' }}>
            <StageCard delay="0" color="#3b82f6" icon={Box} title="Receiving Agent" desc="Verifies vendor shipments at the dock. Audits inbound POs, flags quantity mismatches, and issues first-mile evidence records." />
            <StageCard delay="100" color="#10b981" icon={RefreshCcw} title="Prep Agent" desc="Ensures individual items are barcoded, poly-bagged, or bubble-wrapped according to strict warehouse routing requirements." />
            <StageCard delay="200" color="#8b5cf6" icon={PackageCheck} title="Pack Manager" desc="Order-blind VLM inspection of open cartons. Implements scene-coverage analysis and robust substitution detection before sealing." />
            <StageCard delay="300" color="#f59e0b" icon={AlertTriangle} title="Returns Agent" desc="Inspects customer returns. Determines grading condition, restock viability, and detects policy abuse or missing accessories." />
            <StageCard delay="400" color="#06b6d4" icon={Network} title="Recovery Agent" desc="Deep conflict resolution. Investigates cross-stage discrepancies, checks missing items against scale weight, and proposes resolution actions." />
          </div>
        </div>
      </section>

      {/* ── FEATURE ROWS ─────────────────────────────────────── */}
      <section id="features" style={{ padding: '80px 24px 120px', background: '#020617' }}>
        <div style={{ maxWidth: '1060px', margin: '0 auto' }}>
          <div data-aos="fade-up" style={{ textAlign: 'center', marginBottom: '72px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '999px', color: '#60a5fa', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '1px', marginBottom: '20px' }}>
              CORE CAPABILITIES
            </div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 700, margin: 0, color: '#f8fafc' }}>Built for production. Not demos.</h2>
          </div>
          <FeatureRow title="Immutable Evidence Records" desc="Every agent emits a deterministic JSON envelope. Outcomes, decisions, and raw VLM outputs are signed with SHA-256 hashes. The orchestrator references these hashes, ensuring a fully auditable chain of custody that survives process restarts and disputes." icon={Database} reversed={false} />
          <FeatureRow title="Fail-Open Architecture" desc="The physical world doesn't pause for 503 errors. If the VLM hallucinates or an API times out, the agent falls back to PENDING_REVIEW. Operators are never blocked by the software, and decisions are safely routed to human dashboards." icon={Activity} reversed={true} />
          <FeatureRow title="Deterministic Decision Engine" desc="We separate vision from reasoning. The Vision Language Model operates at Temperature 0.0 to strictly report physical geometry and features. A deterministic, rule-based Python engine digests this to render the final PASS/FAIL verdict, eliminating LLM flakiness." icon={ShieldCheck} reversed={false} />
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section style={{ padding: '120px 24px', background: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)', textAlign: 'center' }}>
        <div data-aos="zoom-in" style={{ maxWidth: '760px', margin: '0 auto', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(59,130,246,0.15)', padding: '72px 32px', borderRadius: '24px', backdropFilter: 'blur(12px)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
            <Box size={28} color="#60a5fa" />
          </div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 700, margin: '0 0 20px 0', color: '#f8fafc' }}>Ready to observe the orchestrator?</h2>
          <p style={{ fontSize: '1.1rem', color: '#94a3b8', margin: '0 0 40px 0', lineHeight: 1.65 }}>
            Enter the live dashboard to view workflow states, trace cryptographic evidence, and inspect multi-agent handoffs in real time.
          </p>
          <button
            onClick={() => navigate('/app')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '10px',
              padding: '16px 40px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
              border: 'none', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 8px 24px rgba(59,130,246,0.4)', transition: 'all 0.2s'
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(59,130,246,0.5)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(59,130,246,0.4)'; }}
          >
            Enter Dashboard <ArrowRight size={20} />
          </button>
        </div>

        {/* Footer */}
        <footer style={{
          marginTop: '100px', paddingTop: '32px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          maxWidth: '1200px', margin: '100px auto 0 auto',
          flexWrap: 'wrap', gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Box size={18} color="#60a5fa" />
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>Orchestrator<span style={{ color: '#60a5fa' }}>.</span></span>
          </div>
          <div style={{ color: '#475569', fontSize: '0.88rem' }}>
            Multi-Agent Orchestrator
          </div>
        </footer>
      </section>

    </div>
  );
}
