import React, { useState } from 'react';
import { KPICards } from '../components/KPICards';
import { CameraGrid } from '../components/CameraGrid';
import { IncidentBanner } from '../components/IncidentBanner';
import { IncidentModal } from '../components/IncidentModal';
import { RiskHeatmap } from '../components/RiskHeatmap';
import { AnalyticsPanel } from '../components/AnalyticsPanel';
import { AgentDrawer } from '../components/AgentDrawer';
import { Incident, Camera, KPIs, HeatmapZone, AgentLog } from '../types';
import { ShieldCheck, Play, Eye, Clock, AlertCircle } from 'lucide-react';

interface DashboardPageProps {
  kpis: KPIs | null;
  cameras: Camera[];
  incidents: Incident[];
  heatmapZones: HeatmapZone[];
  agentLogs: AgentLog[];
  analytics: any;
  latestCriticalIncident: Incident | null;
  onAcknowledgeIncident: (id: number) => void;
  onResolveIncident: (id: number) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  kpis,
  cameras,
  incidents,
  heatmapZones,
  agentLogs,
  analytics,
  latestCriticalIncident,
  onAcknowledgeIncident,
  onResolveIncident
}) => {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [agentDrawerOpen, setAgentDrawerOpen] = useState<boolean>(true);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* Top Incident Banner (when critical/high incident is active) */}
      <IncidentBanner
        incident={latestCriticalIncident}
        onViewDetails={(inc) => setSelectedIncident(inc)}
      />

      {/* KPI Cards */}
      <KPICards kpis={kpis} />

      {/* Live CCTV Matrix */}
      <CameraGrid
        cameras={cameras}
        onSelectCamera={(id) => {
          // Find matching incident for camera if any
          const inc = incidents.find(i => i.camera_id === id);
          if (inc) setSelectedIncident(inc);
        }}
      />

      {/* Agent Transparency Drawer */}
      <AgentDrawer
        logs={agentLogs}
        isOpen={agentDrawerOpen}
        onToggle={() => setAgentDrawerOpen(!agentDrawerOpen)}
      />

      {/* Grid: Active Incidents List (5 cols) & Risk Heatmap (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        {/* Left Column: Recent & Active Incidents (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-lg p-3.5 shadow-md flex flex-col">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold tracking-wider text-slate-200">
                ACTIVE INCIDENTS ({incidents.filter(i => i.status !== 'resolved').length})
              </h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400">REAL-TIME FEED</span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2 pr-1">
            {incidents.length === 0 ? (
              <div className="text-center text-slate-500 py-10 font-mono text-xs">
                No active incidents recorded.
              </div>
            ) : (
              incidents.map((inc) => {
                const isCrit = inc.severity === 'critical';
                const isHigh = inc.severity === 'high';
                const isResolved = inc.status === 'resolved';

                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className={`p-3 rounded-lg border bg-slate-950 hover:bg-slate-900 transition-all cursor-pointer flex flex-col justify-between ${
                      isCrit ? 'border-rose-500/60 shadow-rose-950/20' :
                      isHigh ? 'border-orange-500/50 shadow-orange-950/20' :
                      isResolved ? 'border-slate-800 opacity-60' :
                      'border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded uppercase ${
                          isCrit ? 'bg-rose-950 text-rose-400 border border-rose-600' :
                          isHigh ? 'bg-orange-950 text-orange-400 border border-orange-600' :
                          isResolved ? 'bg-slate-900 text-slate-400' :
                          'bg-amber-950 text-amber-400 border border-amber-600'
                        }`}>
                          {inc.severity}
                        </span>
                        <span className="text-xs font-bold text-white tracking-wide truncate max-w-[170px]">
                          {inc.event_type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {inc.timestamp ? new Date(inc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Now'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 line-clamp-2 my-1">
                      {inc.description}
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-900">
                      <span>{inc.zone} • {inc.camera_id}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-rose-400 font-bold">RISK: {inc.risk_score}</span>
                        <span className="text-blue-400 hover:text-blue-300 flex items-center gap-0.5">
                          <Eye className="w-3 h-3" /> View
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Site Heatmap (7 cols) */}
        <div className="lg:col-span-7">
          <RiskHeatmap heatmapZones={heatmapZones} />
        </div>
      </div>

      {/* Safety Analytics Panel */}
      <AnalyticsPanel analytics={analytics} />

      {/* Forensic Incident Detail Modal */}
      {selectedIncident && (
        <IncidentModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onAcknowledge={(id) => {
            onAcknowledgeIncident(id);
            setSelectedIncident(prev => prev ? { ...prev, status: 'acknowledged' } : null);
          }}
          onResolve={(id) => {
            onResolveIncident(id);
            setSelectedIncident(prev => prev ? { ...prev, status: 'resolved' } : null);
          }}
        />
      )}
    </div>
  );
};
