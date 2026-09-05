import React, { useState } from 'react';
import { Smartphone, Bell, Video, PhoneCall, CheckCircle, ShieldAlert, ArrowLeft, Wifi, Battery } from 'lucide-react';
import { Incident } from '../types';

interface MobilePageProps {
  incidents: Incident[];
  onAcknowledge: (id: number) => void;
  onResolve: (id: number) => void;
  onBackToDashboard: () => void;
}

export const MobilePage: React.FC<MobilePageProps> = ({
  incidents,
  onAcknowledge,
  onResolve,
  onBackToDashboard
}) => {
  const activeIncidents = incidents.filter(i => i.status !== 'resolved');
  const [selectedId, setSelectedId] = useState<number | null>(activeIncidents.length > 0 ? activeIncidents[0].id : null);
  const [callInitiated, setCallInitiated] = useState<boolean>(false);

  const currentIncident = incidents.find(i => i.id === selectedId) || (incidents.length > 0 ? incidents[0] : null);

  const handleCall = () => {
    setCallInitiated(true);
    setTimeout(() => setCallInitiated(false), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col items-center">
      {/* Top Header Controls */}
      <div className="w-full flex items-center justify-between mb-4 max-w-sm">
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Command Center
        </button>
        <span className="text-xs font-mono text-slate-400">
          SIMULATED SUPERVISOR PHONE
        </span>
      </div>

      {/* Realistic Smartphone Shell */}
      <div className="w-[360px] h-[720px] bg-slate-950 border-[10px] border-slate-800 rounded-[44px] shadow-2xl overflow-hidden flex flex-col relative">
        {/* Phone Notch & Status Bar */}
        <div className="bg-black text-white px-6 pt-2.5 pb-1.5 flex items-center justify-between text-[11px] font-sans">
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <div className="w-20 h-4 bg-slate-900 rounded-full mx-auto" />
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-white" />
            <Battery className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        {/* App Top Bar */}
        <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-extrabold text-xs tracking-wider text-white">SAHAYI DISPATCH</span>
          </div>
          <span className="text-[10px] font-mono text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
            SUPERVISOR ON-DUTY
          </span>
        </div>

        {/* Call Banner Notification */}
        {callInitiated && (
          <div className="bg-emerald-600 text-white p-2.5 text-center text-xs font-bold animate-bounce flex items-center justify-center gap-1.5">
            <PhoneCall className="w-4 h-4" />
            Connecting directly to Loading Zone radio channel...
          </div>
        )}

        {/* Phone Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-950">
          {/* Latest Push Notification Card */}
          {currentIncident && (
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-3 shadow-xl space-y-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1 text-rose-400 font-bold">
                  <Bell className="w-3 h-3" /> HIGH-PRIORITY ESCALATION
                </span>
                <span>{new Date(currentIncident.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              <div>
                <h4 className="text-sm font-black text-white uppercase">
                  {currentIncident.event_type.replace(/_/g, ' ')}
                </h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Location: <strong className="text-white">{currentIncident.zone}</strong> • {currentIncident.camera_id}
                </p>
                <div className="mt-1 flex items-center gap-2 text-[11px] font-mono">
                  <span className="text-rose-400 font-bold">Risk: {currentIncident.risk_score}/100</span>
                  <span className="text-slate-400">• Conf: {Math.round(currentIncident.confidence * 100)}%</span>
                </div>
              </div>

              {/* Video Evidence */}
              <div className="rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center relative shadow-inner">
                <video
                  src={currentIncident.evidence_clip_path || `/clips/${currentIncident.event_id}.mp4`}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-1 left-2 bg-black/70 px-1.5 py-0.5 rounded text-[9px] font-mono text-white">
                  10s FORENSIC EVIDENCE
                </div>
              </div>

              {/* Recommended Action */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-amber-500/30 text-xs">
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase block mb-0.5">
                  MANDATORY RESPONSE:
                </span>
                <p className="text-amber-200 text-[11px] font-medium leading-snug">
                  {currentIncident.recommended_action}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => onAcknowledge(currentIncident.id)}
                  disabled={currentIncident.status === 'acknowledged' || currentIncident.status === 'resolved'}
                  className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    currentIncident.status === 'acknowledged' || currentIncident.status === 'resolved'
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {currentIncident.status === 'acknowledged' ? 'ACKNOWLEDGED' : 'ACKNOWLEDGE'}
                </button>

                <button
                  onClick={handleCall}
                  className="py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1 transition-all"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  RADIO STEWARD
                </button>
              </div>

              <button
                onClick={() => onResolve(currentIncident.id)}
                disabled={currentIncident.status === 'resolved'}
                className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  currentIncident.status === 'resolved'
                    ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-400'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                {currentIncident.status === 'resolved' ? 'HAZARD RESOLVED ✓' : 'MARK HAZARD RESOLVED'}
              </button>
            </div>
          )}

          {/* Quick Incident Switcher Feed */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              OTHER NOTIFICATIONS ({incidents.length})
            </span>
            {incidents.slice(0, 4).map((inc) => (
              <div
                key={inc.id}
                onClick={() => setSelectedId(inc.id)}
                className={`p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                  selectedId === inc.id
                    ? 'bg-slate-800 border-blue-500'
                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="font-bold text-white">{inc.event_type.replace(/_/g, ' ')}</span>
                  <span className={inc.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'}>
                    {inc.severity.toUpperCase()}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {inc.zone} • {inc.camera_id}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Phone Bottom Home Bar */}
        <div className="bg-slate-950 py-2 flex justify-center border-t border-slate-900">
          <div className="w-32 h-1 bg-slate-700 rounded-full" />
        </div>
      </div>
    </div>
  );
};
