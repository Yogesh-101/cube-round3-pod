import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchSummary, fetchCharges, assessAllCharges, seedDemoData, ingestOfficialData, fetchOfficialStatus } from '../services/api';
import VerdictBadge from '../components/VerdictBadge';
import EvidenceHealthSection from '../components/EvidenceHealthSection';
import { DollarSign, ShieldAlert, CheckCircle2, HelpCircle, ArrowUpRight, PlayCircle, RefreshCw, AlertCircle, ArrowRight, Database } from 'lucide-react';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [recentCharges, setRecentCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAssessingAll, setIsAssessingAll] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isIngestingOfficial, setIsIngestingOfficial] = useState(false);

  const loadData = async () => {
    try {
      setError(null);
      const [sumRes, chgRes] = await Promise.all([
        fetchSummary(),
        fetchCharges()
      ]);
      setSummary(sumRes);
      setRecentCharges(chgRes.slice(0, 5)); // show top 5 in recent preview
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load recovery dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssessAll = async () => {
    setIsAssessingAll(true);
    try {
      await assessAllCharges();
      await loadData();
    } catch (err) {
      alert(`Assess all failed: ${err.message}`);
    } finally {
      setIsAssessingAll(false);
    }
  };

  const handleSeedDemo = async () => {
    if (!window.confirm('Reset database and load the canonical 8 test cases?')) return;
    setIsSeeding(true);
    try {
      await seedDemoData(true);
      await loadData();
    } catch (err) {
      alert(`Demo reset failed: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleLoadOfficial = async () => {
    setIsIngestingOfficial(true);
    try {
      await ingestOfficialData(false);
      await assessAllCharges();
      await loadData();
    } catch (err) {
      alert(`Failed to load official data: ${err.message}`);
    } finally {
      setIsIngestingOfficial(false);
    }
  };

  const formatMoney = (val) => `$${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <RefreshCw className="h-7 w-7 animate-spin text-blue-500 mb-3" />
        <p className="text-sm">Loading recovery overview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-500/30 text-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <span>{error}</span>
          </div>
          <button onClick={loadData} className="btn btn-secondary btn-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      {/* Header with Title, Subtitle, and Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Recovery Overview</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic chargeback audit and evidence verification platform
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleLoadOfficial}
            disabled={isIngestingOfficial}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 border-blue-500/40 text-blue-300 hover:text-white"
            title="Ingests official Cube Build-A-Thon CSVs (61 charges, 215 evidence)"
          >
            <Database className={`h-3.5 w-3.5 ${isIngestingOfficial ? 'animate-spin text-blue-400' : 'text-blue-400'}`} />
            <span>{isIngestingOfficial ? 'Ingesting Official...' : 'Load Official Cube Dataset'}</span>
          </button>

          <button
            onClick={handleSeedDemo}
            disabled={isSeeding}
            className="btn btn-secondary btn-sm"
            title="Reloads canonical internal test cases"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
            <span>{isSeeding ? 'Resetting...' : 'Reset Demo Suite'}</span>
          </button>

          <button
            onClick={handleAssessAll}
            disabled={isAssessingAll}
            className="btn btn-primary btn-sm"
          >
            <PlayCircle className={`h-3.5 w-3.5 ${isAssessingAll ? 'animate-spin' : ''}`} />
            <span>{isAssessingAll ? 'Assessing...' : 'Assess All Charges'}</span>
          </button>
        </div>
      </div>

      {/* 6 Clean KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Total Charges */}
        <div className="saas-card p-4">
          <div className="text-[11px] font-semibold uppercase text-slate-400">Total Charges</div>
          <div className="text-xl font-bold text-white mt-1 font-mono">
            {summary?.total_charges ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Levied fee items</div>
        </div>

        {/* 2. Total Amount */}
        <div className="saas-card p-4">
          <div className="text-[11px] font-semibold uppercase text-slate-400">Total Amount</div>
          <div className="text-xl font-bold text-white mt-1 font-mono">
            {formatMoney(summary?.total_charge_amount)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Gross disputed value</div>
        </div>

        {/* 3. Potential Recovery */}
        <div className="saas-card p-4 border-red-500/30 bg-red-950/10">
          <div className="text-[11px] font-semibold uppercase text-red-400 flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3" /> Potential Recovery
          </div>
          <div className="text-xl font-bold text-red-400 mt-1 font-mono">
            {formatMoney(summary?.potential_claim_amount)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Contradicted fees</div>
        </div>

        {/* 4. Supported */}
        <div className="saas-card p-4 border-emerald-500/30 bg-emerald-950/10">
          <div className="text-[11px] font-semibold uppercase text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Supported
          </div>
          <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">
            {summary?.supported_count ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Valid penalties</div>
        </div>

        {/* 5. Contradicted */}
        <div className="saas-card p-4 border-red-500/30">
          <div className="text-[11px] font-semibold uppercase text-red-400 flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" /> Contradicted
          </div>
          <div className="text-xl font-bold text-red-400 mt-1 font-mono">
            {summary?.contradicted_count ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Defensible claims</div>
        </div>

        {/* 6. Silent */}
        <div className="saas-card p-4">
          <div className="text-[11px] font-semibold uppercase text-slate-400 flex items-center gap-1">
            <HelpCircle className="h-3 w-3" /> Silent
          </div>
          <div className="text-xl font-bold text-slate-300 mt-1 font-mono">
            {summary?.silent_count ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Incomplete / missing</div>
        </div>
      </div>

      {/* Phase 3 Differentiation: Evidence Health & Gap Detection */}
      <EvidenceHealthSection />

      {/* Recent Disputed Charges Preview */}
      <div className="saas-card">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Recent Dispute Charges</h2>
            <p className="text-xs text-slate-400">Overview of recent penalties and deterministic assessment verdicts</p>
          </div>
          <Link to="/charges" className="btn btn-secondary btn-sm text-xs flex items-center gap-1">
            <span>View All Charges</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentCharges.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No charges found. Use the Ingestion page or Reset Demo Suite to import records.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="saas-table">
              <thead>
                <tr>
                  <th>Charge ID</th>
                  <th>Reason</th>
                  <th>Shipment</th>
                  <th>Amount</th>
                  <th>Verdict</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentCharges.map((chg) => (
                  <tr key={chg.charge_id}>
                    <td className="font-mono font-semibold text-blue-400 text-xs">
                      <Link to="/charges" className="hover:underline">
                        {chg.charge_id}
                      </Link>
                    </td>
                    <td className="text-slate-200 text-xs font-medium">{chg.reason}</td>
                    <td className="font-mono text-xs text-slate-400">{chg.shipment_id || '—'}</td>
                    <td className="font-mono text-xs font-bold text-white">
                      ${chg.amount.toFixed(2)}
                    </td>
                    <td>
                      <VerdictBadge
                        verdict={chg.assessment?.verdict}
                        claimAmount={chg.assessment?.claim_amount}
                      />
                    </td>
                    <td className="text-xs text-slate-400">
                      {new Date(chg.charge_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
