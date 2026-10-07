import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, X } from 'lucide-react';

export default function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-container">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 w-full">
        <span className="text-sm font-bold text-white tracking-tight">RecoveryOS</span>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-slate-300 hover:text-white rounded-md bg-slate-800"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar (Desktop always visible, Mobile toggleable) */}
      <div className={`${mobileMenuOpen ? 'block' : 'hidden'} md:block`}>
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
