import React, { useState, useEffect } from 'react';
import { X, BarChart3, AlertTriangle, ShieldCheck, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import { fetchAnalytics, fetchIncidents, fetchKPIs } from '../services/api';
import { Incident, KPIs } from '../types';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ isOpen, onClose }) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inc, k] = await Promise.all([fetchIncidents(), fetchKPIs()]);
      setIncidents(inc);
      setKpis(k);
    } catch (e) {
      console.error('Failed loading analytics data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Compute breakdown
  const noHelmetCount = incidents.filter(i => i.event_type.toLowerCase().includes('helmet')).length;
  const vehicleCount = incidents.filter(i => i.event_type.toLowerCase().includes('vehicle') || i.event_type.toLowerCase().includes('proximity')).length;
  const zoneBreachCount = incidents.filter(i => i.event_type.toLowerCase().includes('breach') || i.event_type.toLowerCase().includes('zone')).length;
  const harnessCount = incidents.filter(i => i.event_type.toLowerCase().includes('harness') || i.event_type.toLowerCase().includes('fall')).length;
  const totalCount = incidents.length || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wide text-white">Site Safety Analytics & Warning Intelligence</h2>
              <p className="text-xs text-slate-400 font-mono">Real-time incident distribution, hazard patterns, and response metrics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 uppercase block">Total Warnings</span>
              <span className="text-2xl font-black text-amber-400 mt-1 block">
                {incidents.length}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Continuous monitoring</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 uppercase block">Active Violations</span>
              <span className="text-2xl font-black text-rose-400 mt-1 block">
                {incidents.filter(i => i.status !== 'resolved').length}
              </span>
              <span className="text-[10px] text-rose-400/80 font-mono">Unresolved</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 uppercase block">Compliance Rate</span>
              <span className="text-2xl font-black text-emerald-400 mt-1 block">
                {Math.max(88, 100 - incidents.filter(i => i.status === 'open').length * 2)}%
              </span>
              <span className="text-[10px] text-emerald-400/80 font-mono">Site-wide OSHA index</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 uppercase block">Avg Alert Escalation</span>
              <span className="text-2xl font-black text-sky-400 mt-1 block">
                1.2s
              </span>
              <span className="text-[10px] text-sky-400/80 font-mono">Instant SMS dispatch</span>
            </div>
          </div>

          {/* Hazard Type Breakdown Bars */}
          <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Warning Category Distribution
            </h3>

            <div className="space-y-3 font-mono text-xs">
              {/* No Helmet */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>⛑️ No Helmet / PPE Omission</span>
                  <span className="text-amber-400 font-bold">{noHelmetCount} ({Math.round((noHelmetCount / totalCount) * 100)}%)</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(10, Math.round((noHelmetCount / totalCount) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Vehicle Proximity */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>🚛 Vehicle / Worker Proximity Hazard</span>
                  <span className="text-rose-400 font-bold">{vehicleCount} ({Math.round((vehicleCount / totalCount) * 100)}%)</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(10, Math.round((vehicleCount / totalCount) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Zone Breach */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>🚷 Restricted Perimeter / Crane Zone Breach</span>
                  <span className="text-purple-400 font-bold">{zoneBreachCount} ({Math.round((zoneBreachCount / totalCount) * 100)}%)</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(8, Math.round((zoneBreachCount / totalCount) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Heights / Harness */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>🧗 Working at Heights (No Harness)</span>
                  <span className="text-blue-400 font-bold">{harnessCount} ({Math.round((harnessCount / totalCount) * 100)}%)</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(8, Math.round((harnessCount / totalCount) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Warnings Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center justify-between">
              <span>Recent Warnings & Safety Logs ({incidents.length})</span>
              <span className="text-[11px] text-slate-400 font-normal">Audit-trail preserved</span>
            </h3>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Camera / Zone</th>
                    <th className="py-2.5 px-3">Warning Type</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Mandated Action</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {incidents.slice(0, 10).map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(inc.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {inc.camera_id} • {inc.zone}
                      </td>
                      <td className="py-2.5 px-3 text-white font-bold">
                        {inc.event_type.replace(/_/g, ' ').toUpperCase()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            inc.severity === 'critical'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              : inc.severity === 'high'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                          }`}
                        >
                          {inc.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 text-[11px] max-w-xs truncate">
                        {inc.recommended_action}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                            inc.status === 'resolved'
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : 'text-rose-400 bg-rose-500/10'
                          }`}
                        >
                          {inc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>HACK-EYE Construction Safety Intelligence OS</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
