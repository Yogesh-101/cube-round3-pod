import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { NewInspectionView } from './components/NewInspectionView';
import { ReturnsView } from './components/ReturnsView';
import { AnalyticsView } from './components/AnalyticsView';
import { DecisionRulesView } from './components/DecisionRulesView';
import { InspectionReportModal } from './components/InspectionReportModal';
import { ManualReviewQueueModal } from './components/ManualReviewQueueModal';
import { BoxSwapDefenseModal } from './components/BoxSwapDefenseModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import {
  DEMO_ORDERS,
  INITIAL_BUSINESS_RULES,
  INITIAL_INSPECTIONS,
  DEFAULT_CONDITION_SCALE_CONFIG,
} from './data/mockDatabase';
import {
  ReturnInspectionRecord,
  OrderRecord,
  BusinessRule,
  DispositionType,
  ConditionScaleConfig,
} from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Persistence with fallback to demo seeds
  const [inspections, setInspections] = useState<ReturnInspectionRecord[]>(() => {
    try {
      const saved = localStorage.getItem('returniq_inspections');
      return saved ? JSON.parse(saved) : INITIAL_INSPECTIONS;
    } catch {
      return INITIAL_INSPECTIONS;
    }
  });

  const [orders] = useState<OrderRecord[]>(DEMO_ORDERS);

  const [rules, setRules] = useState<BusinessRule[]>(() => {
    try {
      const saved = localStorage.getItem('returniq_rules');
      return saved ? JSON.parse(saved) : INITIAL_BUSINESS_RULES;
    } catch {
      return INITIAL_BUSINESS_RULES;
    }
  });

  const [scaleConfig, setScaleConfig] = useState<ConditionScaleConfig>(() => {
    try {
      const saved = localStorage.getItem('returniq_scale_config');
      return saved ? JSON.parse(saved) : DEFAULT_CONDITION_SCALE_CONFIG;
    } catch {
      return DEFAULT_CONDITION_SCALE_CONFIG;
    }
  });

  const [stagedOrder, setStagedOrder] = useState<OrderRecord | undefined>(undefined);
  const [reportModalRecord, setReportModalRecord] = useState<ReturnInspectionRecord | null>(null);
  const [isManualQueueModalOpen, setIsManualQueueModalOpen] = useState(false);
  const [isBoxSwapModalOpen, setIsBoxSwapModalOpen] = useState(false);
  const [isGlobalScannerOpen, setIsGlobalScannerOpen] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('returniq_inspections', JSON.stringify(inspections));
    } catch (e) {
      console.warn('Failed to save inspections to localStorage', e);
    }
  }, [inspections]);

  useEffect(() => {
    try {
      localStorage.setItem('returniq_rules', JSON.stringify(rules));
    } catch (e) {
      console.warn('Failed to save rules to localStorage', e);
    }
  }, [rules]);

  useEffect(() => {
    try {
      localStorage.setItem('returniq_scale_config', JSON.stringify(scaleConfig));
    } catch (e) {
      console.warn('Failed to save scale config to localStorage', e);
    }
  }, [scaleConfig]);

  // Actions
  const handleStartInspection = (order?: OrderRecord) => {
    setStagedOrder(order || orders[0]);
    setCurrentTab('new-inspection');
  };

  const handleCompleteInspection = (record: ReturnInspectionRecord) => {
    setInspections((prev) => {
      const filtered = prev.filter((i) => i.id !== record.id && i.orderId !== record.orderId);
      return [record, ...filtered];
    });
  };

  const handleUpdateRules = (updatedRules: BusinessRule[]) => {
    setRules(updatedRules);
  };

  const handleUpdateScaleConfig = (updatedScale: ConditionScaleConfig) => {
    setScaleConfig(updatedScale);
  };

  const handleResolveReview = (
    inspectionId: string,
    resolution: DispositionType,
    notes: string
  ) => {
    setInspections((prev) =>
      prev.map((item) => {
        if (item.id === inspectionId) {
          return {
            ...item,
            finalDecision: resolution,
            status: 'COMPLETED',
            operatorNotes: notes || item.operatorNotes,
            auditTrail: [
              ...item.auditTrail,
              {
                timestamp: new Date().toLocaleTimeString(),
                action: 'Tier-2 Manual Review Resolved',
                user: 'Supervisor Audit',
                result: `Resolution confirmed: ${resolution}`,
              },
            ],
          };
        }
        return item;
      })
    );
  };

  const pendingReviewsCount = inspections.filter((i) => i.status === 'MANUAL_REVIEW').length;
  const flaggedOrders = orders.filter((o) => o.scenarioType === 'BOX_SWAP' || o.scenarioType === 'SERIAL_MISMATCH');

  return (
    <div className="returniq-shell min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      <div className="ambient-grid" aria-hidden="true">
        <div className="ambient-orb orb-one" />
        <div className="ambient-orb orb-two" />
        <div className="ambient-orb orb-three" />
        <div className="scanline" />
      </div>
      {/* 3-Zone Top Navigation Bar */}
      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'manual-queue') {
            setIsManualQueueModalOpen(true);
          } else {
            setCurrentTab(tab);
          }
        }}
        pendingReviewsCount={pendingReviewsCount}
        onOpenBoxSwapModal={() => setIsBoxSwapModalOpen(true)}
        onOpenBarcodeScanner={() => setIsGlobalScannerOpen(true)}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {currentTab === 'dashboard' && (
          <DashboardView
            inspections={inspections}
            onStartInspection={handleStartInspection}
            onViewInspection={(insp) => setReportModalRecord(insp)}
            onOpenManualQueue={() => setIsManualQueueModalOpen(true)}
            orders={orders}
          />
        )}

        {currentTab === 'new-inspection' && (
          <NewInspectionView
            initialOrder={stagedOrder}
            availableOrders={orders}
            rules={rules}
            scaleConfig={scaleConfig}
            onCompleteInspection={handleCompleteInspection}
            onOpenReportModal={(insp) => setReportModalRecord(insp)}
          />
        )}

        {currentTab === 'returns' && (
          <ReturnsView
            inspections={inspections}
            onViewInspection={(insp) => setReportModalRecord(insp)}
            onStartNew={() => handleStartInspection()}
          />
        )}

        {currentTab === 'analytics' && <AnalyticsView />}

        {currentTab === 'decision-rules' && (
          <DecisionRulesView
            rules={rules}
            scaleConfig={scaleConfig}
            onUpdateRules={handleUpdateRules}
            onUpdateScaleConfig={handleUpdateScaleConfig}
          />
        )}
      </main>

      {/* Official Warehouse Certification Report Modal */}
      {reportModalRecord && (
        <InspectionReportModal
          inspection={reportModalRecord}
          onClose={() => setReportModalRecord(null)}
        />
      )}

      {/* Tier-2 Manual Review Queue Modal */}
      {isManualQueueModalOpen && (
        <ManualReviewQueueModal
          inspections={inspections}
          flaggedOrders={flaggedOrders}
          onClose={() => setIsManualQueueModalOpen(false)}
          onInspectOrder={(ord) => {
            handleStartInspection(ord);
            setIsManualQueueModalOpen(false);
          }}
          onViewInspection={(insp) => {
            setReportModalRecord(insp);
            setIsManualQueueModalOpen(false);
          }}
          onResolveReview={handleResolveReview}
        />
      )}

      {/* Box-Swap Defense Architecture Modal */}
      <BoxSwapDefenseModal
        isOpen={isBoxSwapModalOpen}
        onClose={() => setIsBoxSwapModalOpen(false)}
        onLaunchDemoScenario={() => {
          const swapOrder = orders.find((o) => o.scenarioType === 'BOX_SWAP');
          if (swapOrder) {
            handleStartInspection(swapOrder);
          }
        }}
      />

      {/* Global Optical Barcode Scanner Terminal */}
      <BarcodeScannerModal
        isOpen={isGlobalScannerOpen}
        onClose={() => setIsGlobalScannerOpen(false)}
        availableOrders={orders}
        onSelectOrder={(ord) => {
          handleStartInspection(ord);
          setIsGlobalScannerOpen(false);
        }}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-400">RETURNIQ</span>
            <span>·</span>
            <span>AI-Powered Return Intelligence Platform</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Official Evaluation Benchmark Compatible · [Official Challenge Condition Scale]
          </div>
        </div>
      </footer>
    </div>
  );
}
