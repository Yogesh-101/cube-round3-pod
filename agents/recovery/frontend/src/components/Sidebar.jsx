import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Search, UploadCloud, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/charges', label: 'Charges', icon: FileText },
    { to: '/evidence', label: 'Evidence', icon: Search },
    { to: '/ingestion', label: 'Ingestion', icon: UploadCloud },
  ];

  // User initials
  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-bold text-white tracking-tight leading-tight">RecoveryOS</div>
          <div className="text-[11px] text-slate-400 font-medium">Evidence-to-Recovery</div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="p-3 flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Menu & Logout */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/40">
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-full bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate" title={user?.full_name}>
                {user?.full_name || 'Operator'}
              </div>
              <div className="text-[11px] text-slate-400 truncate font-mono" title={user?.email}>
                {user?.email || 'user@recoveryos.io'}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors shrink-0"
            title="Log out of RecoveryOS"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
