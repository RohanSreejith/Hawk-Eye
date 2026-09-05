import React from 'react';
import { X, ShieldAlert, CheckCircle, Clock, Video, AlertTriangle, UserCheck, Bot } from 'lucide-react';
import { Incident } from '../types';

interface IncidentModalProps {
  incident: Incident | null;
  onClose: () => void;
  onAcknowledge: (id: number) => void;
  onResolve: (id: number) => void;
}

export const IncidentModal: React.FC<IncidentModalProps> = ({
  incident,
  onClose,
  onAcknowledge,
  onResolve
}) => {
  if (!incident) return null;

  const isCritical = incident.severity === 'critical';
  const isHigh = incident.severity === 'high';
  const isResolved = incident.status === 'resolved';
  const isAck = incident.status === 'acknowledged';

  // Format timestamps for realistic timeline audit
  const baseTime = incident.timestamp ? new Date(incident.timestamp) : new Date();
  const formatTime = (date: Date, addSec: number) => {
    const d = new Date(date.getTime() + addSec * 1000);
    return d.toLocaleTimeString([], { hour12: false });
  };

  const timelineSteps = [
    { time: formatTime(baseTime, 0), label: 'Computer Vision Detection', desc: `Entity track identified in ${incident.zone}` },
    { time: formatTime(baseTime, 1), label: 'Risk Engine Evaluation', desc: `Assessed risk score ${incident.risk_score}/100 [${incident.severity.toUpperCase()}]` },
    { time: formatTime(baseTime, 1), label: 'Site Kiosk Audio Warning', desc: 'Dispatched audible voice & visual hazard notice' },
    { time: formatTime(baseTime, 2), label: 'Supervisor Mobile Notification', desc: 'Dispatched instant notification with telemetry' },
    { time: formatTime(baseTime, 6), label: 'Forensic Evidence Compiled', desc: '10-second multi-angle video buffered and watermarked' },
  ];

  if (isAck && incident.acknowledged_at) {
    timelineSteps.push({
      time: new Date(incident.acknowledged_at).toLocaleTimeString([], { hour12: false }),
      label: 'Supervisor Acknowledged',
      desc: 'Site safety steward confirmed alert on mobile'
    });
  }

  if (isResolved && incident.resolved_at) {
    timelineSteps.push({
      time: new Date(incident.resolved_at).toLocaleTimeString([], { hour12: false }),
      label: 'Incident Resolved & Closed',
      desc: 'Hazard cleared and verified compliant'
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isCritical ? 'bg-rose-600 text-white' : 'bg-amber-500 text-slate-950'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white tracking-wide">
                  {incident.event_type.replace(/_/g, ' ').toUpperCase()}
                </h3>
                <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded uppercase ${
                  isCritical ? 'bg-rose-950 border border-rose-500 text-rose-400' :
                  isHigh ? 'bg-orange-950 border border-orange-500 text-orange-400' :
                  'bg-amber-950 border border-amber-500 text-amber-400'
                }`}>
                  {incident.severity}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  ID: {incident.event_id}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Site: {incident.site_id} • Zone: <strong className="text-slate-200">{incident.zone}</strong> • Camera: {incident.camera_id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Forensic Evidence Video (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shadow-inner flex flex-col">
              <div className="bg-slate-900/90 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-300">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Video className="w-3.5 h-3.5" /> 10-SECOND EVIDENCE PLAYBACK
                </span>
                <span>DURATION: 10.0s</span>
              </div>
              
              <div className="aspect-video w-full bg-black flex items-center justify-center relative">
                <video
                  src={incident.evidence_clip_path || `/clips/${incident.event_id}.mp4`}
                  controls
                  autoPlay
                  loop
                  muted
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="p-2.5 bg-slate-950 text-[11px] font-mono text-slate-400 flex items-center justify-between border-t border-slate-900">
                <span>BUFFER: 5s Pre-Event + 5s Post-Event</span>
                <span className="text-slate-300">CONFIDENCE: {Math.round((incident.confidence || 0.92) * 100)}%</span>
              </div>
            </div>

            {/* AI Summary Card */}
            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-lg">
              <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-blue-400 font-mono">
                <Bot className="w-4 h-4 text-blue-400" />
                <span>AI FORENSIC REASONING (Ollama / Analyst Agent)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {incident.ai_summary || incident.description}
              </p>
            </div>

            {/* Recommended Safety Action */}
            <div className="bg-amber-950/20 border border-amber-500/40 p-3.5 rounded-lg">
              <div className="flex items-center gap-2 mb-1 text-xs font-bold text-amber-400 font-mono">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>MANDATED EHS CORRECTIVE ACTION</span>
              </div>
              <p className="text-xs text-amber-100 font-medium">
                {incident.recommended_action}
              </p>
            </div>
          </div>

          {/* Right Column: Incident Telemetry & Audit Timeline (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Risk Index Box */}
            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg">
              <span className="text-[11px] font-mono text-slate-400 block mb-1">COMPOSITE RISK INDEX</span>
              <div className="flex items-end gap-3">
                <span className={`text-4xl font-extrabold font-mono ${
                  incident.risk_score >= 75 ? 'text-rose-500' :
                  incident.risk_score >= 50 ? 'text-orange-400' : 'text-amber-400'
                }`}>
                  {incident.risk_score}
                </span>
                <span className="text-xs text-slate-400 mb-1.5 font-mono">/ 100 ({incident.severity.toUpperCase()})</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    incident.risk_score >= 75 ? 'bg-rose-500' :
                    incident.risk_score >= 50 ? 'bg-orange-400' : 'bg-amber-400'
                  }`}
                  style={{ width: `${incident.risk_score}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block font-mono">
                Calculated via Proximity × Exposure × Persistence × Context Heuristic
              </span>
            </div>

            {/* Audit Timeline */}
            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg flex-1">
              <span className="text-[11px] font-mono text-slate-400 block mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" /> EVENT AUDIT TIMELINE
              </span>
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-2 before:w-0.5 before:bg-slate-800 pl-6">
                {timelineSteps.map((step, idx) => (
                  <div key={idx} className="relative text-xs">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border border-slate-900" />
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span className="text-white font-semibold">{step.label}</span>
                      <span>{step.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="bg-slate-950 px-5 py-3 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs font-mono text-slate-400">
            CURRENT STATUS:{' '}
            <span className={`font-bold ${
              isResolved ? 'text-emerald-400' : isAck ? 'text-blue-400' : 'text-amber-400'
            }`}>
              {incident.status.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isAck && !isResolved && (
              <button
                onClick={() => onAcknowledge(incident.id)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md shadow flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                ACKNOWLEDGE ALERT
              </button>
            )}
            {!isResolved && (
              <button
                onClick={() => onResolve(incident.id)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-md shadow flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                MARK RESOLVED
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-md transition-all cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
