import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert, Volume2, VolumeX, ArrowLeft } from 'lucide-react';
import { Incident } from '../types';

interface KioskPageProps {
  latestAlert: Incident | null;
  onBackToDashboard: () => void;
}

export const KioskPage: React.FC<KioskPageProps> = ({ latestAlert, onBackToDashboard }) => {
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [lastSpokenId, setLastSpokenId] = useState<string | null>(null);

  // Audio SpeechSynthesis effect
  useEffect(() => {
    if (!latestAlert || !audioEnabled) return;
    if (latestAlert.event_id === lastSpokenId) return;

    // Check SpeechSynthesis API support
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // stop previous utterances
      
      let speechText = "";
      if (latestAlert.severity === 'critical') {
        speechText = `Attention on site! Critical safety alert! ${latestAlert.recommended_action}. ${latestAlert.recommended_action}!`;
      } else {
        speechText = `Safety warning! ${latestAlert.recommended_action}!`;
      }

      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      window.speechSynthesis.speak(utterance);
      setLastSpokenId(latestAlert.event_id);
    }
  }, [latestAlert, audioEnabled, lastSpokenId]);

  // Determine Kiosk Status Mode
  const isCritical = latestAlert && latestAlert.severity === 'critical' && latestAlert.status !== 'resolved';
  const isWarning = latestAlert && (latestAlert.severity === 'high' || latestAlert.severity === 'warning') && latestAlert.status !== 'resolved';

  return (
    <div
      className={`min-h-[calc(100vh-65px)] flex flex-col justify-between p-6 transition-colors duration-500 select-none ${
        isCritical ? 'bg-rose-950 text-white' :
        isWarning ? 'bg-amber-950 text-white' :
        'bg-slate-950 text-emerald-400'
      }`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-white/20 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-white text-xs font-mono transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Exit to Command Center
          </button>
          <span className="font-mono text-xs uppercase tracking-widest text-white/80">
            SAHAYI WORKER SAFETY KIOSK • NODE #01
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              audioEnabled ? 'bg-emerald-500 text-slate-950' : 'bg-rose-900 text-white'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{audioEnabled ? 'SPEECH AUDIO ACTIVE' : 'SPEECH MUTED'}</span>
          </button>
          <div className="font-mono text-xs text-white/70">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Main Kiosk Hero Display */}
      <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
        {isCritical ? (
          <div className="max-w-4xl space-y-6 animate-pulse">
            <div className="inline-flex p-6 rounded-full bg-rose-600 text-white shadow-2xl">
              <ShieldAlert className="w-24 h-24" />
            </div>
            <div className="space-y-2">
              <span className="text-xl md:text-2xl font-mono uppercase tracking-widest text-rose-300 font-extrabold block">
                🚨 CRITICAL SAFETY ALERT 🚨
              </span>
              <h1 className="text-4xl md:text-7xl font-black tracking-tight text-white uppercase">
                {latestAlert?.event_type.replace(/_/g, ' ')}
              </h1>
              <p className="text-2xl md:text-3xl font-mono text-rose-200">
                ZONE: {latestAlert?.zone.toUpperCase()}
              </p>
            </div>

            <div className="p-6 bg-black/60 border-2 border-rose-500 rounded-2xl shadow-2xl max-w-2xl mx-auto">
              <span className="text-sm font-mono text-rose-300 uppercase block mb-1">
                REQUIRED IMMEDIATE WORKER ACTION:
              </span>
              <p className="text-2xl md:text-4xl font-extrabold text-white">
                {latestAlert?.recommended_action}
              </p>
            </div>
          </div>
        ) : isWarning ? (
          <div className="max-w-4xl space-y-6">
            <div className="inline-flex p-6 rounded-full bg-amber-500 text-slate-950 shadow-2xl">
              <AlertTriangle className="w-24 h-24" />
            </div>
            <div className="space-y-2">
              <span className="text-xl md:text-2xl font-mono uppercase tracking-widest text-amber-300 font-extrabold block">
                ⚠️ SAFETY WARNING
              </span>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white uppercase">
                {latestAlert?.event_type.replace(/_/g, ' ')}
              </h1>
              <p className="text-2xl font-mono text-amber-200">
                ZONE: {latestAlert?.zone.toUpperCase()}
              </p>
            </div>

            <div className="p-6 bg-black/50 border border-amber-400 rounded-2xl shadow-xl max-w-2xl mx-auto">
              <span className="text-sm font-mono text-amber-300 uppercase block mb-1">
                ACTION REQUIRED:
              </span>
              <p className="text-2xl md:text-3xl font-extrabold text-white">
                {latestAlert?.recommended_action}
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex p-8 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-400 shadow-2xl">
              <ShieldCheck className="w-28 h-28" />
            </div>
            <div className="space-y-2">
              <h1 className="text-5xl md:text-7xl font-black tracking-tight text-emerald-400 uppercase">
                SAFE
              </h1>
              <p className="text-xl md:text-2xl font-mono text-slate-300">
                Site Monitoring Active • No Critical Hazards Detected
              </p>
            </div>
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl text-xs font-mono text-slate-400 max-w-md mx-auto">
              PPE MANDATE ACTIVE: Hard Hats, High-Vis Vests, and Steel-Toe Boots Enforced Across All Operational Sectors.
            </div>
          </div>
        )}
      </div>

      {/* Footer Sub-Bar */}
      <div className="border-t border-white/20 pt-4 flex flex-col md:flex-row items-center justify-between text-xs font-mono text-white/70 gap-2">
        <span>SAHAYI Industrial Safety OS • Continuous Multi-Camera Protection</span>
        <span>AI-Assisted Safety Monitoring • Human-in-the-loop</span>
      </div>
    </div>
  );
};
