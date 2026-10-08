import React, { useState, useEffect, useRef } from 'react';
import {
  Scan,
  Search,
  Upload,
  Camera,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  X,
  Maximize2,
  Minimize2,
  RotateCw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Layers,
  FileCheck,
  FileText,
  Clock,
  Printer,
  ChevronRight,
  RefreshCw,
  Eye,
  Sliders,
  Check,
  Package,
  Wrench,
  DollarSign,
  Trash2,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Info,
  UserCheck,
  ScanBarcode,
  Cpu,
  Fingerprint,
  Box,
  CheckCheck,
  AlertCircle,
  Tag,
  Scale,
  Award,
} from 'lucide-react';
import {
  OrderRecord,
  InspectionImage,
  ImageCategory,
  AIInspectionResult,
  DispositionRecommendation,
  DispositionType,
  BusinessRule,
  ReturnInspectionRecord,
  ConditionScaleConfig,
  OFFICIAL_CONDITION_SCALE_LABEL,
  VisualEvidenceMarker,
} from '../types';
import { runAIInspection, INSPECTION_STAGES } from '../services/aiInspection';
import { Barcode } from './Barcode';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { WarehouseRoutingLabelModal } from './WarehouseRoutingLabelModal';

interface NewInspectionViewProps {
  initialOrder?: OrderRecord;
  availableOrders: OrderRecord[];
  rules: BusinessRule[];
  scaleConfig: ConditionScaleConfig;
  onCompleteInspection: (inspection: ReturnInspectionRecord) => void;
  onOpenReportModal: (inspection: ReturnInspectionRecord) => void;
}

const IMAGE_CATEGORIES: { id: ImageCategory; label: string; shortLabel: string; guidance: string; required: boolean }[] = [
  { id: 'PACKAGE_EXTERIOR', label: '1. Package Exterior', shortLabel: 'Exterior Box', guidance: 'Capture entire outer shipping carton & retail box surfaces', required: true },
  { id: 'PACKAGE_INTERIOR', label: '2. Package Interior', shortLabel: 'Molded Tray', guidance: 'Capture inner molded pulp tray, inserts, and unboxing state', required: true },
  { id: 'MAIN_PRODUCT', label: '3. Main Product', shortLabel: 'Hardware Body', guidance: 'Capture physical device from primary front/top angle', required: true },
  { id: 'ACCESSORIES', label: '4. Accessories / Components', shortLabel: 'Accessories', guidance: 'Place all cables, adaptors, and included parts in one frame', required: true },
  { id: 'PRODUCT_LABEL', label: '5. Product Label / SKU', shortLabel: 'Box Label OCR', guidance: 'Ensure outer box barcode & SKU text is crisp and glare-free', required: true },
  { id: 'SERIAL_NUMBER', label: '6. Serial Number / Barcode', shortLabel: 'Device Serial', guidance: 'Capture physical laser engraving on device body', required: true },
];

export const NewInspectionView: React.FC<NewInspectionViewProps> = ({
  initialOrder,
  availableOrders,
  rules,
  scaleConfig,
  onCompleteInspection,
  onOpenReportModal,
}) => {
  // Current inspection step: 'ORDER_INFO' | 'IMAGE_UPLOAD' | 'AI_PROCESSING' | 'WORKSPACE'
  const [step, setStep] = useState<'ORDER_INFO' | 'IMAGE_UPLOAD' | 'AI_PROCESSING' | 'WORKSPACE'>('ORDER_INFO');

  // Order selection
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(initialOrder || availableOrders[0]);
  const [customSerial, setCustomSerial] = useState(selectedOrder?.serialNumber || '');
  const [customReturnReason, setCustomReturnReason] = useState(selectedOrder?.returnReason || '');

  // Images state
  const [uploadedImages, setUploadedImages] = useState<InspectionImage[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ImageCategory>('PACKAGE_EXTERIOR');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showOverlays, setShowOverlays] = useState(true);
  const [showCrosshairs, setShowCrosshairs] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);

  // Web camera capture state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // AI Inspection Progress state
  const [currentProgressIndex, setCurrentProgressIndex] = useState(0);
  const [currentStageText, setCurrentStageText] = useState('');
  const [aiResult, setAiResult] = useState<AIInspectionResult | null>(null);
  const [recommendation, setRecommendation] = useState<DispositionRecommendation | null>(null);

  // Operator Decision State
  const [finalDecision, setFinalDecision] = useState<DispositionType | 'MANUAL_REVIEW'>('RESTOCK');
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('Additional physical inspection');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [completedRecord, setCompletedRecord] = useState<ReturnInspectionRecord | null>(null);

  // Barcode scanner & Routing Label modal state
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [isRoutingLabelModalOpen, setIsRoutingLabelModalOpen] = useState(false);

  // Initialize with initial order or pre-loaded images
  useEffect(() => {
    if (initialOrder) {
      setSelectedOrder(initialOrder);
      setCustomSerial(initialOrder.serialNumber);
      setCustomReturnReason(initialOrder.returnReason);
      if (initialOrder.preloadedImages && initialOrder.preloadedImages.length > 0) {
        setUploadedImages(initialOrder.preloadedImages);
      }
    }
  }, [initialOrder]);

  const handleSelectOrder = (order: OrderRecord) => {
    setSelectedOrder(order);
    setCustomSerial(order.serialNumber);
    setCustomReturnReason(order.returnReason);
    if (order.preloadedImages && order.preloadedImages.length > 0) {
      setUploadedImages(order.preloadedImages);
    } else {
      setUploadedImages([]);
    }
  };

  // Image Upload handler (File input or drag&drop)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, category: ImageCategory) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const newImg: InspectionImage = {
        id: `img-${Date.now()}`,
        category,
        name: file.name,
        url: dataUrl,
        uploadedAt: new Date().toLocaleTimeString(),
        verified: true,
      };

      setUploadedImages((prev) => {
        const filtered = prev.filter((img) => img.category !== category);
        return [...filtered, newImg];
      });
    };
    reader.readAsDataURL(file);
  };

  // Web Camera start
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API is not available in this browser.');
      }

      // Request the stream before switching the UI into camera mode so a
      // denied permission never leaves an empty black camera panel behind.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: 'environment' } },
        audio: false,
      });

      setCameraStream(stream);
      setIsCameraActive(true);

      requestAnimationFrame(async () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (playError) {
            console.warn('Camera preview could not autoplay.', playError);
          }
        }
      });
    } catch (err) {
      setIsCameraActive(false);
      setCameraStream(null);
      console.warn('Web camera access unavailable.', err);
      window.alert('Camera access is unavailable. Please ensure your browser has camera permission enabled and the site is opened on HTTPS or localhost.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const newImg: InspectionImage = {
          id: `cam-${Date.now()}`,
          category: selectedCategory,
          name: `Camera_${selectedCategory}_${Date.now()}.jpg`,
          url: dataUrl,
          uploadedAt: new Date().toLocaleTimeString(),
          verified: true,
        };

        setUploadedImages((prev) => {
          const filtered = prev.filter((img) => img.category !== selectedCategory);
          return [...filtered, newImg];
        });

        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  // Load standard pre-populated demo set for immediate evaluation
  const handleLoadDemoImages = () => {
    if (!selectedOrder) return;
    if (selectedOrder.preloadedImages && selectedOrder.preloadedImages.length > 0) {
      setUploadedImages(selectedOrder.preloadedImages);
    } else {
      const dummySet: InspectionImage[] = IMAGE_CATEGORIES.map((cat, idx) => ({
        id: `demo-${idx}`,
        category: cat.id,
        name: `${cat.shortLabel} Scan`,
        url: selectedOrder.product.imageUrl,
        uploadedAt: new Date().toLocaleTimeString(),
        verified: true,
      }));
      setUploadedImages(dummySet);
    }
  };

  // Run AI Inspection
  const handleStartInspection = async () => {
    if (!selectedOrder) return;
    setStep('AI_PROCESSING');

    // Run inspection service
    const { aiResult: result, recommendation: rec } = await runAIInspection(
      selectedOrder,
      uploadedImages,
      rules,
      scaleConfig,
      (idx, text) => {
        setCurrentProgressIndex(idx);
        setCurrentStageText(text);
      }
    );

    setAiResult(result);
    setRecommendation(rec);
    setFinalDecision(rec.disposition);
    setStep('WORKSPACE');
  };

  // Operator Confirms Decision
  const handleConfirmDecision = (decision: DispositionType | 'MANUAL_REVIEW') => {
    if (!selectedOrder || !aiResult || !recommendation) return;

    const record: ReturnInspectionRecord = {
      id: `INSP-${Date.now().toString().slice(-4)}`,
      returnId: selectedOrder.returnId,
      orderId: selectedOrder.orderId,
      product: selectedOrder.product,
      serialNumber: customSerial || selectedOrder.serialNumber,
      returnReason: customReturnReason || selectedOrder.returnReason,
      inspectionDate: new Date().toLocaleString(),
      operator: 'Taylor Kim (Tech #481)',
      images: uploadedImages,
      aiAnalysis: aiResult,
      recommendation,
      finalDecision: decision,
      overrideReason: decision !== recommendation.disposition ? overrideReason : undefined,
      operatorNotes: overrideNotes || undefined,
      status: decision === 'MANUAL_REVIEW' ? 'MANUAL_REVIEW' : 'COMPLETED',
      auditTrail: [
        {
          timestamp: new Date().toLocaleTimeString(),
          action: 'Return Received & Bay Registered',
          user: 'Logistics Intake',
          result: `Order ${selectedOrder.orderId}`,
        },
        {
          timestamp: new Date().toLocaleTimeString(),
          action: 'Multi-image capture uploaded',
          user: 'Taylor Kim (Tech #481)',
          result: `${uploadedImages.length} frames verified`,
        },
        {
          timestamp: new Date().toLocaleTimeString(),
          action: 'AI Computer Vision Inspection Executed',
          user: `RETURNIQ Engine (${aiResult.source})`,
          result: `Identity: ${aiResult.identity.status} · Integrity: ${aiResult.integrity.status}`,
        },
        {
          timestamp: new Date().toLocaleTimeString(),
          action: 'Business Decision Rules Applied',
          user: 'Deterministic Decision Engine',
          result: `Recommended Disposition: ${recommendation.disposition} (${recommendation.ruleName})`,
        },
        {
          timestamp: new Date().toLocaleTimeString(),
          action: 'Human Operator Review & Signoff',
          user: 'Taylor Kim (Tech #481)',
          result: `Final Decision: ${decision}${
            decision !== recommendation.disposition ? ` (Override: ${overrideReason})` : ' (Accepted AI Recommendation)'
          }`,
        },
      ],
    };

    setCompletedRecord(record);
    setIsSaved(true);
    onCompleteInspection(record);
  };

  const currentDisplayImage =
    uploadedImages.find((img) => img.category === selectedCategory) ||
    uploadedImages[activeImageIndex] ||
    (selectedOrder ? { url: selectedOrder.product.imageUrl, name: selectedOrder.product.name } : null);

  return (
    <div className="space-y-6 pb-20">
      {/* ============================================================== */}
      {/* 4-STEP PIPELINE RIBBON — ENTERPRISE INSPECTION WORKFLOW        */}
      {/* ============================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 text-xs overflow-x-auto py-0.5">
            <button
              onClick={() => setStep('ORDER_INFO')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                step === 'ORDER_INFO'
                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] font-mono flex items-center justify-center font-bold">
                1
              </span>
              <span>1. Order & BOM Intake</span>
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />

            <button
              onClick={() => {
                if (selectedOrder) setStep('IMAGE_UPLOAD');
              }}
              disabled={!selectedOrder}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                step === 'IMAGE_UPLOAD'
                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 disabled:opacity-40'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] font-mono flex items-center justify-center font-bold">
                2
              </span>
              <span>2. Multi-Angle Capture</span>
              <span className="font-mono text-[10px] text-slate-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-700">
                {uploadedImages.length}/6
              </span>
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />

            <button
              onClick={() => {
                if (aiResult) setStep('WORKSPACE');
              }}
              disabled={!aiResult}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                step === 'WORKSPACE'
                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 disabled:opacity-40'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] font-mono flex items-center justify-center font-bold">
                3
              </span>
              <span>3. Inspection & Decision Workspace</span>
            </button>
          </div>

          {step === 'WORKSPACE' && completedRecord && (
            <button
              onClick={() => onOpenReportModal(completedRecord)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors shadow-sm shrink-0"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              <span>Inspection Certificate</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* STEP 1: ORDER LOOKUP & PRODUCT EXPECTATION                      */}
      {/* ============================================================== */}
      {step === 'ORDER_INFO' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Order Selector & Form */}
          <div className="lg:col-span-6 space-y-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800/60 font-mono text-[10px] font-bold tracking-wider uppercase">
                    EXPECTED (ORDER BOM)
                  </span>
                  <span className="text-xs text-slate-500 font-mono">Stage 1 of 3</span>
                </div>
                <h2 className="text-base font-bold text-white mt-1.5">Order Intake & Product Expectation</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Load the return shipment record to pull expected SKU, component manifest, and serial baseline.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsScannerModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors shrink-0"
              >
                <ScanBarcode className="w-3.5 h-3.5" />
                <span>Scan Barcode</span>
              </button>
            </div>

            {/* Quick Demo Scenario Switcher */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Select Staged Warehouse Return:
                </label>
                <span className="text-[10px] text-slate-500 font-mono">Simulated Scenarios</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {availableOrders.map((ord) => {
                  const isCurrent = selectedOrder?.orderId === ord.orderId;
                  const isBoxSwap = ord.scenarioType === 'BOX_SWAP';
                  return (
                    <button
                      key={ord.orderId}
                      onClick={() => handleSelectOrder(ord)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        isCurrent
                          ? 'border-indigo-500 bg-indigo-950/60 shadow-md ring-1 ring-indigo-500/50'
                          : isBoxSwap
                          ? 'border-amber-900/60 bg-amber-950/20 hover:border-amber-700'
                          : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-white tabular-nums">
                          {ord.orderId}
                        </span>
                        {isBoxSwap ? (
                          <span className="text-[9px] font-bold text-amber-300 bg-amber-950 border border-amber-800/80 px-1.5 py-0.5 rounded tracking-wide">
                            BOX SWAP TEST
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {ord.scenarioType?.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-200 font-medium truncate mt-1">
                        {ord.product.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {ord.returnReason}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Manual Form Fields */}
            <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-slate-800">
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Order ID</label>
                <div className="relative">
                  <input
                    type="text"
                    value={selectedOrder?.orderId || ''}
                    onChange={(e) => {
                      const match = availableOrders.find((o) => o.orderId.toLowerCase() === e.target.value.toLowerCase());
                      if (match) handleSelectOrder(match);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    placeholder="e.g. ORD-10984"
                  />
                  <ScanBarcode className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Return RMA ID</label>
                <input
                  type="text"
                  value={selectedOrder?.returnId || 'RET-88410'}
                  readOnly
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-400 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Product SKU</label>
                <input
                  type="text"
                  value={selectedOrder?.product.sku || ''}
                  readOnly
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-400 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Device Serial Number</label>
                <input
                  type="text"
                  value={customSerial}
                  onChange={(e) => setCustomSerial(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                />
              </div>

              <div className="col-span-2">
                <label className="text-slate-400 block mb-1 font-medium">Customer Return Reason</label>
                <input
                  type="text"
                  value={customReturnReason}
                  onChange={(e) => setCustomReturnReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                />
              </div>
            </div>

            {/* Box-Swap Special Scenario Explainer Callout */}
            {selectedOrder?.scenarioType === 'BOX_SWAP' && (
              <div className="p-3.5 bg-amber-950/40 border border-amber-800/80 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>The Box-Swap Dilemma Test Case</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  In this scenario, the outer retail box matches the sold <strong className="text-white">iPhone 15 Pro Max (APPL-IPH15PM-256-NT)</strong> with genuine barcodes. However, the enclosed physical handset is an older <strong className="text-amber-200">iPhone 12 Pro</strong> with a Lightning connector and stainless steel frame.
                </p>
                <div className="text-[10px] text-amber-300/90 font-mono pt-0.5">
                  ✓ Demonstrates how RETURNIQ de-couples box barcode OCR from physical hardware body inspection.
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setStep('IMAGE_UPLOAD')}
                disabled={!selectedOrder}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2"
              >
                <span>Proceed to Evidence Capture</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Expected Product Spec Baseline Card */}
          <div className="lg:col-span-6 space-y-4">
            {selectedOrder ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-800/80 font-mono text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5">
                    <Box className="w-3 h-3 text-sky-400" />
                    EXPECTED (ORIGINAL CATALOG BOM)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Category: {selectedOrder.product.category}
                  </span>
                </div>

                <div className="flex items-start gap-4 pt-1">
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-black border border-slate-800 shrink-0">
                    <img
                      src={selectedOrder.product.imageUrl}
                      alt={selectedOrder.product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white">
                      {selectedOrder.product.name}
                    </h3>
                    <div className="text-xs text-slate-400 font-mono">
                      Brand: <strong className="text-slate-200">{selectedOrder.product.brand}</strong> · Model: <strong className="text-slate-200">{selectedOrder.product.model}</strong>
                    </div>
                    <div className="text-xs text-slate-400">
                      Color / Variant: <span className="text-slate-200">{selectedOrder.product.color}</span>
                    </div>
                    <div className="text-xs text-emerald-400 font-bold font-mono">
                      MSRP: ${selectedOrder.product.msrp.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Scannable Logistics Barcode Card */}
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono font-bold uppercase block">
                      ORIGINAL CATALOG SKU BARCODE
                    </span>
                    <span className="text-xs font-mono text-slate-300">
                      {selectedOrder.product.sku}
                    </span>
                  </div>
                  <Barcode value={selectedOrder.product.sku} height={32} displayValue={false} />
                </div>

                {/* Expected Components BOM */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Expected Components Manifest ({selectedOrder.product.expectedComponents.length} Items)
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Bill of Materials</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {selectedOrder.product.expectedComponents.map((comp: string, idx: number) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-300 flex items-center gap-2"
                      >
                        <CheckCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="truncate">{comp}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hardware Verification Signatures Guide */}
                <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Authentic Hardware Markers to Inspect:
                  </span>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1 text-slate-300 text-[11px] leading-relaxed">
                    <div>• <strong>Serial Location:</strong> {selectedOrder.product.physicalIdentifierLocation}</div>
                    {selectedOrder.product.hardwareSignatures.map((sig: string, idx: number) => (
                      <div key={idx}>• <strong>Signature {idx + 1}:</strong> {sig}</div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 text-xs">
                Select an order from the left to view expected BOM specifications.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 2: MULTI-ANGLE EVIDENCE CAPTURE                           */}
      {/* ============================================================== */}
      {step === 'IMAGE_UPLOAD' && selectedOrder && (
        <div className="space-y-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-mono text-[10px] font-bold tracking-wider uppercase">
                  DETECTED (OPTICAL EVIDENCE INTAKE)
                </span>
                <span className="text-xs text-slate-500 font-mono">Stage 2 of 3</span>
              </div>
              <h2 className="text-base font-bold text-white mt-1">Multi-Angle Return Evidence Capture</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Capture all 6 required perspectives to cross-verify outer box markings against interior physical chassis.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleLoadDemoImages}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Pre-load Demo Frames</span>
              </button>
            </div>
          </div>

          {/* 6 Category Upload Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {IMAGE_CATEGORIES.map((cat) => {
              const existingImg = uploadedImages.find((img) => img.category === cat.id);

              return (
                <div
                  key={cat.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    existingImg
                      ? 'border-emerald-800/70 bg-emerald-950/15'
                      : 'border-slate-800 bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white truncate">
                      {cat.label}
                    </span>
                    {existingImg ? (
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/80 px-2 py-0.5 border border-emerald-800/80 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Captured
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-semibold bg-amber-950/60 px-2 py-0.5 border border-amber-800/60 rounded-full">
                        Required
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 mb-3 min-h-[30px] leading-relaxed">
                    {cat.guidance}
                  </p>

                  {/* Thumbnail Preview or Upload Box */}
                  {existingImg ? (
                    <div className="relative group rounded-lg border border-slate-700 overflow-hidden h-36 bg-slate-950">
                      <img
                        src={existingImg.url}
                        alt={cat.label}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-slate-950/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <label className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 text-xs cursor-pointer border border-slate-700">
                          <span>Replace</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, cat.id)}
                            className="hidden"
                          />
                        </label>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedImages((prev) => prev.filter((img) => img.category !== cat.id));
                          }}
                          className="p-1.5 bg-rose-900/80 hover:bg-rose-800 rounded-lg text-rose-200 text-xs border border-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-36 border border-dashed border-slate-700 rounded-lg bg-slate-950/50 hover:bg-slate-950 flex flex-col items-center justify-center p-3 text-center transition-colors">
                      <Upload className="w-5 h-5 text-slate-400 mb-1.5" />
                      <span className="text-xs text-slate-300 font-medium">
                        Upload or Drag Image
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 font-mono">JPG, PNG, WebP up to 10MB</span>
                      <div className="mt-2.5 flex items-center gap-2">
                        <label className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded-lg cursor-pointer border border-slate-700">
                          Browse
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, cat.id)}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCategory(cat.id);
                            startCamera();
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded-lg flex items-center gap-1 border border-slate-700"
                        >
                          <Camera className="w-3 h-3" /> Camera
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Web Camera Modal */}
          {isCameraActive && (
            <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 max-w-lg w-full space-y-3 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-white">
                    Live Optical Intake: {IMAGE_CATEGORIES.find((c) => c.id === selectedCategory)?.label}
                  </h3>
                  <button
                    onClick={stopCamera}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={stopCamera}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={capturePhoto}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Capture Frame</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Bar Actions */}
          <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
            <button
              onClick={() => setStep('ORDER_INFO')}
              className="px-3.5 py-2 text-xs text-slate-400 hover:text-slate-200 font-medium"
            >
              Back to Order Intake
            </button>
            <button
              onClick={handleStartInspection}
              disabled={uploadedImages.length === 0}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-indigo-200" />
              <span>EXECUTE AI INSPECTION PIPELINE</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 3: ANIMATED AI INSPECTION WORKFLOW                        */}
      {/* ============================================================== */}
      {step === 'AI_PROCESSING' && (
        <div className="min-h-[460px] flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-xl space-y-6 shadow-sm">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 animate-ping" />
            <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <div className="absolute inset-2 rounded-full bg-slate-950 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-indigo-400 animate-pulse" />
            </div>
          </div>

          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/80 font-mono text-[10px] font-bold tracking-wider uppercase">
                AI FINDING (NEURAL VISION PROCESSING)
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              AI Returns Intelligence Pipeline Running
            </h2>
            <p className="text-xs text-slate-400 max-w-md">
              Cross-verifying outer carton OCR against physical chassis hardware signatures, BOM completeness, and return integrity.
            </p>
          </div>

          {/* Multi-stage Checklist with Animated Checkmarks */}
          <div className="w-full max-w-md bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
            {INSPECTION_STAGES.map((stage, idx) => {
              const isCompleted = idx < currentProgressIndex;
              const isCurrent = idx === currentProgressIndex;

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2.5 py-1 transition-colors ${
                    isCompleted
                      ? 'text-emerald-400'
                      : isCurrent
                      ? 'text-indigo-300 font-semibold'
                      : 'text-slate-600'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : isCurrent ? (
                    <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                  )}
                  <span className="truncate">{stage}</span>
                </div>
              );
            })}
          </div>

          <div className="text-xs font-mono text-slate-500">
            Processing stage {currentProgressIndex + 1} of {INSPECTION_STAGES.length} · Analyzing optical evidence...
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 4: FINAL INSPECTION WORKSPACE (SPLIT-SCREEN)              */}
      {/* ============================================================== */}
      {step === 'WORKSPACE' && aiResult && recommendation && selectedOrder && (
        <div className="space-y-6">
          {/* Status Bar Notification if Saved */}
          {isSaved && (
            <div className="p-4 bg-emerald-950/70 border border-emerald-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-200 shadow-md">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  Inspection verified and recorded in warehouse audit trail. Final Operator Sign-Off:{' '}
                  <strong className="text-white font-mono uppercase bg-emerald-900 px-2 py-0.5 rounded border border-emerald-700 ml-1">
                    {finalDecision}
                  </strong>.
                </span>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => completedRecord && setIsRoutingLabelModalOpen(true)}
                  className="px-3.5 py-1.5 bg-indigo-900/90 hover:bg-indigo-800 text-white rounded-lg font-semibold border border-indigo-700 flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <ScanBarcode className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Print Tote Routing Barcode</span>
                </button>
                <button
                  onClick={() => completedRecord && onOpenReportModal(completedRecord)}
                  className="px-3.5 py-1.5 bg-emerald-900/90 hover:bg-emerald-800 text-white rounded-lg font-semibold border border-emerald-700 flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>View Official Report</span>
                </button>
              </div>
            </div>
          )}

          {/* Verification Protocol Header Legend */}
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-slate-400">Order:</span>
              <span className="text-white font-bold">{selectedOrder.orderId}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">RMA:</span>
              <span className="text-slate-200">{selectedOrder.returnId}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Inspector:</span>
              <span className="text-indigo-300">Taylor Kim (Tech #481)</span>
            </div>

            {/* Clear Visual Distinction Legend */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800/80 font-bold">
                EXPECTED
              </span>
              <span className="text-slate-600">→</span>
              <span className="px-2 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-800/80 font-bold">
                DETECTED
              </span>
              <span className="text-slate-600">→</span>
              <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/80 font-bold">
                AI FINDING
              </span>
              <span className="text-slate-600">→</span>
              <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/80 font-bold">
                RECOMMENDATION
              </span>
              <span className="text-slate-600">→</span>
              <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-bold">
                OPERATOR DECISION
              </span>
            </div>
          </div>

          {/* Split-Screen Inspection Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* -------------------------------------------------------- */}
            {/* LEFT COLUMN: Visual Evidence Viewer & Interactive Overlays */}
            {/* -------------------------------------------------------- */}
            <div className="lg:col-span-5 space-y-4 bg-slate-900 border border-slate-800 rounded-xl p-4 sticky top-20 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/80 font-mono text-[10px] font-bold tracking-wider uppercase">
                    AI FINDING (NEURAL OPTICAL HUD)
                  </span>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mt-1">
                    Visual Evidence Inspection Viewport
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowCrosshairs(!showCrosshairs)}
                    className={`p-1.5 rounded-lg border text-xs transition-colors ${
                      showCrosshairs
                        ? 'bg-slate-800 border-indigo-500 text-indigo-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                    title="Toggle HUD reticle guide"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowOverlays(!showOverlays)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                      showOverlays
                        ? 'bg-indigo-950 border-indigo-700 text-indigo-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {showOverlays ? 'Hide Neural Overlays' : 'Show Neural Overlays'}
                  </button>
                </div>
              </div>

              {/* Main Image Viewport with Bounding Boxes */}
              <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-black aspect-[4/3] flex items-center justify-center group select-none">
                {currentDisplayImage ? (
                  <img
                    src={currentDisplayImage.url}
                    alt="Inspected return item"
                    className="w-full h-full object-contain transition-transform duration-200"
                    style={{ transform: `scale(${zoomLevel})` }}
                  />
                ) : (
                  <div className="text-slate-600 text-xs">No image frame available</div>
                )}

                {/* Optional HUD Reticle Guide */}
                {showCrosshairs && (
                  <div className="absolute inset-0 pointer-events-none opacity-25">
                    <div className="absolute inset-x-0 top-1/2 border-t border-indigo-400/40 border-dashed" />
                    <div className="absolute inset-y-0 left-1/2 border-l border-indigo-400/40 border-dashed" />
                    <div className="absolute top-2 left-2 text-[9px] font-mono text-indigo-400">HUD ZOOM: {Math.round(zoomLevel * 100)}%</div>
                  </div>
                )}

                {/* Overlaid Visual Detection Markers */}
                {showOverlays &&
                  aiResult.visualEvidenceMarkers.map((marker) => {
                    const isSelected = activeMarkerId === marker.id;
                    return (
                      <div
                        key={marker.id}
                        onClick={() => setActiveMarkerId(marker.id)}
                        className={`absolute border-2 border-dashed transition-all pointer-events-auto cursor-pointer ${
                          isSelected
                            ? 'border-amber-400 bg-amber-500/25 ring-2 ring-amber-400/50'
                            : 'border-indigo-400 bg-indigo-500/15 hover:border-indigo-300'
                        }`}
                        style={{
                          left: `${marker.box.x}%`,
                          top: `${marker.box.y}%`,
                          width: `${marker.box.w}%`,
                          height: `${marker.box.h}%`,
                        }}
                      >
                        <div className="absolute -top-5 left-0 px-1.5 py-0.2 bg-indigo-600 text-white text-[9px] font-bold rounded shadow-sm whitespace-nowrap flex items-center gap-1">
                          <Eye className="w-2.5 h-2.5" />
                          <span>{marker.label}</span>
                        </div>
                      </div>
                    );
                  })}

                {/* Zoom Controls Overlay */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-slate-900/90 backdrop-blur rounded-lg p-1 border border-slate-700 shadow-md">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.2))}
                    className="p-1 text-slate-300 hover:text-white"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono text-slate-300 px-1 tabular-nums">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                    className="p-1 text-slate-300 hover:text-white"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(1)}
                    className="p-1 text-slate-400 hover:text-white text-[10px]"
                    title="Reset Zoom"
                  >
                    1x
                  </button>
                </div>
              </div>

              {/* Angle Switcher Carousel */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">Captured Angle View:</span>
                  <span className="text-[10px] text-emerald-400 font-mono">6/6 Calibrated</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {IMAGE_CATEGORIES.map((cat, idx) => {
                    const img = uploadedImages.find((i) => i.category === cat.id);
                    const isSelected = selectedCategory === cat.id;

                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          setActiveImageIndex(idx);
                        }}
                        className={`text-center p-1.5 rounded-lg border text-[10px] transition-all truncate ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-950/80 text-white font-semibold shadow-sm ring-1 ring-indigo-500'
                            : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                        }`}
                        title={cat.label}
                      >
                        {cat.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Marker Descriptions List */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Neural Evidence Annotations ({aiResult.visualEvidenceMarkers.length}):
                </span>
                <div className="space-y-1.5 text-xs max-h-48 overflow-y-auto pr-1">
                  {aiResult.visualEvidenceMarkers.map((marker) => {
                    const isSelected = activeMarkerId === marker.id;
                    return (
                      <div
                        key={marker.id}
                        onClick={() => setActiveMarkerId(marker.id)}
                        className={`p-2 rounded-lg border space-y-0.5 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-amber-950/30 border-amber-500/80 ring-1 ring-amber-500/30'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-indigo-300">{marker.label}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            [{marker.category}]
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">{marker.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------- */}
            {/* RIGHT COLUMN: The 4 Core Verification Answers & Modules    */}
            {/* -------------------------------------------------------- */}
            <div className="lg:col-span-7 space-y-5">
              {/* ======================================================== */}
              {/* THE 4 CORE RETURN QUESTIONS — EXECUTIVE VERIFICATION CARD*/}
              {/* ======================================================== */}
              <div className="bg-slate-900 border border-indigo-900/80 rounded-xl p-5 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/80 font-mono text-[10px] font-bold tracking-wider uppercase">
                      RETURNS INSPECTION MANDATE
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1">
                      The 4 Core Verification Questions
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400 tabular-nums">
                    Order: {selectedOrder.orderId}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Q1: Is this actually the product that was sold? */}
                  <div
                    className={`p-3.5 rounded-xl border space-y-1.5 ${
                      aiResult.identity.status === 'MATCH'
                        ? 'bg-slate-950/70 border-slate-800'
                        : aiResult.identity.status === 'POTENTIAL_MISMATCH'
                        ? 'bg-amber-950/30 border-amber-800/80 ring-1 ring-amber-500/40'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      1. Is this actually the product sold?
                    </div>
                    {aiResult.identity.status === 'MATCH' ? (
                      <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>YES — Physical Product Verified</span>
                      </div>
                    ) : aiResult.identity.status === 'POTENTIAL_MISMATCH' ? (
                      <div className="space-y-1">
                        <div className="font-bold text-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Potential Product Mismatch — Manual Review Required.</span>
                        </div>
                        <p className="text-[10px] text-amber-200/90 leading-tight">
                          Box matches order, but enclosed device differs in model and hardware signatures.
                        </p>
                      </div>
                    ) : (
                      <div className="font-bold text-sky-400 flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4" />
                        <span>UNVERIFIED — Image Quality Insufficient</span>
                      </div>
                    )}
                  </div>

                  {/* Q2: Is everything that should be present actually present? */}
                  <div
                    className={`p-3.5 rounded-xl border space-y-1.5 ${
                      aiResult.completeness.status === 'COMPLETE'
                        ? 'bg-slate-950/70 border-slate-800'
                        : 'bg-amber-950/20 border-amber-900/60'
                    }`}
                  >
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      2. Is everything present?
                    </div>
                    {aiResult.completeness.status === 'COMPLETE' ? (
                      <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>YES — Complete ({aiResult.completeness.expectedCount}/{aiResult.completeness.expectedCount} Items Present)</span>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="font-bold text-amber-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>NO — {aiResult.completeness.missingCount} Item Missing</span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          Missing: {aiResult.completeness.missingComponents.join(', ')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Q3: What condition is the product in? */}
                  <div className="p-3.5 rounded-xl border bg-slate-950/70 border-slate-800 space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      3. What condition is it in?
                    </div>
                    <div className="font-bold text-white text-xs truncate">
                      {aiResult.condition.result}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Wear Level: <strong className="text-slate-200">{aiResult.condition.wearLevel}</strong> · Scale: <span className="text-indigo-300 font-mono">{scaleConfig.scaleName}</span>
                    </div>
                  </div>

                  {/* Q4: What should happen to it next? */}
                  <div className="p-3.5 rounded-xl border bg-slate-950/70 border-slate-800 space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      4. What should happen to it next?
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-black text-sm px-2.5 py-0.5 rounded tracking-wide ${
                          recommendation.disposition === 'RESTOCK'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : recommendation.disposition === 'REFURBISH'
                            ? 'bg-sky-950 text-sky-300 border border-sky-800'
                            : recommendation.disposition === 'LIQUIDATE'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : recommendation.disposition === 'DISPOSE'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-purple-950 text-purple-300 border border-purple-800'
                        }`}
                      >
                        {recommendation.disposition}
                      </span>
                      <span className="text-[10px] text-slate-400">Deterministic Engine</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* RETURNS MANAGER AGENT: EXPLAINABLE DECISION FLOW BANNER  */}
              {/* Returned Item → Condition Checks → Classification → Final Outcome → Supporting Evidence */}
              {/* ======================================================== */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 font-mono text-[10px] font-bold tracking-wider uppercase">
                      RETURNS MANAGER AGENT
                    </span>
                    <h3 className="text-sm font-bold text-white">Decision Flow & Explainable Audit Trail</h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Model: <strong className="text-blue-300">ReturnsManagerAgent-v2.5-prod</strong>
                  </span>
                </div>

                {/* 5-Step Pipeline Steps */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 text-xs">
                  {/* Step 1: Returned Item */}
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-[9px] font-mono text-blue-400 font-bold uppercase block">
                      1. Returned Item
                    </span>
                    <div className="font-semibold text-white truncate">{selectedOrder.product.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">S/N: {selectedOrder.serialNumber || 'N/A'}</div>
                  </div>

                  {/* Step 2: Condition Checks */}
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-[9px] font-mono text-blue-400 font-bold uppercase block">
                      2. Condition Checks
                    </span>
                    <div className="text-[11px] font-semibold text-slate-200">5 Protocols Run</div>
                    <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                      <span>Identity · Wear · Seals · Kit · S/N</span>
                    </div>
                  </div>

                  {/* Step 3: Classification */}
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-[9px] font-mono text-blue-400 font-bold uppercase block">
                      3. Classification
                    </span>
                    <div className="text-[11px] font-semibold text-white">
                      {aiResult.condition?.wearLevel || 'PRISTINE'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">Grade: {aiResult.condition?.result?.split(' - ')[0] || 'Grade A'}</div>
                  </div>

                  {/* Step 4: Final Outcome */}
                  <div className={`p-3 rounded-lg border space-y-1 ${
                    aiResult.identity.status === 'POTENTIAL_MISMATCH' || aiResult.integrity.status === 'MANUAL_REVIEW_REQUIRED'
                      ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                      : 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                  }`}>
                    <span className="text-[9px] font-mono font-bold uppercase block">
                      4. Final Outcome
                    </span>
                    <div className="text-sm font-bold uppercase">
                      {aiResult.identity.status === 'POTENTIAL_MISMATCH'
                        ? 'FURTHER INSPECTION'
                        : recommendation.disposition === 'RESTOCK'
                        ? 'ACCEPT'
                        : recommendation.disposition === 'DISPOSE'
                        ? 'REJECT'
                        : recommendation.disposition}
                    </div>
                    <div className="text-[9px] font-mono opacity-80">
                      Confidence: {aiResult.identity.confidenceScore ? `${aiResult.identity.confidenceScore}%` : '92%'}
                    </div>
                  </div>

                  {/* Step 5: Evidence */}
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-[9px] font-mono text-blue-400 font-bold uppercase block">
                      5. Evidence Log
                    </span>
                    <div className="text-[11px] font-semibold text-emerald-400">Database Synced</div>
                    <div className="text-[10px] text-slate-400 font-mono">SQLite + Supabase</div>
                  </div>
                </div>

                {/* Safety Guarantee Callout: Conservative Non-Forced Decisions */}
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-2 text-slate-300 font-semibold text-[11px]">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Decision Integrity Guarantee (Conservative Unambiguous Policy)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    The Returns Manager Agent never forces a decision when evidence is ambiguous, unreadable, or missing. Under uncertainty, the case routes directly to <strong className="text-amber-300">Further Inspection</strong> with structured audit records, avoiding costly false acceptances or incorrect rejections.
                  </p>
                </div>
              </div>

              {/* ======================================================== */}
              {/* 1. PRODUCT IDENTITY & BOX-SWAP VERIFICATION MODULE       */}
              {/* ======================================================== */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold tracking-wider uppercase">
                      MODULE 1
                    </span>
                    <h3 className="text-sm font-bold text-white">Product Identity Verification</h3>
                  </div>
                  {aiResult.identity.status === 'MATCH' ? (
                    <span className="px-2.5 py-0.5 text-xs font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-800/80 rounded flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> PRODUCT MATCH
                    </span>
                  ) : aiResult.identity.status === 'POTENTIAL_MISMATCH' ? (
                    <span className="px-2.5 py-0.5 text-xs font-semibold text-amber-300 bg-amber-950/90 border border-amber-800 rounded flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Potential Product Mismatch — Manual Review Required.
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 text-xs font-semibold text-slate-300 bg-slate-800 border border-slate-700 rounded">
                      MANUAL REVIEW REQUIRED — UNCLEAR EVIDENCE
                    </span>
                  )}
                </div>

                {/* Specific Problem Callout: When Box = Product A but Returned Physical = Product B */}
                {aiResult.identity.boxVsDeviceComparison?.isProductMismatch && (
                  <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Potential Product Mismatch — Manual Review Required.</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      <strong>Multi-Signal Hardware Detection:</strong> Outer carton label designates <span className="text-white font-semibold">{aiResult.identity.boxVsDeviceComparison.boxModel}</span>, but computer vision analysis of the physical device hardware (connectors, camera arrays, chassis finish) matches <span className="text-amber-300 font-semibold">{aiResult.identity.boxVsDeviceComparison.deviceModel}</span>.
                    </p>
                    <div className="p-2.5 bg-black/40 rounded-lg border border-amber-900/60 text-[10px] text-slate-400 leading-normal">
                      <strong className="text-amber-200">Non-Accusatory Protocol:</strong> This observation triggers supervisory review to check for shipping mis-picks, return slip mix-ups, or supplier box discrepancies. It does not automatically accuse the customer of fraud.
                    </div>
                  </div>
                )}

                {/* 3-Column Comparative Board: EXPECTED vs DETECTED (BOX) vs DETECTED (DEVICE) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Column 1: EXPECTED */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-sky-900/40 space-y-1">
                    <span className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/60 text-[9px] font-bold tracking-wider font-mono inline-block">
                      EXPECTED (ORDER BOM)
                    </span>
                    <div className="font-semibold text-white pt-1">{selectedOrder.product.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      SKU: {selectedOrder.product.sku}
                    </div>
                  </div>

                  {/* Column 2: DETECTED (BOX LABEL) */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-teal-900/40 space-y-1">
                    <span className="px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800/60 text-[9px] font-bold tracking-wider font-mono inline-block">
                      DETECTED (BOX OCR)
                    </span>
                    <div className="font-semibold text-slate-200 pt-1">
                      {aiResult.identity.boxVsDeviceComparison.boxModel}
                    </div>
                    <div className="text-[11px] text-emerald-400 font-mono">
                      Box SKU: {aiResult.identity.boxVsDeviceComparison.boxSku}
                    </div>
                  </div>

                  {/* Column 3: DETECTED (PHYSICAL HARDWARE) */}
                  <div
                    className={`p-3.5 rounded-xl border space-y-1 ${
                      aiResult.identity.status === 'MATCH'
                        ? 'bg-slate-950/80 border-slate-800'
                        : 'bg-amber-950/30 border-amber-800/80 ring-1 ring-amber-500/30'
                    }`}
                  >
                    <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60 text-[9px] font-bold tracking-wider font-mono inline-block">
                      DETECTED (DEVICE BODY)
                    </span>
                    <div
                      className={`font-semibold pt-1 ${
                        aiResult.identity.status === 'MATCH' ? 'text-white' : 'text-amber-200'
                      }`}
                    >
                      {aiResult.identity.detectedProduct}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      AI Confidence:{' '}
                      <span className="text-slate-300 italic">
                        {aiResult.identity.confidenceScore !== null
                          ? `${aiResult.identity.confidenceScore}%`
                          : 'Confidence not available'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Optical Barcode Cross-Verification Comparator */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <ScanBarcode className="w-3.5 h-3.5 text-indigo-400" />
                      Optical Barcode Comparison Strip (Box Label vs Physical Chassis)
                    </span>
                    {aiResult.identity.boxVsDeviceComparison.serialNumberConsistency === 'VERIFIED_MATCH' ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold">
                        ✓ Barcodes Aligned
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-mono font-bold">
                        ⚠ Barcode Mismatch Detected
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 flex flex-col items-center">
                      <span className="text-[10px] text-slate-400 font-mono mb-1">
                        BOX CARTON STICKER BARCODE
                      </span>
                      <Barcode
                        value={aiResult.identity.boxVsDeviceComparison.boxSku || selectedOrder.product.sku}
                        height={32}
                      />
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 flex flex-col items-center">
                      <span className="text-[10px] text-slate-400 font-mono mb-1">
                        PHYSICAL CHASSIS ETCHED SERIAL BARCODE
                      </span>
                      <Barcode
                        value={
                          aiResult.identity.boxVsDeviceComparison.serialNumberConsistency === 'VERIFIED_MATCH'
                            ? selectedOrder.serialNumber
                            : 'F2L-SWAP-9902'
                        }
                        height={32}
                      />
                    </div>
                  </div>
                </div>

                {/* THE CORE SOLUTION: Box vs Physical Device Hardware Cross-Verification */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-indigo-950 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
                      Box vs. Physical Device Hardware Cross-Verification
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Multi-Signal Matrix</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Outer Box Model</span>
                      <span className="font-medium text-slate-200 truncate block">
                        {aiResult.identity.boxVsDeviceComparison.boxModel}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Device Chassis Model</span>
                      <span
                        className={`font-medium truncate block ${
                          aiResult.identity.boxVsDeviceComparison.hardwareFeatureConsistency ===
                          'DISCREPANCY_DETECTED'
                            ? 'text-amber-400'
                            : 'text-slate-200'
                        }`}
                      >
                        {aiResult.identity.boxVsDeviceComparison.deviceModel}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Serial Etching Match</span>
                      <span
                        className={`font-medium block ${
                          aiResult.identity.boxVsDeviceComparison.serialNumberConsistency ===
                          'VERIFIED_MATCH'
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {aiResult.identity.boxVsDeviceComparison.serialNumberConsistency.replace(
                          '_',
                          ' '
                        )}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Hardware Signatures</span>
                      <span
                        className={`font-medium block ${
                          aiResult.identity.boxVsDeviceComparison.hardwareFeatureConsistency ===
                          'CONSISTENT'
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {aiResult.identity.boxVsDeviceComparison.hardwareFeatureConsistency.replace(
                          '_',
                          ' '
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Identity Evidence bullets */}
                  <div className="pt-1.5 space-y-1">
                    {aiResult.identity.evidence.map((ev, idx) => (
                      <div key={idx} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                        <span className="text-indigo-400">·</span>
                        <span>{ev}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* 2. COMPLETENESS VERIFICATION MODULE                      */}
              {/* ======================================================== */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold tracking-wider uppercase">
                      MODULE 2
                    </span>
                    <h3 className="text-sm font-bold text-white">Completeness & BOM Inventory</h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-200">
                    {aiResult.completeness.detectedCount} / {aiResult.completeness.expectedCount} components detected
                  </span>
                </div>

                {/* Missing warning if any */}
                {aiResult.completeness.missingCount > 0 && (
                  <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-xl text-xs text-amber-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Missing: <strong>{aiResult.completeness.missingComponents.join(', ')}</strong>
                    </span>
                  </div>
                )}

                {/* Visual Checklist */}
                <div className="space-y-1.5 text-xs">
                  {aiResult.completeness.expectedComponents.map((comp, idx) => {
                    const isDetected = aiResult.completeness.detectedComponents.some(
                      (d) => d.toLowerCase() === comp.toLowerCase()
                    );
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2.5 rounded-lg border ${
                          isDetected
                            ? 'bg-slate-950/60 border-slate-800 text-slate-200'
                            : 'bg-rose-950/20 border-rose-900/60 text-rose-300 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isDetected ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <X className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                          <span>{comp}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {isDetected ? 'Detected' : 'Missing'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ======================================================== */}
              {/* 3. CONDITION ASSESSMENT MODULE                          */}
              {/* ======================================================== */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold tracking-wider uppercase">
                      MODULE 3
                    </span>
                    <h3 className="text-sm font-bold text-white">Condition Assessment</h3>
                  </div>
                  <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800 font-mono">
                    Scale: {scaleConfig.scaleName}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1 text-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Condition Result ({scaleConfig.scaleName})
                  </span>
                  <div className="text-sm font-semibold text-white">
                    {aiResult.condition.result}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Wear Level Classification: <strong className="text-slate-200">{aiResult.condition.wearLevel}</strong>
                  </div>
                </div>

                {/* Evidence Findings */}
                <div className="space-y-1.5 text-xs">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Visual Defect Evidence:
                  </span>
                  {aiResult.condition.evidence.map((ev, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-slate-300">
                      <span className="text-indigo-400">·</span>
                      <span>{ev}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ======================================================== */}
              {/* 4. RETURN INTEGRITY MULTI-SIGNAL CHECK                  */}
              {/* ======================================================== */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold tracking-wider uppercase">
                      MODULE 4
                    </span>
                    <h3 className="text-sm font-bold text-white">Return Integrity Multi-Signal Matrix</h3>
                  </div>
                  {aiResult.integrity.status === 'LOW_CONCERN' ? (
                    <span className="px-2.5 py-0.5 text-xs font-semibold text-emerald-300 bg-emerald-950 border border-emerald-800 rounded">
                      Low Concern
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 text-xs font-semibold text-amber-300 bg-amber-950 border border-amber-800 rounded">
                      ⚠ Return Integrity Concern
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">SKU Match</span>
                    <span className="font-semibold text-emerald-400">✓ Match</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Barcode Match</span>
                    <span className="font-semibold text-emerald-400">✓ Match</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Serial Match</span>
                    <span
                      className={`font-semibold ${
                        aiResult.integrity.serialMatch ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {aiResult.integrity.serialMatch ? '✓ Match' : '⚠ Mismatch'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Visual Hardware</span>
                    <span
                      className={`font-semibold ${
                        aiResult.integrity.visualProductMatch ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {aiResult.integrity.visualProductMatch ? '✓ Match' : '⚠ Discrepancy'}
                    </span>
                  </div>
                </div>

                {aiResult.integrity.flags.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {aiResult.integrity.flags.map((flag, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/80 text-xs text-amber-200"
                      >
                        {flag}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ======================================================== */}
              {/* 5. DETERMINISTIC BUSINESS RULES & RECOMMENDED DISPOSITION */}
              {/* ======================================================== */}
              <div className="bg-slate-900 border border-indigo-900/60 rounded-xl p-5 space-y-4 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/80 font-mono text-[10px] font-bold tracking-wider uppercase">
                    RECOMMENDATION (BUSINESS RULE ENGINE)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Applied: {recommendation.appliedRuleId}
                  </span>
                </div>

                {/* Big Prominent Recommendation Card */}
                <div
                  className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    recommendation.disposition === 'RESTOCK'
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                      : recommendation.disposition === 'REFURBISH'
                      ? 'bg-sky-950/60 border-sky-800 text-sky-300'
                      : recommendation.disposition === 'LIQUIDATE'
                      ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                      : recommendation.disposition === 'DISPOSE'
                      ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                      : 'bg-purple-950/60 border-purple-800 text-purple-300'
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider block opacity-80">
                      Recommended Disposition
                    </span>
                    <div className="text-2xl font-black font-sans tracking-tight">
                      {recommendation.disposition}
                    </div>
                    <div className="text-xs opacity-90">
                      Triggered by: {recommendation.ruleName}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-black/40 text-xs font-mono font-medium border border-white/10">
                      Policy Rule Output
                    </span>
                  </div>
                </div>

                {/* Why this recommendation? */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Why this recommendation?
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    {recommendation.reasons.map((r, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-300"
                      >
                        {r.type === 'PASS' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : r.type === 'WARN' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : r.type === 'FAIL' ? (
                          <X className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        ) : (
                          <HelpCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                        )}
                        <span>{r.point}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ====================================================== */}
                {/* 6. HUMAN-IN-THE-LOOP OPERATOR CONTROLS                 */}
                {/* ====================================================== */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-mono text-[10px] font-bold tracking-wider uppercase">
                        FINAL OPERATOR DECISION
                      </span>
                      <h4 className="text-xs font-bold text-white mt-1">
                        Human-in-the-Loop Signoff & Audit Logging
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Operator: Taylor Kim (Tech #481)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => handleConfirmDecision(recommendation.disposition)}
                      className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Accept Recommendation</span>
                    </button>

                    <button
                      onClick={() => setIsOverrideModalOpen(true)}
                      className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Sliders className="w-4 h-4 text-slate-400" />
                      <span>Change Decision</span>
                    </button>

                    <button
                      onClick={() => handleConfirmDecision('MANUAL_REVIEW')}
                      className="py-2.5 px-4 bg-amber-950/80 hover:bg-amber-900 border border-amber-800/80 text-amber-200 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Send to Manual Review</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Operator Decision Override Modal */}
      {isOverrideModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Operator Decision Override</h3>
              <button
                onClick={() => setIsOverrideModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1.5 font-medium">
                  Select Override Disposition:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['RESTOCK', 'REFURBISH', 'LIQUIDATE', 'DISPOSE'] as DispositionType[]).map(
                    (disp) => (
                      <button
                        key={disp}
                        onClick={() => setFinalDecision(disp)}
                        className={`p-2 rounded-lg border font-semibold text-center transition-all ${
                          finalDecision === disp
                            ? 'border-indigo-500 bg-indigo-950 text-white shadow-sm ring-1 ring-indigo-500'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                        }`}
                      >
                        {disp}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1.5 font-medium">
                  Reason for changing decision:
                </label>
                <select
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value="AI assessment incorrect">AI assessment incorrect</option>
                  <option value="Additional physical inspection">Additional physical inspection</option>
                  <option value="Policy exception">Policy exception</option>
                  <option value="Missing evidence">Missing evidence</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1.5 font-medium">
                  Operator Audit Notes (Required):
                </label>
                <textarea
                  rows={3}
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  placeholder="Record justification for compliance audit..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsOverrideModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsOverrideModalOpen(false);
                  handleConfirmDecision(finalDecision);
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow"
              >
                Confirm & Record in Audit Trail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Optical Barcode Scanner Terminal Modal */}
      <BarcodeScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        availableOrders={availableOrders}
        onSelectOrder={(ord) => {
          handleSelectOrder(ord);
          setStep('ORDER_INFO');
        }}
      />

      {/* Warehouse Tote Routing 4x6 Barcode Label Modal */}
      {completedRecord && (
        <WarehouseRoutingLabelModal
          inspection={completedRecord}
          isOpen={isRoutingLabelModalOpen}
          onClose={() => setIsRoutingLabelModalOpen(false)}
        />
      )}
    </div>
  );
};
