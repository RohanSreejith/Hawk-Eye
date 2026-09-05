import React from 'react';
import { AlertCircle, ShieldAlert, CheckCircle2, Play, ChevronRight } from 'lucide-react';
import { Incident } from '../types';

interface IncidentBannerProps {
  incident: Incident | null;
  onViewDetails: (incident: Incident) => void;
}

export const IncidentBanner: React.FC<IncidentBannerProps> = ({ incident, onViewDetails }) => {
  if (!incident || incident.status === 'resolved') {
    return null;
  }

  const isCritical = incident.severity === 'critical';
  const isHigh = incident.severity === 'high';

  if (!isCritical && !isHigh) {
    return null;
  }

  return (
    <div
      className={`border rounded-lg p-3.5 mb-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
        isCritical
          ? 'bg-rose-950/40 border-rose-500/80 alert-critical-flash'
          : 'bg-amber-950/40 border-amber-500/70'
      }`}
    >
      {/* Alert Header & Content */}
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg mt-0.5 ${
            isCritical ? 'bg-rose-500 text-white' : 'bg-amber-500 text-slate-950'
          }`}
        >
          <ShieldAlert className="w-5 h-5 animate-bounce" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-black uppercase px-2 py-0.5 rounded tracking-wider ${
                isCritical ? 'bg-rose-600 text-white' : 'bg-amber-500 text-slate-950'
              }`}
            >
              {isCritical ? 'CRITICAL SAFETY EVENT' : 'HIGH-RISK HAZARD'}
            </span>
            <span className="text-white font-bold text-sm tracking-wide">
              {incident.event_type.replace(/_/g, ' ').toUpperCase()}
            </span>
            <span className="text-xs font-mono text-slate-400">
              • {incident.zone} ({incident.camera_id})
            </span>
          </div>

          <p className="text-xs text-slate-200 mt-1 line-clamp-1">
            {incident.description}
          </p>

          <div className="flex items-center gap-4 mt-2 text-[11px] font-mono text-slate-300 flex-wrap">
            <div className="flex items-center gap-1 text-rose-400 font-bold">
              <span>RISK SCORE:</span>
              <span className="px-1.5 py-0.2 bg-rose-950/80 rounded border border-rose-500/40">
                {incident.risk_score} / 100
              </span>
            </div>
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Supervisor Escalated</span>
            </div>
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>10s Evidence Buffer Captured</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action CTA */}
      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
        <button
          onClick={() => onViewDetails(incident)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-md flex items-center gap-1.5 shadow transition-all cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          PLAY EVIDENCE & DISPATCH
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
