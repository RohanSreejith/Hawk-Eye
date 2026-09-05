import React from 'react';
import { BarChart3, TrendingUp, ShieldCheck, Clock } from 'lucide-react';

interface AnalyticsPanelProps {
  analytics: any;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ analytics }) => {
  const byType = analytics?.by_type || [
    { name: 'Vehicle Proximity', count: 14 },
    { name: 'No Helmet', count: 9 },
    { name: 'Zone Breach', count: 6 },
    { name: 'No Harness', count: 5 },
    { name: 'Compound PPE', count: 3 }
  ];

  const bySeverity = analytics?.by_severity || [
    { name: 'Critical', count: 8, color: 'bg-rose-500' },
    { name: 'High', count: 12, color: 'bg-orange-500' },
    { name: 'Warning', count: 11, color: 'bg-amber-500' },
    { name: 'Low', count: 6, color: 'bg-emerald-500' }
  ];

  const totalEvents = byType.reduce((acc: number, item: any) => acc + item.count, 0) || 37;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-md mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-bold tracking-wider text-slate-200">
            SAFETY ANALYTICS & INCIDENT METRICS
          </h2>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 border border-blue-500/30 text-blue-300">
          OSHA & EHS COMPLIANCE LOG
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Hazards by Type */}
        <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800/80">
          <span className="text-xs font-mono text-slate-400 block mb-2.5">INCIDENTS BY HAZARD TYPE</span>
          <div className="space-y-2">
            {byType.map((item: any, i: number) => {
              const pct = Math.round((item.count / totalEvents) * 100);
              return (
                <div key={i} className="text-xs">
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-300 truncate">{item.name}</span>
                    <span className="text-slate-400">{item.count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Severity Distribution */}
        <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800/80">
          <span className="text-xs font-mono text-slate-400 block mb-2.5">SEVERITY TIER BREAKDOWN</span>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {bySeverity.map((sev: any, i: number) => {
              const colorClass = 
                sev.name.toLowerCase() === 'critical' ? 'text-rose-400 border-rose-500/30 bg-rose-950/20' :
                sev.name.toLowerCase() === 'high' ? 'text-orange-400 border-orange-500/30 bg-orange-950/20' :
                sev.name.toLowerCase() === 'warning' ? 'text-amber-400 border-amber-500/30 bg-amber-950/20' :
                'text-emerald-400 border-emerald-500/30 bg-emerald-950/20';

              return (
                <div key={i} className={`border p-2 rounded ${colorClass} text-center`}>
                  <div className="text-lg font-mono font-extrabold">{sev.count}</div>
                  <div className="text-[10px] font-mono uppercase">{sev.name}</div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            High & Critical incidents trigger instant supervisor escalation and 10-second forensic buffer clipping.
          </p>
        </div>

        {/* System Performance & Deduplication */}
        <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800/80 flex flex-col justify-between">
          <div>
            <span className="text-xs font-mono text-slate-400 block mb-2.5">INTERVENTION SPEED & DEDUP</span>
            
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" /> Avg Alert Latency:
                </span>
                <span className="text-emerald-400 font-bold">1.2 seconds</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Alerts Filtered:
                </span>
                <span className="text-cyan-400 font-bold">18 spams prevented</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Forensic MP4s Stored:</span>
                <span className="text-white font-bold">{analytics?.evidence_clips_generated || 8}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 p-2 rounded text-[10px] font-mono text-slate-400 mt-2">
            Historical baseline seeded as <span className="text-amber-400 font-semibold">DEMO DATA</span> for complete 30-hr telemetry validation.
          </div>
        </div>
      </div>
    </div>
  );
};
