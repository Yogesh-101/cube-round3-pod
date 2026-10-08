import React, { useState } from 'react';
import {
  Search,
  Filter,
  Eye,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Download,
} from 'lucide-react';
import { ReturnInspectionRecord, DispositionType } from '../types';

interface ReturnsViewProps {
  inspections: ReturnInspectionRecord[];
  onViewInspection: (inspection: ReturnInspectionRecord) => void;
  onStartNew: () => void;
}

export const ReturnsView: React.FC<ReturnsViewProps> = ({
  inspections,
  onViewInspection,
  onStartNew,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dispositionFilter, setDispositionFilter] = useState<string>('ALL');
  const [identityFilter, setIdentityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Broad customer-facing return categories. The filter is additive only: it
  // does not change the existing product records or any inspection behaviour.
  const categoryOptions = [
    'Electronics',
    'Mobile & Tablets',
    'Computers & Laptops',
    'Audio',
    'Gaming',
    'Wearables',
    'Home & Kitchen',
    'Clothing & Fashion',
    'Footwear',
    'Toys & Games',
    'Beauty & Personal Care',
    'Sports & Fitness',
    'Books & Stationery',
    'Automotive',
    'Accessories',
    'Other',
  ];

  // Maps the project's existing categories into the new shopping-style
  // categories. Unknown/future categories remain filterable under Other.
  const getBroadCategory = (category: string) => {
    const value = category.toLowerCase();
    if (['smartphones', 'audio', 'electronics', 'computers', 'laptops', 'tablets'].some((x) => value.includes(x))) {
      if (value.includes('smartphone') || value.includes('tablet')) return 'Mobile & Tablets';
      if (value.includes('computer') || value.includes('laptop')) return 'Computers & Laptops';
      if (value.includes('audio')) return 'Audio';
      return 'Electronics';
    }
    if (value.includes('gaming') || value.includes('console') || value.includes('playstation') || value.includes('xbox')) return 'Gaming';
    if (value.includes('watch') || value.includes('wearable')) return 'Wearables';
    if (value.includes('appliance') || value.includes('kitchen') || value.includes('home')) return 'Home & Kitchen';
    if (value.includes('cloth') || value.includes('fashion') || value.includes('apparel')) return 'Clothing & Fashion';
    if (value.includes('shoe') || value.includes('footwear') || value.includes('sneaker')) return 'Footwear';
    if (value.includes('toy') || value.includes('game')) return 'Toys & Games';
    if (value.includes('beauty') || value.includes('cosmetic') || value.includes('personal care')) return 'Beauty & Personal Care';
    if (value.includes('sport') || value.includes('fitness')) return 'Sports & Fitness';
    if (value.includes('book') || value.includes('stationery')) return 'Books & Stationery';
    if (value.includes('auto') || value.includes('car') || value.includes('vehicle')) return 'Automotive';
    if (value.includes('accessor')) return 'Accessories';
    return 'Other';
  };

  const filteredInspections = inspections.filter((insp) => {
    const matchesSearch =
      insp.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insp.returnId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insp.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insp.product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insp.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDisposition =
      dispositionFilter === 'ALL' || insp.finalDecision === dispositionFilter;

    const matchesIdentity =
      identityFilter === 'ALL' || insp.aiAnalysis.identity.status === identityFilter;

    const matchesCategory =
      categoryFilter === 'ALL' || getBroadCategory(insp.product.category) === categoryFilter;

    return matchesSearch && matchesDisposition && matchesIdentity && matchesCategory;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
            Returns Registry & History
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit-complete database of verified returns, AI evidence records, and operator decisions.
          </p>
        </div>

        <button
          onClick={onStartNew}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded shadow transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
          <span>New Inspection</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Order ID, Return RMA, Product, SKU..."
            className="w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Disposition:</span>
            <select
              value={dispositionFilter}
              onChange={(e) => setDispositionFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white text-xs"
            >
              <option value="ALL">All Dispositions</option>
              <option value="RESTOCK">Restock</option>
              <option value="REFURBISH">Refurbish</option>
              <option value="LIQUIDATE">Liquidate</option>
              <option value="DISPOSE">Dispose</option>
              <option value="MANUAL_REVIEW">Manual Review</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Identity:</span>
            <select
              value={identityFilter}
              onChange={(e) => setIdentityFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white text-xs"
            >
              <option value="ALL">All Identity Results</option>
              <option value="MATCH">Product Match</option>
              <option value="POTENTIAL_MISMATCH">Potential Mismatch</option>
              <option value="UNVERIFIED">Unverified</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white text-xs min-w-[150px]"
              aria-label="Filter returns by product category"
            >
              <option value="ALL">All Categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-medium">Return ID</th>
                <th className="py-3 px-4 font-medium">Order ID</th>
                <th className="py-3 px-4 font-medium">Product Name & SKU</th>
                <th className="py-3 px-4 font-medium">Identity Status</th>
                <th className="py-3 px-4 font-medium">Completeness</th>
                <th className="py-3 px-4 font-medium">Condition Result</th>
                <th className="py-3 px-4 font-medium">Return Integrity</th>
                <th className="py-3 px-4 font-medium">Disposition</th>
                <th className="py-3 px-4 font-medium">Operator & Date</th>
                <th className="py-3 px-4 font-medium text-right">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredInspections.map((insp) => (
                <tr
                  key={insp.id}
                  onClick={() => onViewInspection(insp)}
                  className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <td className="py-3.5 px-4 font-mono font-medium text-indigo-300 tabular-nums">
                    {insp.returnId}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-400 tabular-nums">
                    {insp.orderId}
                  </td>
                  <td className="py-3.5 px-4 max-w-[220px]">
                    <div className="font-semibold text-white truncate">{insp.product.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{insp.product.sku}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    {insp.aiAnalysis.identity.status === 'MATCH' ? (
                      <span className="text-emerald-400 font-medium">✓ Product Match</span>
                    ) : insp.aiAnalysis.identity.status === 'POTENTIAL_MISMATCH' ? (
                      <span className="text-amber-400 font-medium">⚠ Potential Mismatch</span>
                    ) : (
                      <span className="text-slate-400 font-medium">Unverified</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    <span
                      className={
                        insp.aiAnalysis.completeness.missingCount > 0
                          ? 'text-amber-400 font-semibold'
                          : 'text-slate-300'
                      }
                    >
                      {insp.aiAnalysis.completeness.detectedCount} /{' '}
                      {insp.aiAnalysis.completeness.expectedCount}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 truncate max-w-[160px] text-[11px]">
                    {insp.aiAnalysis.condition.result}
                  </td>
                  <td className="py-3.5 px-4">
                    {insp.aiAnalysis.integrity.status === 'LOW_CONCERN' ? (
                      <span className="text-emerald-400 text-[11px] font-medium">Low Concern</span>
                    ) : (
                      <span className="text-amber-300 text-[11px] font-semibold bg-amber-950/60 px-1.5 py-0.5 border border-amber-800/80 rounded">
                        ⚠ Swap Alert
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`font-semibold text-[11px] px-2 py-0.5 rounded ${
                        insp.finalDecision === 'RESTOCK'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                          : insp.finalDecision === 'REFURBISH'
                          ? 'bg-sky-950/80 text-sky-300 border border-sky-800'
                          : insp.finalDecision === 'LIQUIDATE'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                          : insp.finalDecision === 'DISPOSE'
                          ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                          : 'bg-purple-950/80 text-purple-300 border border-purple-800'
                      }`}
                    >
                      {insp.finalDecision}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-[11px] text-slate-400">
                    <div>{insp.operator.split(' (')[0]}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{insp.inspectionDate}</div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewInspection(insp);
                      }}
                      className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
