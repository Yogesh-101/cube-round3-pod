import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
import {
  ShieldCheck, Activity, Database, Network,
  ArrowRight, Box, PackageCheck, RefreshCcw, AlertTriangle, Play,
  CheckCircle2, Terminal, Cpu, FileCheck, Lock, Layers, ExternalLink, ChevronRight
} from 'lucide-react';
import Hero from './components/ui/animated-shader-hero';

// ------------------------------------------------------------------
// METRICS BAR (Instant Enterprise Authority Above the Fold)
// ------------------------------------------------------------------
const MetricsBar = () => {
  const metrics = [
    { value: '5', label: 'Autonomous Stage Agents', sub: 'Dock to Return' },
    { value: '100%', label: 'SHA-256 Audit Trail', sub: 'Tamper-Proof Records' },
    { value: '<120ms', label: 'Deterministic Latency', sub: 'Real-Time Verification' },
    { value: '0.0', label: 'VLM Hallucination Policy', sub: 'Zero-Blind Spot Inspection' },
  ];

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '-40px auto 0 auto',
      padding: '0 24px',
      position: 'relative',
      zIndex: 20
    }}>
      <div style={{
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '20px',
        padding: '28px 36px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '28px',
        boxShadow: '0 20px 40px -15px rgba(2, 6, 23, 0.8), 0 0 20px rgba(59, 130, 246, 0.1)'
      }}>
        {metrics.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: 'column',
            borderRight: i < metrics.length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
            paddingRight: '16px'
          }}>
            <span style={{
              fontSize: '2rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #60a5fa 0%, #38bdf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.2
            }}>
              {m.value}
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginTop: '4px' }}>
              {m.label}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
              {m.sub}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// STAGE CARD (Elevated with Stage Badge & Capability Chips)
// ------------------------------------------------------------------
const StageCard = ({ stageNum, icon: Icon, title, desc, color, delay, tags }) => (
  <div
    data-aos="fade-up"
    data-aos-delay={delay}
    style={{
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderTop: `2px solid ${color}`,
      borderRadius: '20px',
      padding: '32px 28px',
      flex: '1 1 320px',
      maxWidth: '370px',
      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      cursor: 'default',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-6px)';
      e.currentTarget.style.boxShadow = `0 22px 44px -12px ${color}33`;
      e.currentTarget.style.borderColor = `${color}66`;
      e.currentTarget.style.background = 'rgba(23, 37, 84, 0.4)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
      e.currentTarget.style.background = 'rgba(15, 23, 42, 0.65)';
    }}
  >
    {/* Stage Sequence Badge */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <div style={{
        padding: '12px',
        background: `${color}18`,
        borderRadius: '14px',
        color: color,
        border: `1px solid ${color}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={24} />
      </div>
      <span style={{
        fontSize: '0.75rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        padding: '4px 10px',
        borderRadius: '999px',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        color: color
      }}>
        {stageNum}
      </span>
    </div>

    <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', color: '#f8fafc', fontWeight: 700 }}>
      {title}
    </h3>
    <p style={{ margin: '0 0 20px 0', color: '#94a3b8', lineHeight: 1.65, fontSize: '0.92rem', flex: 1 }}>
      {desc}
    </p>

    {/* Capability Chips */}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      {tags?.map((t, idx) => (
        <span key={idx} style={{
          fontSize: '0.72rem',
          padding: '3px 8px',
          borderRadius: '6px',
          background: 'rgba(255, 255, 255, 0.03)',
          color: '#cbd5e1',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          {t}
        </span>
      ))}
    </div>
  </div>
);

// ------------------------------------------------------------------
// INTERACTIVE EVIDENCE TERMINAL PREVIEW
// ------------------------------------------------------------------
const EvidenceShowcase = () => {
  const [activeTab, setActiveTab] = useState('envelope');

  return (
    <div data-aos="fade-up" style={{
      maxWidth: '1060px',
      margin: '0 auto 100px auto',
      padding: '0 24px'
    }}>
      <div style={{
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 24px 60px -15px rgba(2, 6, 23, 0.9), 0 0 30px rgba(59, 130, 246, 0.15)'
      }}>
        {/* Terminal Header */}
        <div style={{
          background: 'rgba(2, 6, 23, 0.95)',
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem', fontFamily: 'monospace' }}>
              <Terminal size={14} color="#60a5fa" />
              <span>orchestrator://evidence/unit-0001/audit.json</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('envelope')}
              style={{
                background: activeTab === 'envelope' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border: activeTab === 'envelope' ? '1px solid #3b82f6' : '1px solid transparent',
                color: activeTab === 'envelope' ? '#60a5fa' : '#94a3b8',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cryptographic Envelope
            </button>
            <button
              onClick={() => setActiveTab('pipeline')}
              style={{
                background: activeTab === 'pipeline' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border: activeTab === 'pipeline' ? '1px solid #3b82f6' : '1px solid transparent',
                color: activeTab === 'pipeline' ? '#60a5fa' : '#94a3b8',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Integrity Verification
            </button>
          </div>
        </div>

        {/* Terminal Content */}
        <div style={{ padding: '28px', fontFamily: '"JetBrains Mono", Consolas, monospace', fontSize: '0.88rem' }}>
          {activeTab === 'envelope' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              <div style={{ background: 'rgba(2, 6, 23, 0.7)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', color: '#93c5fd', lineHeight: 1.7 }}>
                <div style={{ color: '#64748b', marginBottom: '8px' }}>// Deterministic Evidence Record</div>
                <div><span style={{ color: '#c084fc' }}>"unit_id"</span>: <span style={{ color: '#34d399' }}>"UNIT-0001"</span>,</div>
                <div><span style={{ color: '#c084fc' }}>"stage"</span>: <span style={{ color: '#38bdf8' }}>"PACK_MANAGER"</span>,</div>
                <div><span style={{ color: '#c084fc' }}>"verdict"</span>: <span style={{ color: '#34d399' }}>"PASS"</span>,</div>
                <div><span style={{ color: '#c084fc' }}>"vlm_confidence"</span>: <span style={{ color: '#f59e0b' }}>0.994</span>,</div>
                <div><span style={{ color: '#c084fc' }}>"temperature"</span>: <span style={{ color: '#f59e0b' }}>0.0</span>,</div>
                <div><span style={{ color: '#c084fc' }}>"sha256"</span>: <span style={{ color: '#38bdf8' }}>"e3b0c44298fc1c149afbf4c8996fb92427ae41e4..."</span></div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'center' }}>
                <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CheckCircle2 color="#34d399" size={24} />
                  <div>
                    <div style={{ color: '#34d399', fontWeight: 700, fontSize: '0.9rem' }}>Cryptographically Sealed</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Signed with SHA-256 dock hash receipt</div>
                  </div>
                </div>

                <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Cpu color="#60a5fa" size={24} />
                  <div>
                    <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: '0.9rem' }}>Deterministic State Machine</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Vision strictly separated from rule execution</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {[
                  { title: 'Dock Handoff', hash: '8f43...1b22', status: 'VALIDATED' },
                  { title: 'Prep Barcode', hash: '5c21...89a0', status: 'COMPLIANT' },
                  { title: 'Carton Inspection', hash: '3e99...4d77', status: 'SEALED' },
                  { title: 'Returns Audit', hash: 'a10b...f384', status: 'CHAIN-SAFE' }
                ].map((item, i) => (
                  <div key={i} style={{ background: 'rgba(2, 6, 23, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '6px' }}>{item.title}</div>
                    <div style={{ fontSize: '0.85rem', color: '#38bdf8', marginBottom: '8px' }}>{item.hash}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={12} /> {item.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// FEATURE ROW (Upgraded with Interactive UI Preview Cards)
// ------------------------------------------------------------------
const FeatureRow = ({ title, desc, icon: Icon, reversed, previewComponent }) => (
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
        width: '60px', height: '60px', borderRadius: '16px',
        background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', marginBottom: '24px',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <Icon size={30} />
      </div>
      <h2 style={{ fontSize: '2rem', color: '#f8fafc', margin: '0 0 16px 0', fontWeight: 700, lineHeight: 1.25 }}>
        {title}
      </h2>
      <p style={{ fontSize: '1.05rem', color: '#94a3b8', lineHeight: 1.75, margin: 0 }}>
        {desc}
      </p>
    </div>

    <div style={{ flex: '1 1 360px', display: 'flex', justifyContent: 'center' }}>
      {previewComponent || (
        <div style={{
          width: '100%', minHeight: '260px', borderRadius: '20px',
          background: 'linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.85))',
          border: '1px solid rgba(59,130,246,0.15)',
          position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 16px 36px -10px rgba(0,0,0,0.5)'
        }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'radial-gradient(circle at center, #60a5fa 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <Icon size={80} color="rgba(96,165,250,0.15)" />
        </div>
      )}
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
      width: '100%',
      maxWidth: '100%',
      minHeight: '100vh',
      background: '#020617',
      color: '#f8fafc',
      overflowX: 'hidden',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>

      {/* ── NAVBAR ───────────────────────────────────────────── */}
      <div style={{ padding: '16px 20px', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
        <nav style={{
          maxWidth: '1240px',
          margin: '0 auto',
          background: 'rgba(2, 6, 23, 0.85)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: '2px solid rgba(59, 130, 246, 0.45)',
          borderRadius: '999px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 10px 8px 18px',
          boxShadow: '0 12px 36px -8px rgba(0, 0, 0, 0.7), 0 0 20px rgba(59, 130, 246, 0.15)'
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
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px rgba(59,130,246,0.2)'
            }}>
              <Box size={18} color="#60a5fa" />
            </div>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              Orchestrator<span style={{ color: '#38bdf8' }}>.</span>
            </span>
          </div>

          {/* Center navigation links */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[
              { label: 'Home', onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
              { label: 'Architecture', onClick: () => document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' }) },
              { label: 'Features', onClick: () => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }) },
            ].map(({ label, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '8px 16px',
                  borderRadius: '999px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.color = '#94a3b8';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* CTA Group */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => navigate('/app')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #3b82f6, #0284c7)',
                color: '#fff',
                border: 'none',
                borderRadius: '999px',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 4px 16px rgba(59,130,246,0.45)'
              }}
              onMouseOver={e => {
                e.currentTarget.style.transform = 'scale(1.04)';
                e.currentTarget.style.boxShadow = '0 6px 22px rgba(59,130,246,0.65)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.45)';
              }}
            >
              Enter Platform <ArrowRight size={15} />
            </button>
          </div>
        </nav>
      </div>

      {/* ── HERO SECTION (WebGL Shader Background) ───────────── */}
      <Hero
        trustBadge={{
          text: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span className="live-ping-dot" />
              <span>Multi-Agent Orchestrator</span>
            </span>
          )
        }}
        headline={{ line1: 'Sovereign Fulfillment.', line2: 'Cryptographic Trust.' }}
        subtitle="A deterministic orchestrator uniting 5 independent AI agents. From receiving docks to return flows — every stage produces auditable, cryptographic evidence."
        buttons={{
          primary: { text: 'Open Live Dashboard', onClick: () => navigate('/app') },
          secondary: { text: 'Explore Architecture', icon: <Play size={16} />, onClick: () => { document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' }); } }
        }}
      />

      {/* ── METRICS RIBBON ────────────────────────────────────── */}
      <MetricsBar />

      {/* ── AGENT FLEET ARCHITECTURE ──────────────────────────── */}
      <section id="architecture" style={{ padding: '120px 24px 80px', background: '#020617' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          
          <div data-aos="fade-up" style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 16px', background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.25)', borderRadius: '999px',
              color: '#60a5fa', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '1px',
              marginBottom: '20px'
            }}>
              <Layers size={14} /> SYSTEM TOPOLOGY
            </div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, margin: '0 0 18px 0', color: '#f8fafc', letterSpacing: '-0.02em' }}>
              The 5-Agent Fleet
            </h2>
            <p style={{ fontSize: '1.1rem', color: '#94a3b8', maxWidth: '680px', margin: '0 auto', lineHeight: 1.65 }}>
              The orchestrator coordinates distinct, loosely-coupled autonomous agents across the physical fulfillment lifecycle. Every transition generates immutable proof.
            </p>
          </div>

          {/* Cards Grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '22px', justifyContent: 'center' }}>
            <StageCard
              stageNum="STAGE 01"
              delay="0"
              color="#3b82f6"
              icon={Box}
              title="Receiving Agent"
              desc="Verifies vendor shipments at the dock. Audits inbound POs, flags quantity mismatches, and issues first-mile evidence records."
              tags={['PO Inbound Audit', 'Discrepancy Flagging', 'First-Mile Seal']}
            />
            <StageCard
              stageNum="STAGE 02"
              delay="100"
              color="#10b981"
              icon={RefreshCcw}
              title="Prep Agent"
              desc="Ensures individual items are barcoded, poly-bagged, or bubble-wrapped according to strict warehouse routing requirements."
              tags={['Barcode Compliance', 'Poly-Bag Specs', 'Route Certification']}
            />
            <StageCard
              stageNum="STAGE 03"
              delay="200"
              color="#8b5cf6"
              icon={PackageCheck}
              title="Pack Manager"
              desc="Order-blind VLM inspection of open cartons. Implements scene-coverage analysis and robust substitution detection before sealing."
              tags={['Order-Blind VLM', 'Substitution Guard', 'Carton Closure Seal']}
            />
            <StageCard
              stageNum="STAGE 04"
              delay="300"
              color="#f59e0b"
              icon={AlertTriangle}
              title="Returns Agent"
              desc="Inspects customer returns. Determines grading condition, restock viability, and detects policy abuse or missing accessories."
              tags={['Condition Grading', 'Abuse Detection', 'Restock Routing']}
            />
            <StageCard
              stageNum="STAGE 05"
              delay="400"
              color="#06b6d4"
              icon={Network}
              title="Recovery Agent"
              desc="Deep conflict resolution. Investigates cross-stage discrepancies, checks missing items against scale weight, and proposes resolution actions."
              tags={['Cross-Stage Audit', 'Weight Discrepancy', 'Resolution Engine']}
            />
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE EVIDENCE SHOWCASE ─────────────────────── */}
      <section style={{ padding: '40px 24px 80px', background: '#020617' }}>
        <div data-aos="fade-up" style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 16px', background: 'rgba(52,211,153,0.08)',
            border: '1px solid rgba(52,211,153,0.25)', borderRadius: '999px',
            color: '#34d399', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '1px',
            marginBottom: '16px'
          }}>
            <Lock size={14} /> IMMUTABLE AUDIT TRAIL
          </div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 800, margin: '0 0 16px 0', color: '#f8fafc' }}>
            Deterministic Verification in Action
          </h2>
          <p style={{ fontSize: '1.05rem', color: '#94a3b8', maxWidth: '620px', margin: '0 auto', lineHeight: 1.6 }}>
            Inspect a live evidence envelope. Each fulfillment decision is backed by SHA-256 hashes and stored immutably.
          </p>
        </div>

        <EvidenceShowcase />
      </section>

      {/* ── FEATURE ROWS ─────────────────────────────────────── */}
      <section id="features" style={{ padding: '60px 24px 120px', background: '#020617' }}>
        <div style={{ maxWidth: '1060px', margin: '0 auto' }}>
          <div data-aos="fade-up" style={{ textAlign: 'center', marginBottom: '72px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 16px', background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.25)', borderRadius: '999px',
              color: '#60a5fa', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '1px',
              marginBottom: '20px'
            }}>
              <Cpu size={14} /> CORE CAPABILITIES
            </div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 800, margin: 0, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              Built for production. Not demos.
            </h2>
          </div>

          <FeatureRow
            title="Immutable Evidence Records"
            desc="Every agent emits a deterministic JSON envelope. Outcomes, decisions, and raw VLM outputs are signed with SHA-256 hashes. The orchestrator references these hashes, ensuring a fully auditable chain of custody that survives process restarts and disputes."
            icon={Database}
            reversed={false}
          />
          <FeatureRow
            title="Fail-Open Architecture"
            desc="The physical world doesn't pause for 503 errors. If the VLM hallucinates or an API times out, the agent falls back to PENDING_REVIEW. Operators are never blocked by the software, and decisions are safely routed to human dashboards."
            icon={Activity}
            reversed={true}
          />
          <FeatureRow
            title="Deterministic Decision Engine"
            desc="We separate vision from reasoning. The Vision Language Model operates at Temperature 0.0 to strictly report physical geometry and features. A deterministic, rule-based Python engine digests this to render the final PASS/FAIL verdict, eliminating LLM flakiness."
            icon={ShieldCheck}
            reversed={false}
          />
        </div>
      </section>

      {/* ── CTA SECTION ──────────────────────────────────────── */}
      <section style={{ padding: '100px 24px 60px', background: 'linear-gradient(180deg, #020617 0%, #0b1329 100%)', textAlign: 'center' }}>
        <div data-aos="zoom-in" style={{
          maxWidth: '780px',
          margin: '0 auto',
          background: 'rgba(15,23,42,0.7)',
          border: '1px solid rgba(59,130,246,0.25)',
          padding: '72px 36px',
          borderRadius: '28px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 24px 60px -15px rgba(2,6,23,0.9), 0 0 35px rgba(59,130,246,0.15)'
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px',
            background: 'rgba(59,130,246,0.15)',
            border: '1px solid rgba(59,130,246,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px auto',
            boxShadow: '0 0 20px rgba(59,130,246,0.3)'
          }}>
            <Box size={28} color="#60a5fa" />
          </div>
          <h2 style={{ fontSize: 'clamp(1.9rem, 4vw, 2.6rem)', fontWeight: 800, margin: '0 0 18px 0', color: '#f8fafc', letterSpacing: '-0.02em' }}>
            Ready to observe the orchestrator?
          </h2>
          <p style={{ fontSize: '1.1rem', color: '#94a3b8', margin: '0 0 36px 0', lineHeight: 1.65, maxWidth: '580px', marginLeft: 'auto', marginRight: 'auto' }}>
            Enter the live dashboard to view workflow states, trace cryptographic evidence, and inspect multi-agent handoffs in real time.
          </p>
          <button
            onClick={() => navigate('/app')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '10px',
              padding: '16px 42px',
              background: 'linear-gradient(135deg, #3b82f6, #0284c7)',
              color: '#fff',
              border: 'none',
              borderRadius: '999px',
              fontSize: '1.05rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 8px 28px rgba(59,130,246,0.5)',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
              e.currentTarget.style.boxShadow = '0 12px 36px rgba(59,130,246,0.7)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 28px rgba(59,130,246,0.5)';
            }}
          >
            Launch Live Dashboard <ArrowRight size={20} />
          </button>
        </div>

        {/* Footer */}
        <footer style={{
          marginTop: '90px',
          paddingTop: '32px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1240px',
          margin: '90px auto 0 auto',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Box size={18} color="#60a5fa" />
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              Orchestrator<span style={{ color: '#38bdf8' }}>.</span>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.85rem' }}>
            <span className="live-ping-dot" style={{ width: '6px', height: '6px' }} />
            <span>All 5 Autonomous Agents Operational • SHA-256 Verified Trail</span>
          </div>

          <div style={{ color: '#475569', fontSize: '0.85rem' }}>
            © {new Date().getFullYear()} Autonomous Orchestration Engine
          </div>
        </footer>
      </section>

    </div>
  );
}
