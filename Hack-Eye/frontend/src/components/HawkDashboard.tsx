import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Radio,
  Video,
  Database,
  Truck,
  User,
  AlertTriangle,
  Play,
  RotateCcw,
  Sliders,
  CheckCircle2,
  Maximize2,
  Terminal,
  Activity,
  Layers,
  ArrowRight,
  Eye,
  FileText,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';

interface HawkState {
  system_name: string;
  subtitle: string;
  system_status: string;
  active_events: any[];
  known_entities: any[];
  warehouse_zones: any;
  risk_assessment: any;
  event_stream: any[];
  safety_kiosk: any;
  cameras: any;
  camera_a_video: string;
  camera_b_video: string;
}

export function HawkDashboard() {
  const [hawkState, setHawkState] = useState<HawkState | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [currentDate, setCurrentDate] = useState('Jan 25, 2025');
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [availableVideos, setAvailableVideos] = useState<string[]>([]);
  const [selectedCamA, setSelectedCamA] = useState('');
  const [selectedCamB, setSelectedCamB] = useState('');
  const [scenarioStep, setScenarioStep] = useState(1);
  const [analysisModalIncident, setAnalysisModalIncident] = useState<any | null>(null);
  const [isPlayingScenario, setIsPlayingScenario] = useState(false);
  // Increment to force MJPEG stream reload when scenario changes
  const [streamVersion, setStreamVersion] = useState(0);

  // Audio Siren & Voice Alerts State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastSpokenAlertRef = useRef<string>('');
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Initialize or resume Web Audio Context on user gesture
  const getAudioContext = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch (e) {
      return null;
    }
  };

  // Play realistic industrial warehouse siren & warning chimes
  const playSiren = (severity: 'critical' | 'warning' | 'fire') => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (severity === 'critical' || severity === 'fire') {
        // High-urgency oscillating warble alarm siren (800Hz <-> 1180Hz)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.linearRampToValueAtTime(1180, now + 0.22);
        osc.frequency.linearRampToValueAtTime(800, now + 0.44);
        osc.frequency.linearRampToValueAtTime(1180, now + 0.66);
        osc.frequency.linearRampToValueAtTime(800, now + 0.88);
        osc.frequency.linearRampToValueAtTime(1180, now + 1.10);
        osc.frequency.linearRampToValueAtTime(800, now + 1.30);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.28, now + 0.05);
        gain.gain.setValueAtTime(0.28, now + 1.25);
        gain.gain.linearRampToValueAtTime(0.01, now + 1.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.35);
      } else {
        // Warning dual-tone horn chime (660Hz -> 880Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.setValueAtTime(880, now + 0.25);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
        gain.gain.setValueAtTime(0.25, now + 0.50);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.65);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.65);
      }
    } catch (e) {
      console.warn('[HAWK SIREN] Audio playback failed:', e);
    }
  };

  // Speak explicit hazard type and zone location using SpeechSynthesis
  const speakAnnouncement = (text: string) => {
    if (!soundEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[HAWK SPEECH] Speech synthesis failed:', e);
    }
  };

  // Dispatches siren followed by clear voice announcement
  const dispatchAlertAudio = (title: string, zone: string, detail: string, severity: 'critical' | 'warning' | 'fire') => {
    playSiren(severity);
    setTimeout(() => {
      const phrase = `${title}. Location: ${zone}. ${detail}`;
      speakAnnouncement(phrase);
    }, severity === 'warning' ? 650 : 950);
  };

  const toggleSound = () => {
    getAudioContext();
    setSoundEnabled(prev => {
      const next = !prev;
      if (!next && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  // Connect directly to backend port 8001 to eliminate Vite proxy buffering and connection stalling
  const getCameraStreamUrl = (camera: 'a' | 'b') => {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:8001/api/hawk/camera/${camera}/stream?v=${streamVersion}`;
  };

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch HAWK state
  const fetchState = async () => {
    try {
      const res = await fetch('/api/hawk/state');
      if (res.ok) {
        const data = await res.json();
        setHawkState(data);
      }
    } catch (err) {
      console.warn('Failed to fetch HAWK state:', err);
    }
  };

  // Fetch available videos
  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/hawk/videos');
      if (res.ok) {
        const data = await res.json();
        setAvailableVideos(data.videos || []);
        if (data.current_camera_a) setSelectedCamA(data.current_camera_a);
        if (data.current_camera_b) setSelectedCamB(data.current_camera_b);
      }
    } catch (err) {
      console.warn('Failed to fetch videos:', err);
    }
  };

  useEffect(() => {
    fetchState();
    fetchVideos();

    // Setup WebSocket for live HAWK updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'hawk_state_updated') {
          setHawkState(data.hawk_state);
        }
      } catch (e) {}
    };

    const interval = setInterval(fetchState, 2500);

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  // Reactive audio trigger if kiosk alert triggers automatically or via WebSocket
  useEffect(() => {
    const kiosk = hawkState?.safety_kiosk;
    if (kiosk?.active && kiosk?.title && kiosk.title !== lastSpokenAlertRef.current) {
      lastSpokenAlertRef.current = kiosk.title;
      const sev = kiosk.severity === 'critical' ? (scenarioStep === 7 ? 'fire' : 'critical') : 'warning';
      dispatchAlertAudio(kiosk.title, kiosk.zone || 'Zone B', kiosk.message || '', sev);
    } else if (!kiosk?.active && lastSpokenAlertRef.current) {
      lastSpokenAlertRef.current = '';
    }
  }, [hawkState?.safety_kiosk?.title, hawkState?.safety_kiosk?.active]);

  const handleTriggerStep = async (step: number) => {
    getAudioContext();
    setScenarioStep(step);

    if (step === 1) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      lastSpokenAlertRef.current = '';
    } else if (step === 4) {
      lastSpokenAlertRef.current = 'VEHICLE APPROACHING';
      dispatchAlertAudio("Warning: Vehicle approaching!", "Zone B Loading Area", "Forklift V01 inbound. Maintain safe distance.", "warning");
    } else if (step === 5) {
      lastSpokenAlertRef.current = 'IMMINENT COLLISION HAZARD';
      dispatchAlertAudio("Critical collision hazard!", "Zone B Loading Area", "Forklift V01 impact breach. Emergency brake engaged.", "critical");
    } else if (step === 7) {
      lastSpokenAlertRef.current = 'FIRE EMERGENCY - EVACUATE';
      dispatchAlertAudio("Fire emergency! Evacuate immediately!", "Zone B Storage Bay", "Thermal combustion hazard and active smoke spread.", "fire");
    }

    try {
      const res = await fetch('/api/hawk/trigger-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.hawk_state) {
          setHawkState(data.hawk_state);
        }
      }
    } catch (e) {
      console.warn('Error triggering scenario:', e);
    }
  };

  const handleApplyVideos = async () => {
    try {
      await fetch('/api/hawk/select-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camera_a: selectedCamA,
          camera_b: selectedCamB,
        }),
      });
      setIsVideoModalOpen(false);
      fetchState();
    } catch (e) {
      console.warn('Failed to update camera videos:', e);
    }
  };

  const handleOpenAnalysis = async (incidentId: number = 1) => {
    try {
      const res = await fetch(`/api/hawk/incidents/${incidentId}/analysis`);
      if (res.ok) {
        const data = await res.json();
        setAnalysisModalIncident(data);
      }
    } catch (e) {
      console.warn('Failed to load incident analysis:', e);
    }
  };

  const camA = hawkState?.cameras?.camera_a;
  const camB = hawkState?.cameras?.camera_b;
  const risk = hawkState?.risk_assessment;
  const kiosk = hawkState?.safety_kiosk;

  return (
    <div style={styles.dashboardContainer}>
      {/* Top Main Navigation Bar */}
      <header style={styles.topHeader}>
        <div style={styles.headerLeft}>
          {/* Falcon / Hawk Brand Emblem */}
          <div style={styles.hawkLogoBadge}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L15 8L21 9L16.5 14L18 20L12 17L6 20L7.5 14L3 9L9 8L12 2Z" fill="#00f2fe" stroke="#38bdf8" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div style={styles.brandTitleRow}>
              <span style={styles.brandTitleMain}>HAWK</span>
              <span style={styles.brandTitleSep}>–</span>
              <span style={styles.brandTitleSub}>Harm Anticipation for Workplace Safety</span>
            </div>
          </div>
          <div style={styles.systemBadgeTag}>
            <span>Multi-Agent AI Safety Network</span>
          </div>
        </div>

        <div style={styles.headerRight}>
          {/* Quick Scenario Buttons */}
          <div style={styles.scenarioBar}>
            <button
              style={{
                ...styles.stepBtn,
                backgroundColor: scenarioStep === 1 ? '#0284c7' : '#1e293b',
              }}
              onClick={() => handleTriggerStep(1)}
              title="Baseline: Safe"
            >
              Baseline
            </button>
            <button
              style={{
                ...styles.stepBtn,
                backgroundColor: scenarioStep === 4 ? '#d97706' : '#1e293b',
              }}
              onClick={() => handleTriggerStep(4)}
              title="Step 4: Vehicle Inbound & Anticipated Kiosk Warning"
            >
              Anticipate (Inbound)
            </button>
            <button
              style={{
                ...styles.stepBtn,
                backgroundColor: scenarioStep === 5 ? '#dc2626' : '#1e293b',
              }}
              onClick={() => handleTriggerStep(5)}
              title="Step 5: Critical Proximity Conflict"
            >
              Conflict
            </button>
            <button
              style={{
                ...styles.stepBtn,
                backgroundColor: scenarioStep === 7 ? '#b91c1c' : '#1e293b',
              }}
              onClick={() => handleTriggerStep(7)}
              title="Step 7: Active Fire Hazard & Zone Evacuation"
            >
              🔥 Fire Alert
            </button>
          </div>

          {/* Footage Select Button */}
          <button style={styles.actionIconButton} onClick={() => setIsVideoModalOpen(true)} title="Assign Camera Footage">
            <Video size={16} color="#94a3b8" />
            <span style={styles.actionBtnLabel}>Footage</span>
          </button>

          {/* Force Reload Feeds Button */}
          <button
            style={styles.actionIconButton}
            onClick={() => setStreamVersion(v => v + 1)}
            title="Force Reconnect Live Camera Feeds"
          >
            <RotateCcw size={15} color="#00f2fe" />
            <span style={{ ...styles.actionBtnLabel, color: '#00f2fe' }}>Reload Feeds</span>
          </button>

          {/* Incident Analysis Button */}
          <button style={styles.actionIconButton} onClick={() => handleOpenAnalysis(1)} title="View LLM Forensic Report">
            <FileText size={16} color="#00f2fe" />
            <span style={{ ...styles.actionBtnLabel, color: '#00f2fe' }}>LLM Analysis</span>
          </button>

          {/* Sound / Siren Alert Toggle */}
          <button
            style={{
              ...styles.actionIconButton,
              borderColor: soundEnabled ? 'rgba(0, 242, 254, 0.4)' : '#1e293b',
              backgroundColor: soundEnabled ? 'rgba(0, 242, 254, 0.12)' : '#131d33',
            }}
            onClick={toggleSound}
            title={soundEnabled ? 'Siren & Voice Alerts: ACTIVE (Click to Mute)' : 'Siren & Voice Alerts: MUTED (Click to Enable)'}
          >
            {soundEnabled ? <Volume2 size={16} color="#00f2fe" /> : <VolumeX size={16} color="#64748b" />}
            <span style={{ ...styles.actionBtnLabel, color: soundEnabled ? '#00f2fe' : '#94a3b8' }}>
              {soundEnabled ? 'Siren ON' : 'Muted'}
            </span>
          </button>

          {/* Online Pill */}
          <div style={styles.onlinePill}>
            <div style={styles.onlineDot} />
            <span style={styles.onlineText}>System Online</span>
          </div>

          {/* Time & Date Display */}
          <div style={styles.clockWidget}>
            <div style={styles.clockTime}>{currentTime}</div>
            <div style={styles.clockDate}>{currentDate}</div>
          </div>
        </div>
      </header>

      {/* Main 2-Row Workspace */}
      <main style={styles.mainGrid}>
        {/* ================================================================= */}
        {/* TOP ROW: 3 Columns                                                */}
        {/* Col 1: Camera A | Col 2: Shared State & Map | Col 3: Camera B     */}
        {/* ================================================================= */}
        <div style={styles.topRow}>
          {/* PANE 1: Camera A – Entrance (Agent A) */}
          <section style={styles.cardPanel}>
            <div style={styles.panelHeader}>
              <span style={styles.panelTitle}>{camA?.name || 'Camera A – Entrance (Agent A)'}</span>
              <div style={styles.liveTag}>
                <div style={styles.liveDot} />
                <span>LIVE</span>
              </div>
            </div>

            <div style={styles.cctvContainer}>
              {/* Live MJPEG Stream — YOLO+PPE bounding boxes drawn by OpenCV in real-time */}
              <img
                key={`cam_a_${streamVersion}`}
                src={getCameraStreamUrl('a')}
                alt="Camera A Live Feed"
                style={{ ...styles.cctvVideo, display: 'block', objectFit: 'cover' }}
              />

              {/* Lower Stream Overlay */}
              <div style={styles.cctvBottomOverlay}>
                <span style={styles.cctvOverlayText}>{camA?.caption || 'Zone A – Monitoring'}</span>
                <span style={styles.cctvOverlayTime}>{camA?.timestamp || currentTime}</span>
              </div>
            </div>
          </section>

          {/* PANE 2: Shared State (HAWK) */}
          <section style={styles.cardPanel}>
            <div style={styles.panelHeader}>
              <div style={styles.panelHeaderLeft}>
                <Database size={16} color="#00f2fe" style={{ marginRight: 6 }} />
                <span style={styles.panelTitle}>Shared State (HAWK)</span>
              </div>
            </div>

            <div style={styles.sharedStateContent}>
              {/* Active Events */}
              <div style={styles.subSectionHeader}>Active Events</div>
              {hawkState?.active_events && hawkState.active_events.length > 0 ? (
                hawkState.active_events.map((evt: any) => (
                  <div key={evt.id} style={styles.activeEventCard}>
                    <div style={{
                      ...styles.activeEventIconBox,
                      backgroundColor: evt.event_type === 'PPE_VIOLATION' ? '#ef4444' : '#f59e0b'
                    }}>
                      {evt.event_type === 'PPE_VIOLATION' ? (
                        <ShieldAlert size={22} color="#ffffff" />
                      ) : (
                        <Truck size={22} color="#090d16" />
                      )}
                    </div>
                    <div style={styles.activeEventInfo}>
                      <div style={{
                        ...styles.activeEventType,
                        color: evt.event_type === 'PPE_VIOLATION' ? '#ef4444' : '#f59e0b'
                      }}>
                        {evt.title || evt.event_type}
                      </div>
                      {evt.worker_id && <div style={styles.activeEventDetail}>Worker: {evt.worker_id}</div>}
                      {evt.vehicle_id && <div style={styles.activeEventDetail}>Vehicle ID: {evt.vehicle_id}</div>}
                      {evt.from_camera && <div style={styles.activeEventDetail}>From: {evt.from_camera}</div>}
                      {(evt.target_zone || evt.zone) && <div style={styles.activeEventDetail}>Zone: {evt.target_zone || evt.zone}</div>}
                      {evt.detail && <div style={styles.activeEventDetail}>Detail: {evt.detail}</div>}
                      <div style={styles.activeEventDetail}>Time: {evt.time}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontSize: '12px' }}>
                  ✓ No active events – All zones clear
                </div>
              )}

              {/* Known Entities */}
              <div style={{ ...styles.subSectionHeader, marginTop: 14 }}>Known Entities</div>
              <div style={styles.entitiesList}>
                {hawkState?.known_entities?.map((entity: any) => (
                  <div key={entity.id} style={styles.entityRow}>
                    <div style={styles.entityNameBox}>
                      <div style={{ ...styles.entityIconSquare, backgroundColor: `${entity.color}22` }}>
                        {entity.type === 'vehicle' ? <Truck size={14} color={entity.color} /> : <User size={14} color={entity.color} />}
                      </div>
                      <span style={styles.entityCode}>{entity.id}</span>
                    </div>
                    <span style={{ ...styles.entityStatus, color: entity.color }}>{entity.status}</span>
                  </div>
                ))}
              </div>

              {/* Warehouse Map (Zones) with live transit progress */}
              <div style={{ ...styles.subSectionHeader, marginTop: 14 }}>Warehouse Map (Zones)</div>
              <div style={styles.warehouseMapContainer}>
                {/* Zone A */}
                <div style={{
                  ...styles.mapZoneBoxA,
                  borderColor: hawkState?.warehouse_zones?.zone_a?.status === 'active_traffic' ? '#f97316' : hawkState?.warehouse_zones?.zone_a?.status === 'clear' ? '#10b981' : '#1e293b',
                }}>
                  <span style={styles.mapZoneTitle}>Zone A</span>
                  <span style={styles.mapZoneSub}>Entrance</span>
                </div>

                {/* Transit Corridor with dynamic vehicle marker */}
                <div style={styles.mapTransitArrow}>
                  <div style={styles.transitLine} />
                  {(hawkState?.warehouse_zones?.transit_progress ?? 0) > 0 && (
                    <div style={{
                      ...styles.transitVehicleMarker,
                      left: `${(hawkState?.warehouse_zones?.transit_progress ?? 0) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      position: 'absolute',
                      top: '50%',
                    }}>
                      <Truck size={16} color="#f59e0b" />
                    </div>
                  )}
                  <ArrowRight size={14} color="#64748b" style={styles.transitArrowHead} />
                </div>

                {/* Zone B */}
                <div style={{
                  ...styles.mapZoneBoxB,
                  borderColor: hawkState?.warehouse_zones?.zone_b?.status === 'critical' ? '#ef4444' : hawkState?.warehouse_zones?.zone_b?.status === 'alert_armed' ? '#f59e0b' : hawkState?.warehouse_zones?.zone_b?.status === 'clear' ? '#10b981' : '#1e293b',
                  boxShadow: hawkState?.warehouse_zones?.zone_b?.status === 'critical' ? '0 0 12px rgba(239,68,68,0.4)' : 'none',
                }}>
                  {kiosk?.active && <div style={styles.hazardBeaconDot} />}
                  <span style={styles.mapZoneTitleB}>Zone B</span>
                  <span style={styles.mapZoneSubB}>Loading Area</span>
                </div>
              </div>
            </div>
          </section>

          {/* PANE 3: Camera B – Loading Area (Agent B) */}
          <section style={styles.cardPanel}>
            <div style={styles.panelHeader}>
              <span style={styles.panelTitle}>{camB?.name || 'Camera B – Loading Area (Agent B)'}</span>
              <div style={styles.liveTag}>
                <div style={styles.liveDot} />
                <span>LIVE</span>
              </div>
            </div>

            <div style={styles.cctvContainer}>
              {/* Live MJPEG Stream — YOLO+PPE bounding boxes drawn by OpenCV in real-time */}
              <img
                key={`cam_b_${streamVersion}`}
                src={getCameraStreamUrl('b')}
                alt="Camera B Live Feed"
                style={{ ...styles.cctvVideo, display: 'block', objectFit: 'cover' }}
              />

              {/* Lower Stream Overlay */}
              <div style={styles.cctvBottomOverlay}>
                <div style={styles.cctvDualOverlay}>
                  <span style={{ color: risk?.risk_level === 'critical' ? '#ef4444' : '#f97316', fontWeight: '700', fontSize: '13px' }}>
                    {camB?.caption || 'Zone B – Monitoring'}
                  </span>
                  {camB?.subcaption && (
                    <span style={{ color: '#f59e0b', fontSize: '12px', marginTop: '2px' }}>
                      {camB.subcaption}
                    </span>
                  )}
                </div>
                <span style={styles.cctvOverlayTime}>{camB?.timestamp || currentTime}</span>
              </div>
            </div>
          </section>
        </div>

        {/* ================================================================= */}
        {/* BOTTOM ROW: 3 Columns                                             */}
        {/* Col 1: Event Stream | Col 2: Risk Assessment | Col 3: Alert Box   */}
        {/* ================================================================= */}
        <div style={styles.bottomRow}>
          {/* PANE 4: Event Stream */}
          <section style={styles.cardPanel}>
            <div style={styles.panelHeader}>
              <div style={styles.panelHeaderLeft}>
                <Terminal size={15} color="#00f2fe" style={{ marginRight: 6 }} />
                <span style={styles.panelTitle}>Event Stream</span>
              </div>
            </div>

            <div style={styles.terminalContainer}>
              {hawkState?.event_stream?.map((ev, idx) => (
                <div key={idx} style={styles.logLine}>
                  <span style={styles.logTime}>{ev.time}</span>
                  <span style={{ ...styles.logAgent, color: ev.color || '#00f2fe' }}>{ev.agent}</span>
                  <span style={styles.logMessage}>{ev.message}</span>
                </div>
              ))}
            </div>
          </section>

          {/* PANE 5: Risk Assessment */}
          <section style={styles.cardPanel}>
            <div style={styles.panelHeader}>
              <div style={styles.panelHeaderLeft}>
                <Activity size={15} color="#00f2fe" style={{ marginRight: 6 }} />
                <span style={styles.panelTitle}>Risk Assessment</span>
              </div>
            </div>

            <div style={styles.riskTable}>
              <div style={styles.riskRow}>
                <div style={styles.riskLabelGroup}>
                  <Truck size={15} color="#94a3b8" style={{ marginRight: 8 }} />
                  <span style={styles.riskRowLabel}>Vehicle–Worker Proximity</span>
                </div>
                <span style={{ ...styles.riskRowVal, color: '#f59e0b' }}>
                  {risk?.vehicle_worker_proximity || 'Monitoring'}
                </span>
              </div>

              <div style={styles.riskRow}>
                <div style={styles.riskLabelGroup}>
                  <User size={15} color="#94a3b8" style={{ marginRight: 8 }} />
                  <span style={styles.riskRowLabel}>Trajectory Analysis</span>
                </div>
                <span style={{ ...styles.riskRowVal, color: '#94a3b8' }}>
                  {risk?.trajectory_analysis || 'Not yet visible'}
                </span>
              </div>

              <div style={styles.riskRow}>
                <div style={styles.riskLabelGroup}>
                  <Layers size={15} color="#94a3b8" style={{ marginRight: 8 }} />
                  <span style={styles.riskRowLabel}>Zone Conflict</span>
                </div>
                <span style={{ ...styles.riskRowVal, color: '#f59e0b' }}>
                  {risk?.zone_conflict || 'Possible'}
                </span>
              </div>

              {/* Highlighted Overall Risk Banner */}
              <div style={{
                ...styles.overallRiskRow,
                backgroundColor: risk?.risk_level === 'critical' ? 'rgba(239,68,68,0.15)' :
                  risk?.risk_level === 'medium' ? 'rgba(245,158,11,0.12)' :
                  risk?.risk_level === 'safe' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                borderColor: risk?.risk_level === 'critical' ? 'rgba(239,68,68,0.4)' :
                  risk?.risk_level === 'medium' ? 'rgba(245,158,11,0.3)' :
                  risk?.risk_level === 'safe' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)',
              }}>
                <div style={styles.overallRiskLeft}>
                  <AlertTriangle size={18}
                    color={risk?.risk_level === 'critical' ? '#ef4444' : risk?.risk_level === 'safe' ? '#10b981' : '#f59e0b'}
                    style={{ marginRight: 8 }}
                  />
                  <span style={styles.overallRiskTitle}>Overall Risk</span>
                </div>
                <span style={{
                  ...styles.overallRiskBadge,
                  backgroundColor: risk?.risk_level === 'critical' ? '#ef4444' : risk?.risk_level === 'safe' ? '#10b981' : '#d97706',
                }}>{risk?.overall_risk || 'MEDIUM'}</span>
              </div>
            </div>
          </section>

          {/* PANE 6: Active Safety Alert Box */}
          <section style={styles.cardPanel}>
            <div style={styles.panelHeader}>
              <div style={styles.panelHeaderLeft}>
                <AlertTriangle size={15} color={kiosk?.active ? '#ef4444' : '#10b981'} style={{ marginRight: 6 }} />
                <span style={styles.panelTitle}>Active Safety Alert</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {kiosk?.active && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const sev = kiosk.severity === 'critical' ? (scenarioStep === 7 ? 'fire' : 'critical') : 'warning';
                      dispatchAlertAudio(kiosk.title, kiosk.zone || 'Zone B', kiosk.message || '', sev);
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      border: '1px solid rgba(255,255,255,0.25)',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Replay Alert Siren & Spoken Announcement"
                  >
                    <Volume2 size={11} color="#ffffff" />
                    <span>REPLAY</span>
                  </button>
                )}
                {kiosk?.active ? (
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#ef4444', letterSpacing: '1px', animation: 'pulse 1s infinite' }}>● HAZARD ACTIVE</div>
                ) : (
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#10b981', letterSpacing: '1px' }}>● ALL CLEAR</div>
                )}
              </div>
            </div>

            <div style={styles.kioskContainer}>
              {kiosk?.active ? (
                /* ACTIVE: High-Impact Hazard Alert Card */
                <div style={{
                  ...styles.hazardWarningCard,
                  background: kiosk.severity === 'critical'
                    ? 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)'
                    : 'linear-gradient(135deg, #78350f 0%, #92400e 100%)',
                  boxShadow: kiosk.severity === 'critical'
                    ? '0 0 30px rgba(239,68,68,0.4), inset 0 0 20px rgba(0,0,0,0.3)'
                    : '0 0 20px rgba(245,158,11,0.3), inset 0 0 20px rgba(0,0,0,0.3)',
                }}>
                  <div style={styles.hazardCardContent}>
                    <AlertTriangle size={48} color="#ffffff" style={{ marginBottom: 8, opacity: 0.95 }} />
                    <div style={{ ...styles.hazardMainTitle, color: '#ffffff' }}>{kiosk.title}</div>
                    <div style={{ ...styles.hazardSubtitle, color: 'rgba(255,255,255,0.85)' }}>{kiosk.message}</div>
                    <div style={{ ...styles.hazardActionNotice, color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.3)' }}>
                      {kiosk.subtext}
                    </div>
                  </div>
                  <div style={styles.hazardStripesBar} />
                </div>
              ) : (
                /* INACTIVE: All Clear state */
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: '12px',
                  padding: '20px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16,185,129,0.07)',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}>
                  <CheckCircle2 size={52} color="#10b981" />
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#10b981', letterSpacing: '1px' }}>ALL CLEAR</div>
                  <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center' }}>Zone B monitoring active<br/>No hazards detected</div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer Tagline */}
      <footer style={styles.footerBar}>
        <span style={styles.footerTagline}>Different Cameras. Shared Understanding. Safer Workplaces.</span>
      </footer>

      {/* ============================================================= */}
      {/* VIDEO FOOTAGE ASSIGNMENT MODAL                                */}
      {/* ============================================================= */}
      {isVideoModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalTopBar}>
              <h3 style={styles.modalHeadline}>Assign Multi-Camera Video Sources</h3>
              <button style={styles.closeIconBtn} onClick={() => setIsVideoModalOpen(false)}>
                <X size={20} color="#94a3b8" />
              </button>
            </div>

            <p style={styles.modalDescription}>
              Select distinct video recordings from warehouse sectors to process simultaneously across perception agents.
            </p>

            <div style={styles.formGroup}>
              <label style={styles.inputTitle}>Camera A (Entrance Sector):</label>
              <select
                style={styles.selectInput}
                value={selectedCamA}
                onChange={(e) => setSelectedCamA(e.target.value)}
              >
                {availableVideos.map((v) => (
                  <option key={`a-${v}`} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.inputTitle}>Camera B (Loading Area Sector):</label>
              <select
                style={styles.selectInput}
                value={selectedCamB}
                onChange={(e) => setSelectedCamB(e.target.value)}
              >
                {availableVideos.map((v) => (
                  <option key={`b-${v}`} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.modalActionsRow}>
              <button style={styles.secondaryBtn} onClick={() => setIsVideoModalOpen(false)}>
                Cancel
              </button>
              <button style={styles.primaryBtn} onClick={handleApplyVideos}>
                Apply Video Feeds
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* DEEP LLM INCIDENT FORENSIC ANALYSIS MODAL                      */}
      {/* ============================================================= */}
      {analysisModalIncident && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: '840px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={styles.modalTopBar}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <ShieldAlert size={22} color="#00f2fe" style={{ marginRight: 8 }} />
                <h3 style={styles.modalHeadline}>HAWK Incident Forensic Analysis & Video Clip</h3>
              </div>
              <button style={styles.closeIconBtn} onClick={() => setAnalysisModalIncident(null)}>
                <X size={20} color="#94a3b8" />
              </button>
            </div>

            {/* Video Player */}
            <div style={styles.forensicVideoWrapper}>
              <video
                src={analysisModalIncident.clip_url || '/clips/evt_veh_84247.mp4'}
                controls
                autoPlay
                loop
                style={styles.forensicVideoPlayer}
              />
            </div>

            {/* Executive Summary */}
            <div style={styles.analysisSummaryBox}>
              <div style={styles.summaryBadge}>EXECUTIVE AI SAFETY OFFICER SUMMARY</div>
              <p style={styles.summaryText}>{analysisModalIncident.summary}</p>
            </div>

            {/* Multi-Agent Anticipation Timeline */}
            <div style={styles.timelineSection}>
              <h4 style={styles.sectionHeaderTitle}>Multi-Agent Collaborative Anticipation Timeline</h4>
              <div style={styles.timelineList}>
                {analysisModalIncident.timeline?.map((t: any, i: number) => (
                  <div key={i} style={styles.timelineItem}>
                    <span style={styles.timelineTime}>{t.time}</span>
                    <div style={styles.timelineDot} />
                    <div style={styles.timelineContent}>
                      <span style={styles.timelineStepName}>{t.step}</span>
                      <p style={styles.timelineDetail}>{t.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Root Cause & OSHA Standards */}
            <div style={styles.twoColGrid}>
              <div style={styles.colCard}>
                <h5 style={styles.colHeader}>Root Cause Analysis</h5>
                <p style={styles.colBody}>{analysisModalIncident.root_cause}</p>
              </div>

              <div style={styles.colCard}>
                <h5 style={styles.colHeader}>OSHA Regulatory Reference</h5>
                <p style={{ ...styles.colBody, color: '#f59e0b' }}>{analysisModalIncident.osha_regulation}</p>
              </div>
            </div>

            {/* Corrective Actions */}
            <div style={{ marginTop: '14px' }}>
              <h5 style={styles.colHeader}>Mandated Engineering & Administrative Controls</h5>
              <ul style={styles.actionUl}>
                {analysisModalIncident.corrective_actions?.map((act: string, idx: number) => (
                  <li key={idx} style={styles.actionLi}>
                    <CheckCircle2 size={14} color="#10b981" style={{ marginRight: 6, flexShrink: 0 }} />
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ ...styles.modalActionsRow, marginTop: '20px' }}>
              <button style={styles.primaryBtn} onClick={() => setAnalysisModalIncident(null)}>
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  dashboardContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#070b14',
    color: '#f8fafc',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden',
    userSelect: 'none',
  },
  topHeader: {
    height: '56px',
    backgroundColor: '#0a0f1d',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 20px',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  hawkLogoBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    border: '1px solid rgba(0, 242, 254, 0.3)',
  },
  brandTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  brandTitleMain: {
    fontSize: '18px',
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: '1px',
  },
  brandTitleSep: {
    fontSize: '16px',
    color: '#64748b',
  },
  brandTitleSub: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#e2e8f0',
  },
  systemBadgeTag: {
    marginLeft: '16px',
    padding: '3px 10px',
    borderRadius: '6px',
    backgroundColor: '#131c31',
    border: '1px solid #1e293b',
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '600',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  scenarioBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#0d1527',
    padding: '3px 6px',
    borderRadius: '8px',
    border: '1px solid #1e293b',
  },
  stepBtn: {
    border: 'none',
    color: '#ffffff',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  actionIconButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#131c31',
    border: '1px solid #1e293b',
    color: '#cbd5e1',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  actionBtnLabel: {
    fontSize: '12px',
    fontWeight: '600',
  },
  onlinePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '12px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  onlineDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
  },
  onlineText: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#10b981',
  },
  clockWidget: {
    textAlign: 'right',
    marginLeft: '6px',
  },
  clockTime: {
    fontSize: '12px',
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: '0.5px',
  },
  clockDate: {
    fontSize: '10px',
    color: '#64748b',
  },
  mainGrid: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 16px',
    gap: '12px',
    overflow: 'hidden',
  },
  topRow: {
    flex: 1.35,
    display: 'grid',
    gridTemplateColumns: '1fr 0.8fr 1fr',
    gap: '12px',
    minHeight: '0',
  },
  bottomRow: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 0.8fr 1fr',
    gap: '12px',
    minHeight: '0',
  },
  cardPanel: {
    backgroundColor: '#0d1527',
    border: '1px solid #1e2b45',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  panelHeader: {
    height: '38px',
    backgroundColor: '#101a30',
    borderBottom: '1px solid #1e2b45',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 12px',
    flexShrink: 0,
  },
  panelHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
  },
  panelTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: '0.3px',
  },
  liveTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: '#10b981',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: '800',
    color: '#090d16',
  },
  liveDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    backgroundColor: '#090d16',
  },
  cctvContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  cctvVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  bboxForklift: {
    position: 'absolute',
    top: '28%',
    left: '18%',
    width: '38%',
    height: '52%',
    border: '2px solid #ea580c',
    borderRadius: '4px',
    boxShadow: '0 0 10px rgba(234, 88, 12, 0.4)',
    pointerEvents: 'none',
  },
  bboxLabelForklift: {
    position: 'absolute',
    top: '-24px',
    left: '0',
    backgroundColor: '#ea580c',
    padding: '2px 6px',
    borderRadius: '3px',
    display: 'flex',
    gap: '6px',
  },
  bboxWorker: {
    position: 'absolute',
    top: '32%',
    right: '20%',
    width: '26%',
    height: '48%',
    border: '2px solid #22c55e',
    borderRadius: '4px',
    boxShadow: '0 0 10px rgba(34, 197, 94, 0.4)',
    pointerEvents: 'none',
  },
  bboxLabelWorker: {
    position: 'absolute',
    top: '-24px',
    left: '0',
    backgroundColor: '#22c55e',
    padding: '2px 6px',
    borderRadius: '3px',
    display: 'flex',
    gap: '6px',
  },
  bboxName: {
    fontSize: '10px',
    fontWeight: '800',
    color: '#ffffff',
  },
  bboxConf: {
    fontSize: '10px',
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  cctvBottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(9, 13, 22, 0.88)',
    backdropFilter: 'blur(4px)',
    padding: '8px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  },
  cctvDualOverlay: {
    display: 'flex',
    flexDirection: 'column',
  },
  cctvOverlayText: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#ffffff',
  },
  cctvOverlayTime: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: '600',
  },
  sharedStateContent: {
    flex: 1,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  subSectionHeader: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    marginBottom: '6px',
  },
  activeEventCard: {
    display: 'flex',
    backgroundColor: '#131d33',
    border: '1px solid #1e2b45',
    borderRadius: '8px',
    padding: '10px',
    gap: '12px',
    alignItems: 'center',
  },
  activeEventIconBox: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: '#f59e0b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activeEventInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  activeEventType: {
    fontSize: '12px',
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: '0.5px',
  },
  activeEventDetail: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  entitiesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  entityRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
  },
  entityNameBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  entityIconSquare: {
    width: '24px',
    height: '24px',
    borderRadius: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entityCode: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#f1f5f9',
  },
  entityStatus: {
    fontSize: '12px',
    fontWeight: '700',
  },
  warehouseMapContainer: {
    marginTop: '6px',
    backgroundColor: '#0a1020',
    borderRadius: '8px',
    border: '1px solid #1e2b45',
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapZoneBoxA: {
    padding: '8px 12px',
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    border: '1px dashed #0284c7',
    borderRadius: '6px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
  },
  mapZoneTitle: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#38bdf8',
  },
  mapZoneSub: {
    fontSize: '9px',
    color: '#94a3b8',
  },
  mapTransitArrow: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    margin: '0 8px',
  },
  transitLine: {
    height: '2px',
    backgroundColor: '#334155',
    width: '100%',
  },
  transitVehicleMarker: {
    position: 'absolute',
    backgroundColor: '#0a1020',
    padding: '2px 6px',
    border: '1px solid #f59e0b',
    borderRadius: '4px',
  },
  transitArrowHead: {
    position: 'absolute',
    right: 0,
  },
  mapZoneBoxB: {
    padding: '8px 12px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  hazardBeaconDot: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
    boxShadow: '0 0 8px #ef4444',
  },
  mapZoneTitleB: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#f87171',
  },
  mapZoneSubB: {
    fontSize: '9px',
    color: '#94a3b8',
  },

  // Terminal / Event Stream
  terminalContainer: {
    flex: 1,
    padding: '10px 14px',
    backgroundColor: '#060a14',
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: '11px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  logLine: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    lineHeight: '1.4',
  },
  logTime: {
    color: '#64748b',
    width: '65px',
    flexShrink: 0,
  },
  logAgent: {
    fontWeight: '700',
    width: '95px',
    flexShrink: 0,
  },
  logMessage: {
    color: '#cbd5e1',
    flex: 1,
  },

  // Risk Assessment
  riskTable: {
    flex: 1,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-around',
  },
  riskRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid #131c31',
  },
  riskLabelGroup: {
    display: 'flex',
    alignItems: 'center',
  },
  riskRowLabel: {
    fontSize: '12px',
    color: '#cbd5e1',
    fontWeight: '600',
  },
  riskRowVal: {
    fontSize: '12px',
    fontWeight: '700',
  },
  overallRiskRow: {
    marginTop: '6px',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid #f59e0b',
    borderRadius: '8px',
    padding: '10px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overallRiskLeft: {
    display: 'flex',
    alignItems: 'center',
  },
  overallRiskTitle: {
    fontSize: '13px',
    fontWeight: '800',
    color: '#f59e0b',
  },
  overallRiskBadge: {
    fontSize: '14px',
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: '1px',
  },

  // Safety Kiosk
  kioskContainer: {
    flex: 1,
    padding: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hazardWarningCard: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: '0 4px 20px rgba(245, 158, 11, 0.3)',
  },
  hazardCardContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
    textAlign: 'center',
  },
  hazardMainTitle: {
    fontSize: '20px',
    fontWeight: '900',
    color: '#090d16',
    letterSpacing: '1.2px',
    marginBottom: '4px',
  },
  hazardSubtitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '8px',
  },
  hazardActionNotice: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#090d16',
    letterSpacing: '0.5px',
  },
  hazardStripesBar: {
    height: '14px',
    width: '100%',
    background: 'repeating-linear-gradient(45deg, #090d16, #090d16 12px, #f59e0b 12px, #f59e0b 24px)',
  },

  // Footer
  footerBar: {
    height: '32px',
    backgroundColor: '#070b14',
    borderTop: '1px solid #131c31',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  footerTagline: {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: '500',
    letterSpacing: '0.5px',
  },

  // Modals
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modalCard: {
    backgroundColor: '#0d1527',
    border: '1px solid #1e2b45',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '520px',
    width: '90%',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)',
  },
  modalTopBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  modalHeadline: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#f8fafc',
    margin: 0,
  },
  closeIconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
  },
  modalDescription: {
    fontSize: '13px',
    color: '#94a3b8',
    marginBottom: '16px',
    lineHeight: '1.5',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '14px',
  },
  inputTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#cbd5e1',
  },
  selectInput: {
    backgroundColor: '#131c31',
    border: '1px solid #1e2b45',
    borderRadius: '8px',
    padding: '10px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
  },
  modalActionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '16px',
  },
  secondaryBtn: {
    backgroundColor: '#1e293b',
    border: 'none',
    color: '#94a3b8',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  primaryBtn: {
    backgroundColor: '#00f2fe',
    border: 'none',
    color: '#090d16',
    padding: '10px 18px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
  },

  // LLM Analysis Modal Specifics
  forensicVideoWrapper: {
    height: '240px',
    backgroundColor: '#020617',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '14px',
    border: '1px solid #1e2b45',
  },
  forensicVideoPlayer: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  analysisSummaryBox: {
    backgroundColor: '#131c31',
    border: '1px solid #1e2b45',
    borderRadius: '8px',
    padding: '14px',
    marginBottom: '14px',
  },
  summaryBadge: {
    fontSize: '10px',
    fontWeight: '800',
    color: '#00f2fe',
    letterSpacing: '1px',
    marginBottom: '6px',
  },
  summaryText: {
    fontSize: '13px',
    color: '#e2e8f0',
    lineHeight: '1.6',
    margin: 0,
  },
  timelineSection: {
    marginBottom: '14px',
  },
  sectionHeaderTitle: {
    fontSize: '12px',
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    marginBottom: '10px',
  },
  timelineList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingLeft: '6px',
  },
  timelineItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    position: 'relative',
  },
  timelineTime: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#00f2fe',
    width: '65px',
    flexShrink: 0,
  },
  timelineDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#00f2fe',
    marginTop: '4px',
    flexShrink: 0,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStepName: {
    fontSize: '12px',
    fontWeight: '800',
    color: '#f8fafc',
  },
  timelineDetail: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: '2px 0 0 0',
    lineHeight: '1.4',
  },
  twoColGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginTop: '10px',
  },
  colCard: {
    backgroundColor: '#101a30',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #1e2b45',
  },
  colHeader: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#cbd5e1',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    marginBottom: '6px',
    marginTop: 0,
  },
  colBody: {
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: '1.5',
    margin: 0,
  },
  actionUl: {
    margin: '8px 0 0 0',
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  actionLi: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px',
    color: '#e2e8f0',
  },
};
