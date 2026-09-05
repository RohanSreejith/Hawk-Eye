import React, { useState } from 'react';
import { Play, Pause, Trash2, ShieldAlert, Truck, AlertTriangle, ArrowLeft, CheckCircle2, Zap, RefreshCw } from 'lucide-react';
import { triggerDemoScenario, startDemoLoop, stopDemoLoop, clearDemoIncidents } from '../services/api';

interface DemoPageProps {
  onBackToDashboard: () => void;
  onRefreshData: () => void;
}

export const DemoPage: React.FC<DemoPageProps> = ({ onBackToDashboard, onRefreshData }) => {
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const handleTrigger = async (scenario: string, label: string) => {
    setLoading(scenario);
    try {
      const res = await triggerDemoScenario(scenario);
      setLastResult({ scenario: label, ...res });
      onRefreshData();
    } catch (e) {
      console.error('Trigger failed', e);
    } finally {
      setLoading(null);
    }
  };

  const handleToggleLoop = async () => {
    if (isLooping) {
      await stopDemoLoop();
      setIsLooping(false);
    } else {
      await startDemoLoop();
      setIsLooping(true);
    }
  };

  const handleClear = async () => {
    if (confirm('Clear incident history and notifications from the database?')) {
      await clearDemoIncidents();
      onRefreshData();
    }
  };

  const scenarios = [
    {
      id: 'vehicle_proximity',
      name: 'SCENARIO 2: VEHICLE–PERSON PROXIMITY',
      badge: 'HIGH RISK (87/100)',
      badgeColor: 'bg-rose-950 border-rose-500 text-rose-400',
      icon: Truck,
      desc: 'Worker enters blindspot of reversing dump truck in Loading Zone. Triggers kiosk alarm, supervisor mobile notification, and 10s video evidence.'
    },
    {
      id: 'no_helmet',
      name: 'SCENARIO 1: NO HELMET / HARD HAT VIOLATION',
      badge: 'WARNING (45/100)',
      badgeColor: 'bg-amber-950 border-amber-500 text-amber-400',
      icon: AlertTriangle,
      desc: 'Worker enters Main Gate checkpoint without approved hard-hat. Triggers voice alert at worker safety kiosk.'
    },
    {
      id: 'zone_breach',
      name: 'SCENARIO 3: RESTRICTED CRANE RADIUS BREACH',
      badge: 'CRITICAL (96/100)',
      badgeColor: 'bg-rose-950 border-rose-500 text-rose-400',
      icon: ShieldAlert,
      desc: 'Worker crosses barricade into live Crane swing envelope. Initiates automatic critical stop protocol.'
    },
    {
      id: 'no_harness',
      name: 'SCENARIO 4: ELEVATED HEIGHT (NO HARNESS)',
      badge: 'HIGH RISK (82/100)',
      badgeColor: 'bg-orange-950 border-orange-500 text-orange-400',
      icon: AlertTriangle,
      desc: 'Worker operating within 1 meter of unprotected Floor 1 edge without fall-arrest harness tethered.'
    },
    {
      id: 'compound_ppe',
      name: 'SCENARIO 5: COMPOUND MULTI-PPE FAILURE',
      badge: 'CRITICAL (94/100)',
      badgeColor: 'bg-rose-950 border-rose-500 text-rose-400',
      icon: Zap,
      desc: 'Worker missing both hard hat AND high-vis vest simultaneously in heavy equipment zone.'
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Command Center
        </button>

        <div className="text-right">
          <h1 className="text-lg font-bold text-white tracking-wide">
            INTERACTIVE DEMO CONTROL CENTER
          </h1>
          <p className="text-xs font-mono text-slate-400">
            One-Click Full Safety Pipeline Validation
          </p>
        </div>
      </div>

      {/* Automated Simulation Loop Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">AUTOMATED SCENARIO SIMULATION</span>
            <span className={`px-2 py-0.5 text-xs font-mono rounded ${
              isLooping ? 'bg-emerald-950 text-emerald-400 border border-emerald-500' : 'bg-slate-800 text-slate-400'
            }`}>
              {isLooping ? 'RUNNING SEQUENTIAL LOOPS' : 'IDLE'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Periodically triggers real end-to-end safety events for hands-off presentation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleLoop}
            className={`px-5 py-2 rounded-lg text-xs font-bold font-mono flex items-center gap-2 transition-all cursor-pointer shadow ${
              isLooping
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isLooping ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            {isLooping ? 'PAUSE DEMO LOOP' : 'START DEMO LOOP'}
          </button>

          <button
            onClick={handleClear}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
            title="Clear all incidents from DB"
          >
            <Trash2 className="w-4 h-4" />
            Clear DB
          </button>
        </div>
      </div>

      {/* Trigger Buttons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {scenarios.map((sc) => {
          const Icon = sc.icon;
          const isLoading = loading === sc.id;

          return (
            <div
              key={sc.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-xs tracking-wider flex items-center gap-1.5">
                    <Icon className="w-4 h-4 text-blue-400" />
                    {sc.name}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${sc.badgeColor}`}>
                    {sc.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-4">
                  {sc.desc}
                </p>
              </div>

              <button
                onClick={() => handleTrigger(sc.id, sc.name)}
                disabled={isLoading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg text-xs font-bold font-mono tracking-wider flex items-center justify-center gap-2 shadow transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    EXECUTING REAL PIPELINE...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current text-yellow-300" />
                    TRIGGER THIS SCENARIO
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Last Trigger Result Feedback */}
      {lastResult && (
        <div className="bg-slate-950 border border-emerald-500/40 rounded-xl p-4 font-mono text-xs text-slate-300 shadow-xl">
          <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>FULL PIPELINE EXECUTED SUCCESSFULLY: {lastResult.scenario}</span>
          </div>
          <div className="space-y-1 text-[11px] text-slate-400">
            <div>• Event ID: <strong className="text-white">{lastResult.incident?.event_id}</strong></div>
            <div>• Assessed Risk: <strong className="text-rose-400">{lastResult.incident?.risk_score} / 100 ({lastResult.incident?.severity?.toUpperCase()})</strong></div>
            <div>• 10-second Forensic Clip: <strong className="text-blue-400">{lastResult.incident?.evidence_clip_path}</strong></div>
            <div>• WebSockets Dispatched: <strong className="text-emerald-400">Dashboard, Kiosk, and Mobile UI Updated</strong></div>
          </div>
        </div>
      )}
    </div>
  );
};
