import React from 'react';
import { ShieldAlert, Activity, Monitor, Smartphone, Sliders, EyeOff } from 'lucide-react';
import { SystemStatus } from '../types';

interface NavbarProps {
  currentTab: string;
  setTab: (tab: string) => void;
  systemStatus: SystemStatus | null;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setTab, systemStatus }) => {
  return (
    <header className="bg-slate-950 border-b border-slate-800 text-slate-100 px-4 py-3 sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left Branding */}
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-lg flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-wider text-white">SAHAYI</span>
              <span className="px-2 py-0.5 text-xs font-mono bg-emerald-950 border border-emerald-500/40 text-emerald-400 rounded flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-online inline-block" />
                SYSTEM ONLINE
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono tracking-tight">
              AI-Powered Construction Safety Intelligence • <span className="text-slate-300">Turning CCTV into an Active Safety System</span>
            </p>
          </div>
        </div>

        {/* Center Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setTab('dashboard')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
              currentTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Command Center
          </button>
          <button
            onClick={() => setTab('kiosk')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
              currentTab === 'kiosk'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            Site Kiosk (/kiosk)
          </button>
          <button
            onClick={() => setTab('mobile')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
              currentTab === 'mobile'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Supervisor Mobile (/mobile)
          </button>
          <button
            onClick={() => setTab('demo')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
              currentTab === 'demo'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Demo Controls (/demo)
          </button>
        </nav>

        {/* Right Status Tags & Privacy Badge */}
        <div className="hidden lg:flex items-center gap-2">
          <div className="text-right text-xs font-mono">
            <div className="text-slate-400">
              ENGINE: <span className="text-emerald-400">{systemStatus?.vision_mode || 'REAL_YOLO'}</span>
            </div>
            <div className="text-slate-500 text-[10px]">
              {systemStatus?.model_name || 'yolo11n.pt'} • {systemStatus?.device || 'CPU/GPU'}
            </div>
          </div>
          <div
            title="Privacy First: Video analysis is strictly for site safety. No facial recognition or biometric profiling."
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 border border-slate-700/60 rounded text-[11px] text-slate-400 hover:text-slate-300"
          >
            <EyeOff className="w-3.5 h-3.5 text-blue-400" />
            <span>Anonymous IDs</span>
          </div>
        </div>
      </div>
    </header>
  );
};
