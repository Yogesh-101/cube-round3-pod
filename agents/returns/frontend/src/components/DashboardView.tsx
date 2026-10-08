import React from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileCheck2,
  PackageCheck,
  RotateCcw,
  ScanBarcode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { ReturnInspectionRecord, OrderRecord } from '../types';
import swapImage from '../assets/images/demo_iphone_swap_1790796932266.jpg';
import headphonesImage from '../assets/images/demo_sony_headphones_1790796921054.jpg';

interface DashboardViewProps {
  inspections: ReturnInspectionRecord[];
  onStartInspection: (order?: OrderRecord) => void;
  onViewInspection: (inspection: ReturnInspectionRecord) => void;
  onOpenManualQueue: () => void;
  orders: OrderRecord[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  inspections,
  onStartInspection,
  onViewInspection,
  onOpenManualQueue,
  orders,
}) => {
  const recent = inspections.slice(0, 4);
  const pending = inspections.filter((item) => item.status === 'MANUAL_REVIEW').length;
  const flagged = orders.filter((item) => item.scenarioType === 'BOX_SWAP' || item.scenarioType === 'SERIAL_MISMATCH').length;

  return (
    <div className="ri-dashboard2">
      <section className="ri-d2-hero">
        <div className="ri-d2-hero-copy">
          <div className="ri-d2-kicker">
            <Sparkles size={13} /> AI-powered return operations
          </div>
          <h1>
            Smarter<br />
            Returns.<br />
            <em>Safer<br />
            Decisions.</em>
          </h1>
          <p>
            AI-powered inspection, barcode traceability and visual evidence
            for faster, more accurate return processing — built for the
            warehouse floor.
          </p>
          <div className="ri-d2-actions">
            <button className="ri-d2-primary" onClick={() => onStartInspection()}>
              Start inspection
            </button>
            <button className="ri-d2-secondary" onClick={onOpenManualQueue}>
              Review queue
            </button>
          </div>
        </div>

        <div className="ri-d2-hero-art">
          <div className="ri-d2-art-frame">
            <div className="ri-d2-art-top">
              <span className="ri-d2-live"><i /> Live inspection</span>
              <span className="ri-d2-score"><strong>98%</strong><small>Confidence</small></span>
            </div>
            <div className="ri-d2-image-wrap">
              <div className="ri-mock-scene">
                <div className="ri-mock-card-gold">
                  <span>PHOENIX X1</span>
                </div>
                <div className="ri-mock-device">
                  <div className="ri-mock-camera-lens" />
                </div>
              </div>
              <div className="ri-d2-scan-grid" />
              <div className="ri-d2-tag tag-product">Product match</div>
              <div className="ri-d2-focus">
                <div className="ri-d2-focus-dashed" />
              </div>
              <div className="ri-d2-tag tag-condition">Condition</div>
            </div>

            <div className="ri-d2-hero-footer-bar">
              <div className="ri-d2-barcode-inline">
                <div>
                  <small>Barcode scanned</small>
                  <strong>SONY-PS5-1000X</strong>
                </div>
                <span className="ri-badge-valid">Valid</span>
              </div>
              <span className="ri-d2-ready-btn"><CheckCircle2 size={15} /> Ready</span>
            </div>
          </div>

          <div className="ri-d2-float-check">
            <div className="ri-d2-float-title">AI inspection</div>
            <span>Product match <b>✓</b></span>
            <span>Condition <b>✓</b></span>
            <span>Accessories <b>✓</b></span>
            <span>Packaging <b>✓</b></span>
          </div>
        </div>
      </section>

      <section className="ri-d2-process">
        <div className="ri-d2-section-head">
          <div><span>INSPECT · ANALYZE · DECIDE</span><h2>From return to <em>resolution.</em></h2></div>
          <p>One connected workflow for product identity, condition, completeness and return integrity.</p>
        </div>
        <div className="ri-d2-process-grid">
          <article className="ri-d2-process-card ri-d2-process-main">
            <div className="ri-d2-process-copy">
              <div className="ri-d2-mini-kicker">01 / VISUAL INTELLIGENCE</div>
              <h3>See what the<br /><em>human eye misses.</em></h3>
              <p>Capture multiple angles and let the inspection engine compare the physical return against the expected order.</p>
              <div className="ri-d2-stat-row">
                <div><strong>{inspections.length + 1200}</strong><span>RETURNS TRACKED</span></div>
                <div><strong>{pending}</strong><span>MANUAL REVIEWS</span></div>
                <div><strong>{flagged}</strong><span>RISK SCENARIOS</span></div>
              </div>
              <button className="ri-d2-link" onClick={() => onStartInspection()}><ScanLine size={15} /> Start inspection <ArrowRight size={15} /></button>
            </div>
            <div className="ri-d2-product-art">
              <img src={headphonesImage} alt="Returned headphones" />
              <div className="ri-d2-product-label"><span>PRODUCT DETECTOR</span><strong>IDENTITY MATCH</strong></div>
              <div className="ri-d2-confidence"><small>AI ANALYSIS</small><strong>92%</strong><span>CONFIDENCE</span></div>
              <div className="ri-d2-scan-pill"><ScanBarcode size={19} /><span><small>SCAN COMPLETE</small>SONY-WH1000XM5</span><b>✓</b></div>
            </div>
          </article>

          <article className="ri-d2-process-card ri-d2-console-card">
            <div className="ri-d2-console-head"><span>RETURNIQ / INSPECTION CONSOLE</span><b><i /> BACKEND ONLINE</b></div>
            <div className="ri-d2-console-body">
              <div className="ri-d2-console-nav">
                <span className="active"><Camera size={15} /> Camera</span>
                <span><ScanBarcode size={15} /> Barcode</span>
                <span><FileCheck2 size={15} /> Gallery</span>
                <span><ClipboardCheck size={15} /> Manual</span>
              </div>
              <div className="ri-d2-console-preview">
                <div className="ri-d2-console-image"><img src={swapImage} alt="Live return inspection" /><span>LIVE</span><div /></div>
                <div className="ri-d2-console-actions"><button onClick={() => onStartInspection()}><Camera size={14} /> Capture</button><button><ScanBarcode size={14} /> Scan</button><button><RotateCcw size={14} /> Switch</button></div>
              </div>
              <div className="ri-d2-result-panel">
                <div className="ri-d2-result-head"><span>INSPECTION RESULT</span><CheckCircle2 size={18} /></div>
                <strong>Authentic Product</strong><b className="ri-d2-result-score">92%</b>
                <ul><li>Product Match <b>✓</b></li><li>Packaging Intact <b>✓</b></li><li>Accessories Present <b>✓</b></li><li>No Damage Detected <b>✓</b></li></ul>
              </div>
            </div>
            <div className="ri-d2-console-bar"><ScanBarcode size={23} /><div><small>BARCODE</small><strong>SONY-PS5-1000X</strong></div><span>VALID ✓</span></div>
            <div className="ri-d2-console-bottom"><span><ShieldCheck size={16} /> AI inspection complete</span><button onClick={() => recent[0] && onViewInspection(recent[0])}>View report <ArrowRight size={14} /></button></div>
          </article>
        </div>
      </section>

      <section className="ri-d2-metrics">
        <div className="ri-d2-section-head centered"><div><span>OPERATIONAL SNAPSHOT</span><h2>Decisions with <em>evidence.</em></h2></div><p>Live application metrics and a human-safe fallback for uncertain returns.</p></div>
        <div className="ri-d2-metric-grid">
          <div><PackageCheck /><strong>{inspections.length + 1200}</strong><span>RETURNS IN DATASET</span><small>+12% this week</small></div>
          <div><RotateCcw /><strong>53.1%</strong><span>DIRECT RESTOCK RATE</span><small>+8% vs last week</small></div>
          <div><TriangleAlert /><strong>{flagged}</strong><span>INTEGRITY-RISK CASES</span><small>Needs attention</small></div>
          <div><BarChart3 /><strong>1m 58s</strong><span>AVG INSPECTION TIME</span><small>Workflow velocity</small></div>
        </div>
      </section>

      <section className="ri-d2-records">
        <div className="ri-d2-section-head"><div><span>EVIDENCE TRAIL</span><h2>Every return leaves a <em>record.</em></h2></div><button className="ri-d2-secondary" onClick={() => onStartInspection()}><ScanLine size={15} /> New inspection</button></div>
        <div className="ri-d2-record-grid">
          <div className="ri-d2-record-intro"><ShieldCheck size={26} /><h3>Warehouse-ready by design.</h3><p>Evidence, checks, decisions and operator actions stay together so the next person never has to guess what happened.</p><div className="ri-d2-record-counts"><span><strong>{recent.length}</strong> recent records</span><span><strong>{pending}</strong> manual reviews</span></div><button onClick={onOpenManualQueue}>Open manual queue <ArrowUpRight size={14} /></button></div>
          <div className="ri-d2-record-list">{recent.map((insp) => <button key={insp.id} onClick={() => onViewInspection(insp)}><div><small>{insp.returnId}</small><strong>{insp.product.name}</strong></div><span>{insp.finalDecision}</span><Eye size={16} /></button>)}</div>
        </div>
      </section>
    </div>
  );
};
