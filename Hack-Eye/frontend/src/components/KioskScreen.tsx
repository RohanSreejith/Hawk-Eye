import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Settings as SettingsIcon,
  BarChart3,
  Film,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Camera as CameraIcon,
  Clock,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { Incident, SupervisorSettings } from '../types';
import { SettingsModal } from './SettingsModal';
import { AnalyticsModal } from './AnalyticsModal';
import { VideoSourceModal } from './VideoSourceModal';
import { acknowledgeIncident, resolveIncident } from '../services/api';

interface KioskScreenProps {
  latestAlert: Incident | null;
  supervisorSettings: SupervisorSettings | null;
  onRefreshAlerts?: () => void;
}

export const KioskScreen: React.FC<KioskScreenProps> = ({
  latestAlert,
  supervisorSettings,
  onRefreshAlerts
}) => {
  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  // Audio Speech state
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [lastSpokenId, setLastSpokenId] = useState<string | null>(null);

  // Live Date / Time ticker
  const [currentTime, setCurrentTime] = useState(new Date());
  const [streamTimestamp, setStreamTimestamp] = useState(Date.now());
  const [activeVideoName, setActiveVideoName] = useState('loading_zone_truck.mp4');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Text-To-Speech alert when new incident occurs
  useEffect(() => {
    if (!latestAlert || !audioEnabled || latestAlert.status === 'resolved') return;
    if (latestAlert.event_id === lastSpokenId) return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const isVehicle = latestAlert.event_type.toLowerCase().includes('vehicle') ||
                        latestAlert.event_type.toLowerCase().includes('proximity');
      const actionText = latestAlert.recommended_action || (
        isVehicle ? 'Emergency stop! Halt forklift immediately!' : 'Please wear your mandatory safety helmet.'
      );
      const speech = new SpeechSynthesisUtterance(
        isVehicle
          ? `Emergency on site! Critical vehicle proximity hazard! ${actionText}`
          : `Attention on site! Safety warning! ${actionText}`
      );
      speech.rate = 1.0;
      speech.pitch = 1.0;
      speech.volume = 1.0;
      window.speechSynthesis.speak(speech);
      setLastSpokenId(latestAlert.event_id);
    }
  }, [latestAlert, audioEnabled, lastSpokenId]);

  const hasActiveAlert = latestAlert && latestAlert.status !== 'resolved';
  const isCritical = hasActiveAlert && latestAlert.severity === 'critical';
  const isVehicleAlert = !!(hasActiveAlert && (
    latestAlert.event_type.toLowerCase().includes('vehicle') ||
    latestAlert.event_type.toLowerCase().includes('proximity')
  ));

  const displayHeadline = isVehicleAlert
    ? 'VEHICLE PROXIMITY HAZARD'
    : (latestAlert?.event_type.replace(/_/g, ' ') || 'SAFETY WARNING');

  const handleAcknowledge = async () => {
    if (!latestAlert) return;
    await acknowledgeIncident(latestAlert.id);
    if (onRefreshAlerts) onRefreshAlerts();
  };

  const handleResolve = async () => {
    if (!latestAlert) return;
    await resolveIncident(latestAlert.id);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (onRefreshAlerts) onRefreshAlerts();
  };

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 flex flex-col select-none font-sans overflow-hidden">
      {/* 1. TOP HEADER (Matching the sample photo exactly) */}
      <header className="px-6 py-3 bg-[#0a0d13] border-b border-slate-800 flex items-center justify-between shrink-0">
        {/* Left Branding */}
        <div className="flex items-center gap-3.5">
          {/* Yellow Safety Hard Hat Icon */}
          <div className="text-amber-400 flex items-center justify-center">
            <svg className="w-9 h-9" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C7.03 3 3 7.03 3 12v3h18v-3c0-4.97-4.03-9-9-9zm-1 2.08c1.3-.12 2.7-.12 4 0V9h-4V5.08zM5 12c0-3.52 2.61-6.43 6-6.92V9H7v3H5zm14 0h-2V9h-4V5.08c3.39.49 6 3.4 6 6.92zm2 4H3v2c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-2z" />
            </svg>
          </div>

          <div className="flex items-baseline gap-4">
            <span className="text-2xl md:text-3xl font-black tracking-wider text-white">
              HACK-EYE
            </span>
            <div className="hidden sm:flex items-center gap-3 border-l border-slate-700/80 pl-4 py-0.5 text-xs font-mono text-slate-400">
              <span className="text-slate-200 font-semibold tracking-wide">Construction Safety Intelligence</span>
              <span>•</span>
              <span className="text-slate-400">Turning CCTV into an active safety system.</span>
            </div>
          </div>
        </div>

        {/* Right Status & Clock */}
        <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 -ml-4.5" />
            <span className="font-bold text-emerald-400 tracking-wider">SYSTEM ONLINE</span>
          </div>

          <span className="text-slate-600">|</span>
          <span className="hidden md:inline text-slate-300">{formattedDate}</span>
          <span className="text-slate-600 hidden md:inline">|</span>
          <span className="font-bold text-white tracking-widest">{formattedTime}</span>
          <span className="text-slate-600 hidden lg:inline">|</span>
          <span className="hidden lg:inline text-slate-400 font-bold tracking-widest text-[11px] uppercase">
            BUILD SAFER TOGETHER
          </span>

          {/* Audio toggle button */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`ml-2 p-1.5 rounded-lg border transition-colors ${
              audioEnabled
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/20'
            }`}
            title={audioEnabled ? 'Speech Alarm Enabled' : 'Speech Alarm Muted'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 2. MAIN KIOSK BODY (Two Columns: Video Left, Alert Right) */}
      <main className="flex-1 p-5 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        {/* LEFT COLUMN: Live Camera Feed (approx 58% width on large screens) */}
        <div className="lg:col-span-7 flex flex-col bg-[#0b0e14] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
          {/* Camera Feed Header */}
          <div className="px-5 py-3.5 bg-[#0e121a] border-b border-slate-800 flex items-center justify-between z-10">
            <div className="flex items-center gap-2.5">
              <CameraIcon className="w-4 h-4 text-slate-400" />
              <span className="font-bold text-sm tracking-wide text-white uppercase">
                CAM 04 - Loading Zone
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-600 text-rose-400 text-xs font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                LIVE
              </span>

              <button
                onClick={() => setIsVideoModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 border border-slate-700 transition-colors"
                title="Change or upload demo video"
              >
                <Film className="w-3.5 h-3.5 text-sky-400" />
                <span>Video Source</span>
              </button>
            </div>
          </div>

          {/* Video Feed Canvas / MJPEG Stream */}
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden min-h-[380px]">
            <img
              key={streamTimestamp}
              src={`/api/cameras/CAM_04/stream?t=${streamTimestamp}`}
              alt="CAM 04 Live Safety Stream"
              className="w-full h-full object-contain"
              onError={(e) => {
                // Fallback reconnect
                setTimeout(() => setStreamTimestamp(Date.now()), 2500);
              }}
            />

            {/* In-feed subtle overlay badge */}
            <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-sm border border-white/10 text-[11px] font-mono text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>YOLO Object Detection & OSHA PPE Engine Active</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: The Alert Card (Matching sample photo exactly) */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          {hasActiveAlert ? (
            /* ACTIVE ALERT STATE */
            <div className="flex-1 bg-[#130708] border-2 border-rose-600 rounded-2xl p-6 md:p-8 flex flex-col justify-between shadow-2xl shadow-rose-950/40 relative overflow-hidden animate-pulse">
              {/* Top Warning Banner */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-rose-500">
                  <div className="p-2 rounded-xl bg-rose-500/20">
                    <ShieldAlert className="w-10 h-10 md:w-12 md:h-12" />
                  </div>
                  <div>
                    <span className="text-2xl md:text-3xl font-black tracking-wider uppercase block text-rose-500">
                      SAFETY WARNING
                    </span>
                    <span className="text-xs font-mono uppercase text-rose-400 tracking-widest">
                      CRITICAL COMPLIANCE THRESHOLD EXCEEDED
                    </span>
                  </div>
                </div>

                {/* Big Headline */}
                <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white leading-tight">
                  {displayHeadline}
                </h1>

                {/* Metadata Row */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-rose-900/60 text-xs font-mono">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">LOCATION</span>
                      <span className="font-bold text-white truncate block">{latestAlert.zone || 'Loading Zone'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CameraIcon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">CAMERA</span>
                      <span className="font-bold text-white block">{latestAlert.camera_id || 'CAM 04'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">TIME</span>
                      <span className="font-bold text-white block">{formattedTime}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Callout Graphic */}
              <div className="my-6 p-5 rounded-2xl bg-black/60 border border-rose-600/60 flex items-center gap-6">
                {isVehicleAlert ? (
                  /* Vehicle / Forklift Danger Graphic */
                  <div className="shrink-0 w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-rose-600 relative flex items-center justify-center p-3 shadow-inner bg-rose-950/40 animate-pulse">
                    <svg className="w-14 h-14 md:w-16 md:h-16 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 17h4V5H2v12h3m9 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0zm-11 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0zm11-12h4l3 5v7h-7V5z"/>
                      <circle cx="12" cy="11" r="1" fill="currentColor"/>
                    </svg>
                  </div>
                ) : (
                  /* Prohibited Hard Hat Graphic (Red Ring with diagonal slash) */
                  <div className="shrink-0 w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-rose-600 relative flex items-center justify-center p-3 shadow-inner bg-rose-950/20">
                    <div className="absolute w-[90%] h-1.5 bg-rose-600 rotate-45 rounded-full z-10" />
                    <svg className="w-14 h-14 md:w-16 md:h-16 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 3C7.03 3 3 7.03 3 12v3h18v-3c0-4.97-4.03-9-9-9zm-1 2.08c1.3-.12 2.7-.12 4 0V9h-4V5.08zM5 12c0-3.52 2.61-6.43 6-6.92V9H7v3H5zm14 0h-2V9h-4V5.08c3.39.49 6 3.4 6 6.92zm2 4H3v2c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-2z" />
                    </svg>
                  </div>
                )}

                <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase leading-tight">
                    {latestAlert.recommended_action || (isVehicleAlert ? 'HALT FORKLIFT IMMEDIATELY' : 'PLEASE WEAR YOUR HELMET')}
                  </h2>
                  <p className="text-xs md:text-sm font-bold text-slate-300 tracking-wider uppercase">
                    {isVehicleAlert ? 'HIGH RISK IMPACT ZONE • CLEAR PATH IMMEDIATELY' : 'SAFETY KEEPS US WORKING TOGETHER'}
                  </p>
                </div>
              </div>

              {/* Supervisor Notification Badge & Buttons */}
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-rose-500/30 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-slate-300">
                      Alert sent to Supervisor:{' '}
                      <strong className="text-white">
                        {supervisorSettings?.supervisor_name || 'Vikram Sharma'}
                      </strong>{' '}
                      ({supervisorSettings?.phone_number || '+91 98765 43210'})
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold uppercase">
                    SMS DISPATCHED
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAcknowledge}
                    className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider transition-colors shadow-lg"
                  >
                    Acknowledge Alert
                  </button>
                  <button
                    onClick={handleResolve}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-wider transition-colors shadow-lg"
                  >
                    Resolve & Clear
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ALL CLEAR / SAFE STATE */
            <div className="flex-1 bg-[#0b1411] border-2 border-emerald-500/40 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-2xl space-y-6">
              <div className="p-6 rounded-full bg-emerald-500/10 border-2 border-emerald-500/50 text-emerald-400 shadow-2xl">
                <ShieldCheck className="w-24 h-24" />
              </div>

              <div className="space-y-2 max-w-md">
                <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold block">
                  ALL OPERATIONAL PROTOCOLS MET
                </span>
                <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white">
                  SAFE TO WORK
                </h1>
                <p className="text-slate-300 text-sm font-mono">
                  Loading Zone CCTV actively analyzed by YOLO Computer Vision. No PPE omissions or vehicle hazards detected.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-400 max-w-sm">
                Supervisor Alerts configured for: <span className="text-white font-bold">{supervisorSettings?.supervisor_name || 'Vikram Sharma'}</span> ({supervisorSettings?.phone_number || '+91 98765 43210'})
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 3. BOTTOM FOOTER BAR (Matching sample photo icons + simple settings buttons) */}
      <footer className="px-6 py-3 bg-[#0a0d13] border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
        {/* 4 Safety Icons matching the sample image */}
        <div className="flex flex-wrap items-center gap-6 text-xs font-bold font-mono">
          {/* 1. WEAR PPE */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full border-2 border-emerald-400 flex items-center justify-center p-1.5 text-emerald-400">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3C7.03 3 3 7.03 3 12v3h18v-3c0-4.97-4.03-9-9-9zm-1 2.08c1.3-.12 2.7-.12 4 0V9h-4V5.08zM5 12c0-3.52 2.61-6.43 6-6.92V9H7v3H5zm14 0h-2V9h-4V5.08c3.39.49 6 3.4 6 6.92zm2 4H3v2c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-2z" />
              </svg>
            </div>
            <span className="text-white uppercase tracking-wider text-[11px] leading-tight">
              WEAR<br />PPE
            </span>
          </div>

          {/* 2. STAY ALERT TO VEHICLES */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full border-2 border-emerald-400 flex items-center justify-center p-1.5 text-emerald-400">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            </div>
            <span className="text-white uppercase tracking-wider text-[11px] leading-tight">
              STAY ALERT<br />TO VEHICLES
            </span>
          </div>

          {/* 3. DO NOT ENTER RESTRICTED ZONES */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full border-2 border-rose-500 flex items-center justify-center p-1.5 text-rose-500 relative">
              <div className="absolute w-[85%] h-0.5 bg-rose-500 rotate-45" />
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="4" r="2" />
                <path d="M15.89 8.11C15.5 7.72 14.83 7 13.53 7h-2.54c-.75 0-1.42.41-1.75 1.07l-2.07 4.14c-.31.62-.06 1.38.56 1.69.62.31 1.38.06 1.69-.56l1.58-3.17V19c0 .55.45 1 1 1s1-.45 1-1v-5h1v5c0 .55.45 1 1 1s1-.45 1-1V9.41l1.83 1.83c.39.39 1.02.39 1.41 0 .4-.39.4-1.02.01-1.42z" />
              </svg>
            </div>
            <span className="text-white uppercase tracking-wider text-[11px] leading-tight">
              DO NOT ENTER<br />RESTRICTED ZONES
            </span>
          </div>

          {/* 4. WORK SAFELY AT HEIGHTS */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full border-2 border-rose-500 flex items-center justify-center p-1.5 text-rose-500">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-4.5-6h9L12 17zm0-8c-.83 0-1.5-.67-1.5-1.5S11.17 6 12 6s1.5.67 1.5 1.5S12.83 9 12 9z" />
              </svg>
            </div>
            <span className="text-white uppercase tracking-wider text-[11px] leading-tight">
              WORK SAFELY<br />AT HEIGHTS
            </span>
          </div>
        </div>

        {/* Action Buttons & Slogan on Right */}
        <div className="flex items-center gap-3">
          {/* Small button for Settings */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            title="Configure supervisor name, phone number, and SMS dispatch"
          >
            <SettingsIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>Settings</span>
          </button>

          {/* Small button for Analytics */}
          <button
            onClick={() => setIsAnalyticsOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            title="View safety analytics and warning logs"
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Analytics</span>
          </button>

          {/* Divider */}
          <div className="hidden sm:block h-6 w-px bg-slate-800" />

          {/* Slogan from sample image */}
          <div className="hidden lg:block text-right font-mono text-[11px] text-slate-400 leading-tight">
            <span className="block text-slate-300 font-bold">SAFE PEOPLE</span>
            <span>STRONGER TOMORROW</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <AnalyticsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
      />

      <VideoSourceModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        onVideoSelected={(filename) => {
          setActiveVideoName(filename);
          setStreamTimestamp(Date.now());
        }}
      />
    </div>
  );
};
