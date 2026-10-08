import React, { useState } from 'react';
import {
  TrendingUp,
  BarChart2,
  PieChart,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Calendar,
  Layers,
  Clock,
  ArrowUpRight,
  Filter,
} from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const [dateRange, setDateRange] = useState<'TODAY' | '7D' | '30D' | '90D'>('30D');

  const categories = [
    { name: 'Audio & Headphones', volume: 462, restockPct: 62 },
    { name: 'Smartphones & Mobile', volume: 384, restockPct: 41 },
    { name: 'Small Home Appliances', volume: 218, restockPct: 58 },
    { name: 'Gaming Consoles & Gear', volume: 142, restockPct: 48 },
    { name: 'Smartwatches & Fitness', volume: 78, restockPct: 54 },
  ];

  const damageTypes = [
    { type: 'Micro Surface Wear & Scratches', count: 184, severity: 'Light' },
    { type: 'Outer Retail Carton Crushing / Tears', count: 146, severity: 'Moderate' },
    { type: 'Internal Component Missing (Cables/Adapters)', count: 98, severity: 'Replaceable' },
    { type: 'Port Damage or Bent Connectors', count: 42, severity: 'High' },
    { type: 'Hazardous / Swollen Cell or Liquid Spill', count: 14, severity: 'Severe' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header & Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
            Returns Operations Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational throughput, disposition recovery yield, and fraud/swap deterrence metrics.
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg self-start sm:self-auto text-xs">
          {(['TODAY', '7D', '30D', '90D'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1 font-medium rounded transition-colors ${
                dateRange === range
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {range === 'TODAY' ? 'Today' : range === '7D' ? '7 Days' : range === '30D' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Main High-Level Rates Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <span className="text-[11px] text-slate-400 font-medium">Restock Rate</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">53.1%</span>
            <span className="text-[10px] text-emerald-500 font-semibold">+4.2%</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Direct return to active prime shelf</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <span className="text-[11px] text-slate-400 font-medium">Refurbish & Kitting Rate</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-sky-400 tabular-nums">26.5%</span>
            <span className="text-[10px] text-slate-400">Rebox/Parts</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Accessory replacement & recertification</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <span className="text-[11px] text-slate-400 font-medium">Box-Swap Mismatch Rate</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-400 tabular-nums">3.4%</span>
            <span className="text-[10px] text-amber-500 font-semibold">Flagged</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">42 fraudulent swap attempts intercepted</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <span className="text-[11px] text-slate-400 font-medium">Avg Inspection Velocity</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">1m 58s</span>
            <span className="text-[10px] text-emerald-400">-54% vs manual</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Multi-angle CV processing time</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Returns by Category & Recovery */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Returns Volume & Restock Yield by Product Category
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">1,284 Units</span>
          </div>

          <div className="space-y-3.5">
            {categories.map((cat, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">{cat.name}</span>
                  <span className="font-mono text-slate-400 tabular-nums">
                    {cat.volume} units · <span className="text-emerald-400 font-bold">{cat.restockPct}% restock</span>
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-2"
                    style={{ width: `${cat.restockPct}%` }}
                    title="Restocked"
                  />
                  <div
                    className="bg-sky-500 h-2"
                    style={{ width: `${(100 - cat.restockPct) * 0.5}%` }}
                    title="Refurbished"
                  />
                  <div
                    className="bg-amber-500 h-2"
                    style={{ width: `${(100 - cat.restockPct) * 0.5}%` }}
                    title="Liquidated/Disposed"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Restock
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-500" /> Refurbish
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Liquidate
              </span>
            </div>
            <span className="font-mono text-slate-300">Target: &gt;50% Restock</span>
          </div>
        </div>

        {/* Common Damage & Defect Classifications */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Common Visual Defect Classifications
            </h3>
            <span className="text-[11px] text-slate-500">Optical CV Signatures</span>
          </div>

          <div className="space-y-2.5">
            {damageTypes.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800 rounded"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-slate-200">{item.type}</div>
                  <div className="text-[10px] text-slate-500">Severity: {item.severity}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-white tabular-nums">
                    {item.count}
                  </div>
                  <div className="text-[10px] text-slate-500">detections</div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Visual Defect Classification Standard:</span>
            <span className="text-indigo-400 font-semibold">[Official Challenge Condition Scale]</span>
          </div>
        </div>
      </div>

      {/* Financial Value Preservation Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800">
            Yield Optimization Impact
          </span>
          <h3 className="text-lg font-bold text-white">
            $312,400 in Recovered Merchandise Value This Quarter
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            By distinguishing replaceable missing accessories from true product defects, RETURNIQ diverted 341 returns from liquidation into re-kitting refurbishment, increasing net recovery yield by 34.2%.
          </p>
        </div>

        <div className="flex items-center gap-6 shrink-0 font-mono text-center">
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg min-w-[110px]">
            <div className="text-xs text-slate-400">Box Swaps Stopped</div>
            <div className="text-xl font-bold text-amber-400 mt-0.5">42 Units</div>
          </div>
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg min-w-[110px]">
            <div className="text-xs text-slate-400">Fraud Loss Prevented</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">$38,950</div>
          </div>
        </div>
      </div>
    </div>
  );
};
