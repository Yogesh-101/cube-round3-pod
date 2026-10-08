import React, { useState } from 'react';
import { Bell, ScanBarcode, ShieldAlert, AlertTriangle, CheckCircle2, Menu, X } from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  pendingReviewsCount: number;
  onOpenBoxSwapModal?: () => void;
  onOpenBarcodeScanner?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  pendingReviewsCount,
  onOpenBoxSwapModal,
  onOpenBarcodeScanner,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'How it works' },
    { id: 'analytics', label: 'Results' },
    { id: 'returns', label: 'Records' },
    { id: 'new-inspection', label: 'Inspect' },
    { id: 'decision-rules', label: 'Rules' },
  ];

  const select = (id: string) => {
    onSelectTab(id);
    setMobileOpen(false);
  };

  return (
    <header className="ri-header">
      <div className="ri-nav-inner">
        <button className="ri-brand" onClick={() => select('dashboard')} aria-label="ReturnIQ home">
          <span className="ri-brand-mark">RQ</span>
          <span className="ri-brand-text">ReturnIQ</span>
          <span className="ri-brand-sub">Return Intelligence</span>
        </button>

        <nav className="ri-main-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`ri-nav-link ${currentTab === item.id ? 'active' : ''}`}
              onClick={() => select(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ri-nav-actions">
          {onOpenBarcodeScanner && (
            <button className="ri-icon-action" onClick={onOpenBarcodeScanner} title="Scan barcode">
              <span>Scan</span>
            </button>
          )}
          {onOpenBoxSwapModal && (
            <button className="ri-icon-action" onClick={onOpenBoxSwapModal} title="Box-swap solution">
              <span>Box swap</span>
            </button>
          )}
          <div className="ri-notify-wrap">
            <button className="ri-notify" onClick={() => setShowNotifications((v) => !v)} title="Notifications">
              <Bell size={16} />
              {pendingReviewsCount > 0 && <i />}
            </button>
            {showNotifications && (
              <div className="ri-notify-popover">
                <div className="ri-notify-head"><b>System alerts</b><span>{pendingReviewsCount} action items</span></div>
                <div className="ri-notify-item"><AlertTriangle size={16} /><div><b>Potential product swap</b><span>Integrity review is waiting for an operator.</span></div></div>
                <div className="ri-notify-item ok"><CheckCircle2 size={16} /><div><b>Inspection service ready</b><span>Vision and decision engine are online.</span></div></div>
              </div>
            )}
          </div>
          <button className="ri-mobile-toggle" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="ri-mobile-menu">
          {navItems.map((item) => <button key={item.id} onClick={() => select(item.id)}>{item.label}</button>)}
          <button onClick={() => { onOpenBarcodeScanner?.(); setMobileOpen(false); }}>Scan barcode</button>
          <button onClick={() => { onOpenBoxSwapModal?.(); setMobileOpen(false); }}>Box-swap solution</button>
        </div>
      )}
    </header>
  );
};
