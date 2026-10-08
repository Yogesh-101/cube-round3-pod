import React from 'react';
import {
  X,
  Printer,
  Barcode as BarcodeIcon,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  MapPin,
  Clock,
  UserCheck,
} from 'lucide-react';
import { ReturnInspectionRecord } from '../types';
import { Barcode } from './Barcode';

interface WarehouseRoutingLabelModalProps {
  inspection: ReturnInspectionRecord;
  isOpen: boolean;
  onClose: () => void;
}

export const WarehouseRoutingLabelModal: React.FC<WarehouseRoutingLabelModalProps> = ({
  inspection,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const getDestinationBay = (disposition: string) => {
    switch (disposition) {
      case 'RESTOCK':
        return { bay: 'BAY-A4-RESTOCK', zone: 'Primary Fulfillment Aisle 12', color: 'emerald' };
      case 'REFURBISH':
        return { bay: 'BAY-R2-REPAIR', zone: 'Technical Services Lab B', color: 'sky' };
      case 'LIQUIDATE':
        return { bay: 'BAY-L9-OUTLET', zone: 'Wholesale B2B Pallet Staging', color: 'amber' };
      case 'DISPOSE':
        return { bay: 'BAY-D1-RECYCLE', zone: 'E-Waste Certified Destruction', color: 'rose' };
      default:
        return { bay: 'BAY-SEC-TIER2', zone: 'Tier-2 Supervisor Forensic Quarantine', color: 'purple' };
    }
  };

  const routing = getDestinationBay(inspection.finalDecision);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full my-8 overflow-hidden shadow-2xl flex flex-col">
        {/* Top Control Bar */}
        <div className="px-6 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <BarcodeIcon className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-white">
              Warehouse Tote & Pallet Routing Barcode Label (4" × 6")
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Label</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* The Printable 4x6 Thermal Label Container */}
        <div className="p-6 bg-slate-900 flex justify-center print:bg-white print:p-0">
          <div className="w-full max-w-md bg-white text-slate-950 rounded-xl p-6 border-2 border-slate-300 shadow-md space-y-4 print:border-none print:shadow-none print:w-full print:max-w-none print:p-4 font-sans">
            {/* Header Stamp */}
            <div className="flex items-start justify-between border-b-2 border-black pb-3">
              <div>
                <div className="text-2xl font-black tracking-tight">RETURNIQ LOGISTICS</div>
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">
                  Automated Return Disposition Routing
                </div>
              </div>
              <div className="text-right font-mono">
                <div className="text-lg font-black">{inspection.returnId}</div>
                <div className="text-[10px] text-slate-600">Order: {inspection.orderId}</div>
              </div>
            </div>

            {/* Destination Routing Block */}
            <div className="p-3 bg-slate-100 border-2 border-black rounded-lg text-center space-y-1">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-600 tracking-wider">
                CONVEYOR ROUTING DESTINATION
              </span>
              <div className="text-3xl font-black tracking-tight text-slate-900">
                {routing.bay}
              </div>
              <div className="text-xs font-bold text-slate-700">
                Disposition: {inspection.finalDecision} · {routing.zone}
              </div>
            </div>

            {/* Destination Primary Barcode */}
            <div className="flex flex-col items-center justify-center py-2 border-b border-black">
              <Barcode
                value={routing.bay}
                height={55}
                lightBackground={true}
                className="w-full flex justify-center"
              />
              <span className="text-[9px] font-mono text-slate-500 mt-0.5">
                DISPOSITION CODE-128 ROUTING SYMBOLOGY
              </span>
            </div>

            {/* Product & Serial Metadata */}
            <div className="grid grid-cols-2 gap-3 text-xs border-b border-black pb-3">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Product</span>
                <span className="font-bold text-slate-900 block truncate">
                  {inspection.product.name}
                </span>
                <span className="text-[10px] font-mono text-slate-600">
                  SKU: {inspection.product.sku}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Hardware Serial</span>
                <span className="font-mono font-bold text-slate-900 block truncate">
                  {inspection.serialNumber}
                </span>
                <span className="text-[10px] font-mono text-slate-600">
                  Condition: {inspection.aiAnalysis.condition.wearLevel}
                </span>
              </div>
            </div>

            {/* Secondary Barcode: RMA ID */}
            <div className="flex flex-col items-center justify-center py-1">
              <Barcode
                value={inspection.returnId}
                height={40}
                lightBackground={true}
                className="w-full flex justify-center"
              />
            </div>

            {/* Footer / Inspector Stamp */}
            <div className="pt-2 border-t-2 border-black flex items-center justify-between text-[10px] font-mono text-slate-600">
              <div>
                <span>Tech ID: <strong>{inspection.operator}</strong></span>
              </div>
              <div>
                <span>Date: <strong>{inspection.inspectionDate}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
