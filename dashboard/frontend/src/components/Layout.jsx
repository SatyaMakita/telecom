import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, Radio, Move, MapPin, BookOpen,
  ClipboardList, FileDown, ChevronLeft, ChevronRight, Radio as RadioIcon, LocateFixed, Lock,
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/tracker', label: 'Live Tracker', icon: LocateFixed },
  { path: '/eir-demo', label: 'CEIR & Anti-Theft', icon: Lock },
  { path: '/subscribers', label: 'Subscribers', icon: Users },
  { path: '/cells', label: 'Cell Sites', icon: Radio },
  { path: '/mobility', label: 'Mobility', icon: Move },
  { path: '/positioning', label: 'Positioning', icon: MapPin },
  { path: '/protocols', label: 'Protocols', icon: BookOpen },
  { path: '/audit', label: 'Audit Log', icon: ClipboardList },
  { path: '/reports', label: 'Reports', icon: FileDown },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-slate-800 border-r border-slate-700 flex flex-col z-30 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-700 shrink-0">
          <RadioIcon className="w-7 h-7 text-blue-400 shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white truncate">Telecom Lab</h1>
              <p className="text-[10px] text-slate-400 truncate">5G SA Engineering Kit</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {navItems.map(({ path, label, icon: Icon }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  end={path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 border border-transparent'
                    }`
                  }
                  title={label}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-slate-700 p-2 shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full py-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Header */}
        <header className="h-16 bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 flex items-center justify-between px-6 shrink-0 sticky top-0 z-20">
          <h2 className="text-lg font-semibold text-white">Telecom Lab Dashboard</h2>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
            ⚠ Synthetic Data Only
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
