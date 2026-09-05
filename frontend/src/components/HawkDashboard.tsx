import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Video,
  AlertTriangle,
  RotateCcw,
  Maximize2,
  Camera,
  FileText,
  Volume2,
  VolumeX,
  X,
  MapPin,
  ChevronDown,
  Sun,
  Bell,
  Clock,
  Info,
  ArrowRight,
  Activity,
  CheckCircle2,
  Radio,
  Sliders,
  Play,
  Truck,
  User,
  Layers,
  Octagon,
  Flame
} from 'lucide-react';
import forkliftImg from '../assets/forklift_thumb.jpg';
import siteMapImg from '../assets/site_map_isometric.jpg';

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
  const [currentDate, setCurrentDate] = useState('Tue, 5 Sep 2026');
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [availableVideos, setAvailableVideos] = useState<string[]>([]);
  const [selectedCamA, setSelectedCamA] = useState('');
  const [selectedCamB, setSelectedCamB] = useState('');
  const [scenarioStep, setScenarioStep] = useState(1);
  const [analysisModalIncident, setAnalysisModalIncident] = useState<any | null>(null);
  const [streamVersion, setStreamVersion] = useState(0);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('All Zones');
  const [isZoneDropdownOpen, setIsZoneDropdownOpen] = useState(false);
  const [isSiteDropdownOpen, setIsSiteDropdownOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(3);

  // Audio Siren & Voice Alerts State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastSpokenAlertRef = useRef<string>('');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const cam1ContainerRef = useRef<HTMLDivElement>(null);
  const cam2ContainerRef = useRef<HTMLDivElement>(null);

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

  // Connect directly to backend port 8001
  const getCameraStreamUrl = (camera: 'a' | 'b') => {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:8001/api/hawk/camera/${camera}/stream?v=${streamVersion}`;
  };

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }));
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

    // Setup WebSocket for live updates
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
    } else if (step === 3) {
      lastSpokenAlertRef.current = 'HEAVY MACHINERY APPROACHING';
      dispatchAlertAudio(
        "Warning: Heavy machinery approaching entrance!",
        "Entrance Doorway",
        "Heavy machinery is coming! Person at entrance doorway, move out of the way immediately!",
        "warning"
      );
    } else if (step === 2 || step === 4) {
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

  const toggleFullscreen = (containerRef: React.RefObject<HTMLDivElement | null>) => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.warn(err));
    } else {
      document.exitFullscreen().catch(err => console.warn(err));
    }
  };

  const handleNotifySupervisor = () => {
    getAudioContext();
    playSiren('warning');
    setNotificationCount(c => c + 1);
    speakAnnouncement("Supervisor notified. Priority dispatch sent to mobile terminal.");
  };

  const camA = hawkState?.cameras?.camera_a;
  const camB = hawkState?.cameras?.camera_b;
  const risk = hawkState?.risk_assessment;
  const kiosk = hawkState?.safety_kiosk;

  // Dynamic Active Incident Data based on scenarioStep and real-time state
  const currentIncident = (() => {
    if (scenarioStep === 1) {
      // Baseline: Live PPE violations from Camera 1 & Camera 2!
      return {
        badge: 'ACTIVE PPE ALERT',
        badgeColor: '#d97706',
        badgeBg: '#fef3c7',
        etaPillText: 'Active Non-Compliance',
        etaPillBg: '#fef3c7',
        etaPillColor: '#b45309',
        title: 'Missing Helmet & Safety Vest in Zone B',
        description: 'Worker P12 detected in Loading Zone (Zone B) without required Hard Hat & Safety Vest. Stationary Forklift #01 parked with 0.6m clearance.',
        location: 'Loading Zone (Zone B)',
        etaText: 'Active Policy Breach',
        riskLabel: 'RISK: MEDIUM',
        riskColor: '#d97706',
        riskBg: '#fef3c7',
        thumbType: 'ppe' as const,
      };
    } else if (scenarioStep === 2 || scenarioStep === 4) {
      return {
        badge: 'ACTIVE INCIDENT',
        badgeColor: '#ef4444',
        badgeBg: '#fee2e2',
        etaPillText: 'In ~ 4.2 seconds',
        etaPillBg: '#fee2e2',
        etaPillColor: '#dc2626',
        title: 'Vehicle Approaching Zone B',
        description: 'Forklift V01 detected at Entrance (Zone A) and predicted to enter Loading Zone (Zone B). Worker P12 present in the zone.',
        location: 'Loading Zone (Zone B)',
        etaText: 'ETA 4.2 seconds',
        riskLabel: 'RISK: MEDIUM',
        riskColor: '#d97706',
        riskBg: '#fef3c7',
        thumbType: 'forklift' as const,
      };
    } else if (scenarioStep === 3) {
      return {
        badge: 'ACTIVE MACHINERY WARNING',
        badgeColor: '#ea580c',
        badgeBg: '#ffedd5',
        etaPillText: 'In ~ 3.5 seconds',
        etaPillBg: '#ffedd5',
        etaPillColor: '#c2410c',
        title: 'Heavy Machinery Approaching Entrance',
        description: 'Forklift V01 detected approaching entrance from outside. Worker P12 standing at entrance doorway from inside. Warning dispatched: clear doorway pathway immediately!',
        location: 'Entrance Doorway (Zone A -> Zone B)',
        etaText: 'ETA ~ 3.5 seconds',
        riskLabel: 'RISK: HIGH',
        riskColor: '#ea580c',
        riskBg: '#ffedd5',
        thumbType: 'forklift' as const,
      };
    } else if (scenarioStep === 5) {
      return {
        badge: 'CRITICAL CONFLICT',
        badgeColor: '#dc2626',
        badgeBg: '#fee2e2',
        etaPillText: '0.4s — HALTED',
        etaPillBg: '#fee2e2',
        etaPillColor: '#991b1b',
        title: 'Imminent Collision Breach — Emergency Brake Engaged',
        description: 'Critical proximity breach in Zone B. Autonomous interlock actuated: Forklift V01 halted 0.4m from Worker P12.',
        location: 'Loading Zone (Zone B)',
        etaText: 'Halted (0.4m)',
        riskLabel: 'RISK: CRITICAL',
        riskColor: '#dc2626',
        riskBg: '#fee2e2',
        thumbType: 'forklift' as const,
      };
    } else if (scenarioStep === 7) {
      return {
        badge: 'FIRE EMERGENCY',
        badgeColor: '#dc2626',
        badgeBg: '#fee2e2',
        etaPillText: 'EVACUATE NOW',
        etaPillBg: '#fee2e2',
        etaPillColor: '#991b1b',
        title: 'Thermal Combustion & Smoke Spread in Bay 4',
        description: 'Active thermal combustion detected in Zone B storage racking. Evacuation horn sounding and HVAC dampers sealed.',
        location: 'Storage Bay (Zone B)',
        etaText: 'Active Evacuation',
        riskLabel: 'CRITICAL: FIRE',
        riskColor: '#dc2626',
        riskBg: '#fee2e2',
        thumbType: 'fire' as const,
      };
    }

    return {
      badge: 'ACTIVE INCIDENT',
      badgeColor: '#ef4444',
      badgeBg: '#fee2e2',
      etaPillText: 'In ~ 4.2 seconds',
      etaPillBg: '#fee2e2',
      etaPillColor: '#dc2626',
      title: 'Vehicle Approaching Zone B',
      description: 'Forklift V01 detected at Entrance (Zone A) and predicted to enter Loading Zone (Zone B). Worker P12 present in the zone.',
      location: 'Loading Zone (Zone B)',
      etaText: 'ETA 4.2 seconds',
      riskLabel: 'RISK: MEDIUM',
      riskColor: '#d97706',
      riskBg: '#fef3c7',
      thumbType: 'forklift' as const,
    };
  })();

  // Dynamic Recent Alerts based on real events currently happening
  const currentRecentAlerts = (() => {
    if (scenarioStep === 1) {
      return [
        {
          id: '1',
          title: 'Missing Helmet & Safety Vest',
          subtitle: 'Worker P12 • Loading Zone (Zone B)',
          time: 'Just now',
          sev: 'MEDIUM',
          sevColor: '#b45309',
          sevBg: '#fef3c7',
          iconType: 'warning',
          iconBg: '#fef3c7',
          iconColor: '#d97706'
        },
        {
          id: '2',
          title: 'Missing Safety Vest',
          subtitle: 'Worker P04 • Entrance (Zone A)',
          time: '45 sec ago',
          sev: 'LOW',
          sevColor: '#15803d',
          sevBg: '#dcfce7',
          iconType: 'info',
          iconBg: '#e0f2fe',
          iconColor: '#0284c7'
        },
        {
          id: '3',
          title: 'Forklift Stationary Clearance',
          subtitle: 'Forklift #01 parked 0.6m from Worker P12',
          time: '3 min ago',
          sev: 'LOW',
          sevColor: '#15803d',
          sevBg: '#dcfce7',
          iconType: 'info',
          iconBg: '#dcfce7',
          iconColor: '#16a34a'
        }
      ];
    } else if (scenarioStep === 2 || scenarioStep === 4) {
      return [
        {
          id: '1',
          title: 'Vehicle-Person Proximity',
          subtitle: 'Forklift V01 with Worker P12 • Loading Zone',
          time: '2 sec ago',
          sev: 'MEDIUM',
          sevColor: '#b45309',
          sevBg: '#fef3c7',
          iconType: 'warning',
          iconBg: '#fef3c7',
          iconColor: '#d97706'
        },
        {
          id: '2',
          title: 'Cross-Zone Trajectory Shared',
          subtitle: 'Camera A handed off V01 to Camera B',
          time: '18 sec ago',
          sev: 'LOW',
          sevColor: '#0369a1',
          sevBg: '#e0f2fe',
          iconType: 'info',
          iconBg: '#e0f2fe',
          iconColor: '#0284c7'
        },
        {
          id: '3',
          title: 'PPE Violation (No Helmet / Vest)',
          subtitle: 'Worker P12 • Loading Zone',
          time: '4 min ago',
          sev: 'MEDIUM',
          sevColor: '#b45309',
          sevBg: '#fef3c7',
          iconType: 'warning',
          iconBg: '#fef3c7',
          iconColor: '#d97706'
        }
      ];
    } else if (scenarioStep === 3) {
      return [
        {
          id: '1',
          title: 'Heavy Machinery Inbound',
          subtitle: 'Forklift V01 approaching Entrance Doorway from exterior',
          time: 'Just now',
          sev: 'HIGH',
          sevColor: '#c2410c',
          sevBg: '#ffedd5',
          iconType: 'warning',
          iconBg: '#ffedd5',
          iconColor: '#ea580c'
        },
        {
          id: '2',
          title: 'Pedestrian Doorway Warning',
          subtitle: 'Worker P12 warned: Move out of the way immediately',
          time: '3 sec ago',
          sev: 'HIGH',
          sevColor: '#c2410c',
          sevBg: '#ffedd5',
          iconType: 'warning',
          iconBg: '#ffedd5',
          iconColor: '#ea580c'
        },
        {
          id: '3',
          title: 'Cross-Camera Clearance Interlock',
          subtitle: 'Cam 1 (Outside) & Cam 2 (Inside) synchronized tracking',
          time: '12 sec ago',
          sev: 'MEDIUM',
          sevColor: '#b45309',
          sevBg: '#fef3c7',
          iconType: 'info',
          iconBg: '#e0f2fe',
          iconColor: '#0284c7'
        }
      ];
    } else if (scenarioStep === 5) {
      return [
        {
          id: '1',
          title: 'Critical Collision Breach',
          subtitle: 'Forklift V01 impact trajectory with Worker P12',
          time: 'Just now',
          sev: 'CRITICAL',
          sevColor: '#dc2626',
          sevBg: '#fee2e2',
          iconType: 'critical',
          iconBg: '#fee2e2',
          iconColor: '#ef4444'
        },
        {
          id: '2',
          title: 'Autonomous Brake Engaged',
          subtitle: 'Vehicle V01 interlock halted at 0.4m clearance',
          time: '1 sec ago',
          sev: 'CRITICAL',
          sevColor: '#dc2626',
          sevBg: '#fee2e2',
          iconType: 'critical',
          iconBg: '#fee2e2',
          iconColor: '#ef4444'
        },
        {
          id: '3',
          title: 'Supervisor Priority Alert Dispatched',
          subtitle: 'Mobile push notification broadcasted',
          time: '5 sec ago',
          sev: 'HIGH',
          sevColor: '#c2410c',
          sevBg: '#ffedd5',
          iconType: 'warning',
          iconBg: '#ffedd5',
          iconColor: '#ea580c'
        }
      ];
    } else if (scenarioStep === 7) {
      return [
        {
          id: '1',
          title: 'Fire Emergency Detected',
          subtitle: 'Active thermal anomaly & smoke spread in Bay 4',
          time: 'Just now',
          sev: 'CRITICAL',
          sevColor: '#dc2626',
          sevBg: '#fee2e2',
          iconType: 'critical',
          iconBg: '#fee2e2',
          iconColor: '#ef4444'
        },
        {
          id: '2',
          title: 'Zone Evacuation Strobe Fired',
          subtitle: 'Evacuation horn active • HVAC dampers sealed',
          time: '3 sec ago',
          sev: 'CRITICAL',
          sevColor: '#dc2626',
          sevBg: '#fee2e2',
          iconType: 'critical',
          iconBg: '#fee2e2',
          iconColor: '#ef4444'
        },
        {
          id: '3',
          title: 'Automated Facility Dispatch',
          subtitle: 'Emergency notification sent to Riverside Central',
          time: '12 sec ago',
          sev: 'HIGH',
          sevColor: '#c2410c',
          sevBg: '#ffedd5',
          iconType: 'warning',
          iconBg: '#ffedd5',
          iconColor: '#ea580c'
        }
      ];
    }
    return [];
  })();

  return (
    <div style={styles.appContainer}>
      {/* ================================================================= */}
      {/* TOP NAVIGATION BAR                                                */}
      {/* ================================================================= */}
      <header style={styles.navBar}>
        {/* Left: Brand Logo + Site Selector */}
        <div style={styles.navLeft}>
          {/* Stylized Hawk Logo */}
          <div style={styles.brandRow}>
            <div style={styles.hawkLogo}>
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M4 14C8 14 12 11 15 7C17 4 20 2 24 2C22 7 24 10 28 13C25 15 22 17 21 21C20 25 18 29 14 30C15 26 14 23 11 20C8 18 5 17 4 14Z"
                  fill="#1e3a8a"
                />
                <path
                  d="M15 7C17 11 21 13 25 14C21 16 19 19 18 23C16 19 14 16 10 15C12 12 13 9 15 7Z"
                  fill="#3b82f6"
                />
              </svg>
            </div>
            <span style={styles.brandName}>HAWK</span>
            <span style={styles.brandTagline}>AI for a Safer Tomorrow</span>
          </div>

          {/* Location Selector Pill Card */}
          <div style={styles.sitePill} onClick={() => setIsSiteDropdownOpen(!isSiteDropdownOpen)}>
            <MapPin size={16} color="#1e3a8a" style={{ flexShrink: 0 }} />
            <div style={styles.siteTextCol}>
              <span style={styles.siteName}>Riverside Construction Site</span>
              <span style={styles.siteSub}>Sector B • Main Facility</span>
            </div>
            <ChevronDown size={14} color="#64748b" />
          </div>
        </div>

        {/* Center: Sleek Controls / Scenario Bar */}
        <div style={styles.navCenter}>
          <div style={styles.scenarioBar}>
            <button
              style={{
                ...styles.scenarioBtn,
                ...(scenarioStep === 1 ? styles.scenarioBtnActive : {})
              }}
              onClick={() => handleTriggerStep(1)}
              title="Baseline Safe State"
            >
              Baseline
            </button>
            <button
              style={{
                ...styles.scenarioBtn,
                ...(scenarioStep === 3 ? styles.scenarioBtnActive : {})
              }}
              onClick={() => handleTriggerStep(3)}
              title="Inbound Machinery Scenario: Forklift approaching entrance outside & worker inside doorway"
            >
              ⚠️ Machinery Warn
            </button>
            <button
              style={{
                ...styles.scenarioBtn,
                ...(scenarioStep === 2 || scenarioStep === 4 ? styles.scenarioBtnActive : {})
              }}
              onClick={() => handleTriggerStep(4)}
              title="Anticipate Inbound Vehicle & Zone Kiosk Warning"
            >
              Anticipate
            </button>
            <button
              style={{
                ...styles.scenarioBtn,
                ...(scenarioStep === 5 ? styles.scenarioBtnActive : {})
              }}
              onClick={() => handleTriggerStep(5)}
              title="Conflict & Autonomous Intervention"
            >
              Conflict
            </button>
            <button
              style={{
                ...styles.scenarioBtn,
                ...(scenarioStep === 7 ? styles.scenarioBtnActive : {})
              }}
              onClick={() => handleTriggerStep(7)}
              title="Fire Emergency Hazard"
            >
              🔥 Fire
            </button>
            <button
              style={styles.scenarioUtilityBtn}
              onClick={() => handleTriggerStep(1)}
              title="Reset System to Nominal"
            >
              <RotateCcw size={12} color="#64748b" />
              <span>Reset</span>
            </button>
            <button
              style={styles.scenarioUtilityBtn}
              onClick={() => setIsVideoModalOpen(true)}
              title="Assign Video Sources"
            >
              <Video size={12} color="#64748b" />
              <span>Feeds</span>
            </button>
            <button
              style={{
                ...styles.scenarioUtilityBtn,
                color: '#dc2626',
                borderColor: '#fee2e2',
                backgroundColor: '#fff5f5'
              }}
              onClick={() => handleTriggerStep(5)}
              title="Trigger Immediate Emergency Halt"
            >
              <Octagon size={12} color="#dc2626" />
              <span style={{ fontWeight: 700 }}>HALT</span>
            </button>
          </div>
        </div>

        {/* Right: Sound, Weather, Time, Bell, User Profile */}
        <div style={styles.navRight}>
          {/* Siren Audio Toggle */}
          <button
            style={{
              ...styles.soundToggleBtn,
              backgroundColor: soundEnabled ? '#eff6ff' : '#f8fafc',
              borderColor: soundEnabled ? '#bfdbfe' : '#e2e8f0',
              color: soundEnabled ? '#1d4ed8' : '#94a3b8'
            }}
            onClick={toggleSound}
            title={soundEnabled ? 'Industrial Siren & Spoken Dispatch: ACTIVE (Click to Mute)' : 'Alert Audio MUTED (Click to Enable)'}
          >
            {soundEnabled ? <Volume2 size={15} color="#1d4ed8" /> : <VolumeX size={15} color="#94a3b8" />}
            <span style={{ fontSize: 11, fontWeight: 700 }}>{soundEnabled ? 'Siren ON' : 'Muted'}</span>
          </button>

          {/* Weather Widget */}
          <div style={styles.weatherWidget}>
            <Sun size={18} color="#f59e0b" />
            <div style={styles.weatherCol}>
              <span style={styles.weatherTemp}>28°C</span>
              <span style={styles.weatherCondition}>Clear</span>
            </div>
          </div>

          {/* Clock Widget */}
          <div style={styles.clockCol}>
            <span style={styles.clockDate}>{currentDate}</span>
            <span style={styles.clockTime}>{currentTime}</span>
          </div>

          {/* Notification Bell */}
          <div style={styles.bellBtn} onClick={() => setNotificationCount(0)} title="Active Notifications">
            <Bell size={18} color="#1e293b" />
            {notificationCount > 0 && (
              <div style={styles.bellBadge}>{notificationCount}</div>
            )}
          </div>

          {/* User Profile */}
          <div style={styles.userCard}>
            <div style={styles.userAvatar}>K</div>
            <div style={styles.userCol}>
              <span style={styles.userName}>Karthik</span>
              <span style={styles.userRole}>Supervisor</span>
            </div>
            <ChevronDown size={14} color="#94a3b8" />
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* MAIN TWO-COLUMN WORKSPACE                                         */}
      {/* ================================================================= */}
      <main style={styles.mainContent}>
        {/* =============================================================== */}
        {/* LEFT COLUMN: LIVE MONITORING (CAMERAS) (~62% width)             */}
        {/* =============================================================== */}
        <section style={styles.leftCol}>
          {/* Section Header */}
          <div style={styles.liveMonitoringHeader}>
            <div style={styles.liveHeaderLeft}>
              <h1 style={styles.liveHeading}>Live Monitoring</h1>
              <div style={styles.systemsOnlinePill}>
                <div style={styles.greenPulseDot} />
                <span>All Systems Online</span>
              </div>
            </div>
            <p style={styles.liveSubheading}>Real-time monitoring across key zones</p>
          </div>

          {/* Camera Feeds Stack (Cam 1 & Cam 2) */}
          <div style={styles.camsStack}>
            {/* CAMERA 1: Entrance (Outside) */}
            <div style={styles.camCard} ref={cam1ContainerRef}>
              <img
                key={`cam_a_${streamVersion}`}
                src={getCameraStreamUrl('a')}
                alt="Camera 1 - Entrance"
                style={styles.camImg}
              />

              {/* Top-Left Pill: Cam 1 Entrance (Outside) */}
              <div style={styles.camTopLeftPill}>
                <Camera size={14} color="#ffffff" />
                <span style={styles.camNumBold}>Cam 1</span>
                <span style={styles.camLocText}>Entrance (Outside)</span>
              </div>

              {/* Top-Right Pill: LIVE */}
              <div style={styles.camLiveBadge}>
                <div style={styles.whiteDot} />
                <span>LIVE</span>
              </div>

              {/* Bottom-Left Pill: Timestamp */}
              <div style={styles.camBottomTimePill}>
                <span>{currentTime}</span>
              </div>

              {/* Bottom-Right Controls: Fullscreen & Snapshot */}
              <div style={styles.camBottomRightControls}>
                <button
                  style={styles.camIconBtn}
                  onClick={() => toggleFullscreen(cam1ContainerRef)}
                  title="Toggle Fullscreen"
                >
                  <Maximize2 size={13} color="#ffffff" />
                </button>
                <button
                  style={styles.camIconBtn}
                  onClick={() => setStreamVersion(v => v + 1)}
                  title="Refresh Camera Feed"
                >
                  <Camera size={13} color="#ffffff" />
                </button>
              </div>
            </div>

            {/* CAMERA 2: Aisle 4 (Inside) */}
            <div style={styles.camCard} ref={cam2ContainerRef}>
              <img
                key={`cam_b_${streamVersion}`}
                src={getCameraStreamUrl('b')}
                alt="Camera 2 - Aisle 4"
                style={styles.camImg}
              />

              {/* Top-Left Pill: Cam 2 Location */}
              <div style={styles.camTopLeftPill}>
                <Camera size={14} color="#ffffff" />
                <span style={styles.camNumBold}>Cam 2</span>
                <span style={styles.camLocText}>{scenarioStep === 3 ? 'Entrance (Inside)' : 'Aisle 4 (Inside)'}</span>
              </div>

              {/* Top-Right Pill: LIVE */}
              <div style={styles.camLiveBadge}>
                <div style={styles.whiteDot} />
                <span>LIVE</span>
              </div>

              {/* Bottom-Left Pill: Timestamp */}
              <div style={styles.camBottomTimePill}>
                <span>{currentTime}</span>
              </div>

              {/* Bottom-Right Controls */}
              <div style={styles.camBottomRightControls}>
                <button
                  style={styles.camIconBtn}
                  onClick={() => toggleFullscreen(cam2ContainerRef)}
                  title="Toggle Fullscreen"
                >
                  <Maximize2 size={13} color="#ffffff" />
                </button>
                <button
                  style={styles.camIconBtn}
                  onClick={() => setStreamVersion(v => v + 1)}
                  title="Refresh Camera Feed"
                >
                  <Camera size={13} color="#ffffff" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* =============================================================== */}
        {/* RIGHT COLUMN: 3 STACKED CARDS (~38% width)                      */}
        {/* =============================================================== */}
        <aside style={styles.rightCol}>
          {/* ------------------------------------------------------------- */}
          {/* CARD 1: ACTIVE INCIDENT (TOP)                                 */}
          {/* ------------------------------------------------------------- */}
          <div style={styles.incidentCard}>
            {/* Header Row */}
            <div style={styles.incidentCardHeader}>
              <div style={styles.incidentHeaderLeft}>
                <div style={{ ...styles.incidentIconWrap, backgroundColor: currentIncident.badgeBg }}>
                  {currentIncident.thumbType === 'fire' ? (
                    <Flame size={17} color={currentIncident.badgeColor} />
                  ) : (
                    <AlertTriangle size={17} color={currentIncident.badgeColor} />
                  )}
                </div>
                <span style={{ ...styles.incidentBadgeTitle, color: currentIncident.badgeColor }}>
                  {currentIncident.badge}
                </span>
              </div>
              <div style={{ ...styles.etaPill, backgroundColor: currentIncident.etaPillBg, color: currentIncident.etaPillColor }}>
                <span>{currentIncident.etaPillText}</span>
              </div>
            </div>

            {/* Content Row with Thumbnail */}
            <div style={styles.incidentContentRow}>
              <div style={styles.incidentTextCol}>
                <h2 style={styles.incidentHeading}>{currentIncident.title}</h2>
                <p style={styles.incidentDescriptionText}>{currentIncident.description}</p>
              </div>
              <div style={styles.incidentThumbBox}>
                {currentIncident.thumbType === 'forklift' ? (
                  <img src={forkliftImg} alt="Vehicle Thumbnail" style={styles.incidentThumbImg} />
                ) : currentIncident.thumbType === 'fire' ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', backgroundColor: '#fee2e2' }}>
                    <Flame size={32} color="#dc2626" />
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', backgroundColor: '#fef3c7' }}>
                    <ShieldAlert size={32} color="#d97706" />
                  </div>
                )}
              </div>
            </div>

            {/* Metadata Row */}
            <div style={styles.incidentMetaRow}>
              <div style={styles.incidentMetaItem}>
                <MapPin size={14} color="#0f172a" />
                <span style={styles.incidentMetaDark}>{currentIncident.location}</span>
              </div>
              <div style={styles.incidentMetaItem}>
                <Clock size={14} color="#64748b" />
                <span style={styles.incidentMetaMuted}>{currentIncident.etaText}</span>
              </div>
              <div style={{
                ...styles.incidentRiskPill,
                backgroundColor: currentIncident.riskBg,
                color: currentIncident.riskColor
              }}>
                <span>{currentIncident.riskLabel}</span>
              </div>
            </div>

            {/* Action Buttons Row */}
            <div style={styles.incidentActionRow}>
              <button
                style={styles.viewDetailsBtn}
                onClick={() => setIsDetailsModalOpen(true)}
              >
                View Forensic Details
              </button>
              <div style={styles.autoDispatchedBadge} title="Incident and forensic analysis auto-streamed to supervisor mobile app">
                <Radio size={13} color="#10b981" className="live-pulse-dot" />
                <span>Auto-Dispatched to Mobile</span>
              </div>
              {soundEnabled && (
                <button
                  style={styles.replayAudioBtn}
                  onClick={() => dispatchAlertAudio(currentIncident.title, currentIncident.location, currentIncident.description, scenarioStep === 7 ? 'fire' : scenarioStep === 5 ? 'critical' : 'warning')}
                  title="Replay Voice Siren Dispatch"
                >
                  <Volume2 size={15} color="#1e3a8a" />
                </button>
              )}
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* CARD 2: SITE MAP (MIDDLE)                                     */}
          {/* ------------------------------------------------------------- */}
          <div style={styles.siteMapCard}>
            <div style={styles.siteMapHeader}>
              <h3 style={styles.siteMapTitle}>Site Map</h3>
              <div style={styles.zonesDropdownWrap}>
                <button
                  style={styles.zonesDropdownBtn}
                  onClick={() => setIsZoneDropdownOpen(!isZoneDropdownOpen)}
                >
                  <span>{selectedZoneFilter}</span>
                  <ChevronDown size={13} color="#64748b" />
                </button>
                {isZoneDropdownOpen && (
                  <div style={styles.zonesDropdownMenu}>
                    {['All Zones', 'Zone A (Entrance)', 'Zone B (Loading)', 'Zone C (Storage)'].map(z => (
                      <div
                        key={z}
                        style={styles.zonesDropdownItem}
                        onClick={() => {
                          setSelectedZoneFilter(z);
                          setIsZoneDropdownOpen(false);
                        }}
                      >
                        {z}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3D Isometric Map Visual with Dynamic Heatmap Hotspot */}
            <div style={styles.siteMapCanvasContainer}>
              <img
                src={siteMapImg}
                alt="Facility Site Map"
                style={styles.siteMapImage}
              />

              {/* Dynamic Risk Heatmap Radial Glow overlay over Zone B */}
              <div
                style={{
                  ...styles.mapHeatmapGlow,
                  background: scenarioStep !== 1
                    ? 'radial-gradient(ellipse at center, rgba(239, 68, 68, 0.75) 0%, rgba(245, 158, 11, 0.55) 45%, rgba(16, 185, 129, 0.25) 75%, transparent 100%)'
                    : 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.45) 0%, rgba(59, 130, 246, 0.2) 65%, transparent 100%)'
                }}
              />

              {/* Floating Camera Badges */}
              <div style={{ ...styles.floatingCamBadge, top: '42%', left: '22%' }}>
                <Camera size={12} color="#1e3a8a" />
                <div style={styles.floatingCamTextCol}>
                  <span style={styles.floatingCamName}>Cam 1</span>
                  <span style={styles.floatingCamLoc}>Entrance</span>
                </div>
              </div>

              <div style={{ ...styles.floatingCamBadge, top: '56%', right: '18%' }}>
                <Camera size={12} color="#1e3a8a" />
                <div style={styles.floatingCamTextCol}>
                  <span style={styles.floatingCamName}>Cam 2</span>
                  <span style={styles.floatingCamLoc}>Aisle 4</span>
                </div>
              </div>

              {/* Map Legend & Compass Rose */}
              <div style={styles.mapLegendBox}>
                <div style={styles.legendItem}>
                  <div style={{ ...styles.legendDot, backgroundColor: '#ef4444' }} />
                  <span>High Risk</span>
                </div>
                <div style={styles.legendItem}>
                  <div style={{ ...styles.legendDot, backgroundColor: '#f59e0b' }} />
                  <span>Medium Risk</span>
                </div>
                <div style={styles.legendItem}>
                  <div style={{ ...styles.legendDot, backgroundColor: '#10b981' }} />
                  <span>Low Risk</span>
                </div>
              </div>

              {/* Compass North Arrow */}
              <div style={styles.compassBox}>
                <span style={styles.compassArrow}>▲</span>
                <span style={styles.compassLetter}>N</span>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* CARD 3: RECENT ALERTS (BOTTOM)                                */}
          {/* ------------------------------------------------------------- */}
          <div style={styles.recentAlertsCard}>
            <div style={styles.recentAlertsHeader}>
              <h3 style={styles.recentAlertsTitle}>Recent Alerts</h3>
              <button
                style={styles.viewAllBtn}
                onClick={() => handleOpenAnalysis(1)}
              >
                <span>View All</span>
                <ArrowRight size={13} color="#2563eb" />
              </button>
            </div>

            {/* List of Dynamic Recent Alert Items */}
            <div style={styles.alertList}>
              {currentRecentAlerts.map(alert => (
                <div key={alert.id} style={styles.alertItem}>
                  <div style={{ ...styles.alertIconCircle, backgroundColor: alert.iconBg }}>
                    {alert.iconType === 'critical' ? (
                      <AlertTriangle size={15} color={alert.iconColor} />
                    ) : alert.iconType === 'warning' ? (
                      <AlertTriangle size={15} color={alert.iconColor} />
                    ) : (
                      <Info size={15} color={alert.iconColor} />
                    )}
                  </div>
                  <div style={styles.alertItemMiddle}>
                    <div style={styles.alertItemTitle}>{alert.title}</div>
                    <div style={styles.alertItemSubtitle}>{alert.subtitle}</div>
                  </div>
                  <div style={styles.alertItemRight}>
                    <span style={styles.alertTimeText}>{alert.time}</span>
                    <div style={{ ...styles.alertSevBadge, backgroundColor: alert.sevBg, color: alert.sevColor }}>
                      {alert.sev}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* ================================================================= */}
      {/* MINIMAL BOTTOM FOOTER BAR                                         */}
      {/* ================================================================= */}
      <footer style={styles.footerBar}>
        <div style={styles.footerLeft}>
          <span style={styles.footerBrand}>HAWK</span>
          <span style={styles.footerTagline}>AI for a Safer Tomorrow.</span>
        </div>
        <div style={styles.footerRight}>
          <div style={styles.footerPulseDot} />
          <Activity size={14} color="#10b981" />
          <span style={styles.footerStatusText}>Monitoring Live...</span>
        </div>
      </footer>

      {/* ================================================================= */}
      {/* MODAL 1: VIEW DETAILS / FORENSIC REPORT MODAL                     */}
      {/* ================================================================= */}
      {isDetailsModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsDetailsModalOpen(false)}>
          <div style={styles.detailsModalBox} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeaderRow}>
              <div>
                <h3 style={styles.modalHeading}>Incident Telemetry & Multi-Agent Analysis</h3>
                <p style={styles.modalSubheading}>Real-time breakdown from Perception, Risk, and Response Agents</p>
              </div>
              <button style={styles.modalCloseBtn} onClick={() => setIsDetailsModalOpen(false)}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <div style={styles.modalBodyGrid}>
              {/* Perception Agent Column */}
              <div style={styles.telemetryCard}>
                <h4 style={styles.telemetryCardTitle}>Perception Agent</h4>
                <div style={styles.telemetryRow}>
                  <span style={styles.telemetryLabel}>Target 1:</span>
                  <span style={styles.telemetryValue}>Forklift V01 (91% conf)</span>
                </div>
                <div style={styles.telemetryRow}>
                  <span style={styles.telemetryLabel}>Target 2:</span>
                  <span style={styles.telemetryValue}>Worker P12 (87% conf)</span>
                </div>
                <div style={styles.telemetryRow}>
                  <span style={styles.telemetryLabel}>Speed:</span>
                  <span style={styles.telemetryValue}>14.2 km/h</span>
                </div>
                <div style={styles.telemetryRow}>
                  <span style={styles.telemetryLabel}>Separation Distance:</span>
                  <span style={styles.telemetryValue}>4.8 m (Closing)</span>
                </div>
              </div>

              {/* Risk Assessment Column */}
              <div style={styles.telemetryCard}>
                <h4 style={styles.telemetryCardTitle}>Risk Assessment</h4>
                <div style={styles.telemetryRow}>
                  <span style={styles.telemetryLabel}>Time-to-Collision:</span>
                  <span style={{ ...styles.telemetryValue, color: '#dc2626', fontWeight: 800 }}>{currentIncident.etaPillText}</span>
                </div>
                <div style={styles.telemetryRow}>
                  <span style={styles.telemetryLabel}>Conflict Probability:</span>
                  <span style={{ ...styles.telemetryValue, color: '#dc2626' }}>94.2%</span>
                </div>
                <div style={styles.telemetryRow}>
                  <span style={styles.telemetryLabel}>Predicted Trajectory:</span>
                  <span style={styles.telemetryValue}>Zone A → Zone B Breach</span>
                </div>
                <div style={styles.telemetryRow}>
                  <span style={styles.telemetryLabel}>Safety Index:</span>
                  <span style={styles.telemetryValue}>0.18 / 1.0</span>
                </div>
              </div>

              {/* Response Agent Column */}
              <div style={styles.telemetryCard}>
                <h4 style={styles.telemetryCardTitle}>Response Agent</h4>
                <div style={styles.telemetryRow}>
                  <span style={styles.telemetryLabel}>Kiosk Audio Strobe:</span>
                  <span style={{ ...styles.telemetryValue, color: '#16a34a' }}>DISPATCHED</span>
                </div>
                <div style={styles.telemetryRow}>
                  <span style={styles.telemetryLabel}>Forklift Interlock:</span>
                  <span style={{ ...styles.telemetryValue, color: '#dc2626' }}>EMERGENCY BRAKE ENGAGED</span>
                </div>
                <div style={styles.telemetryRow}>
                  <span style={styles.telemetryLabel}>Supervisor Alert:</span>
                  <span style={styles.telemetryValue}>Push Notification Sent</span>
                </div>
                <div style={styles.telemetryRow}>
                  <span style={styles.telemetryLabel}>Incident ID:</span>
                  <span style={styles.telemetryValue}>#INC-2026-0905-01</span>
                </div>
              </div>
            </div>

            <div style={styles.modalFooterRow}>
              <button style={styles.modalSecondaryBtn} onClick={() => handleOpenAnalysis(1)}>
                <FileText size={15} color="#1e3a8a" />
                <span>Open Full LLM Forensic Report</span>
              </button>
              <button style={styles.modalPrimaryBtn} onClick={() => setIsDetailsModalOpen(false)}>
                Close Telemetry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 2: FOOTAGE SELECTION MODAL                                  */}
      {/* ================================================================= */}
      {isVideoModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsVideoModalOpen(false)}>
          <div style={styles.footageModalBox} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeaderRow}>
              <div>
                <h3 style={styles.modalHeading}>Assign Camera Video Sources</h3>
                <p style={styles.modalSubheading}>Choose footage for Camera 1 (Entrance) and Camera 2 (Aisle 4)</p>
              </div>
              <button style={styles.modalCloseBtn} onClick={() => setIsVideoModalOpen(false)}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={styles.inputLabel}>Camera 1 Footage (Entrance):</label>
                <select
                  style={styles.selectInput}
                  value={selectedCamA}
                  onChange={e => setSelectedCamA(e.target.value)}
                >
                  {availableVideos.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={styles.inputLabel}>Camera 2 Footage (Aisle 4):</label>
                <select
                  style={styles.selectInput}
                  value={selectedCamB}
                  onChange={e => setSelectedCamB(e.target.value)}
                >
                  {availableVideos.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.modalFooterRow}>
              <button style={styles.modalSecondaryBtn} onClick={() => setIsVideoModalOpen(false)}>
                Cancel
              </button>
              <button style={styles.modalPrimaryBtn} onClick={handleApplyVideos}>
                Apply Video Sources
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 3: LLM FORENSIC REPORT MODAL                                */}
      {/* ================================================================= */}
      {analysisModalIncident && (
        <div style={styles.modalOverlay} onClick={() => setAnalysisModalIncident(null)}>
          <div style={styles.detailsModalBox} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeaderRow}>
              <div>
                <h3 style={styles.modalHeading}>LLM Incident Forensic Investigation</h3>
                <p style={styles.modalSubheading}>Multi-Agent reasoning log for Incident #{analysisModalIncident.id}</p>
              </div>
              <button style={styles.modalCloseBtn} onClick={() => setAnalysisModalIncident(null)}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <div style={{ marginTop: 16, maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={styles.telemetryCard}>
                <h4 style={styles.telemetryCardTitle}>Perception Agent Root Cause</h4>
                <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                  {analysisModalIncident.root_cause || 'Vehicle V01 entered Zone B without stopping at yellow demarcation line. Pedestrian P12 had back turned toward the inbound aisle.'}
                </p>
              </div>

              <div style={{ ...styles.telemetryCard, marginTop: 12 }}>
                <h4 style={styles.telemetryCardTitle}>OSHA / Regulatory Safety Impact</h4>
                <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                  {analysisModalIncident.regulatory_impact || 'Potential violation of OSHA 1910.178(m)(2) regarding safe clearance distances and right-of-way in blind aisle intersections.'}
                </p>
              </div>

              <div style={{ ...styles.telemetryCard, marginTop: 12 }}>
                <h4 style={styles.telemetryCardTitle}>Preventative Recommendations</h4>
                <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                  {analysisModalIncident.recommendations || 'Install additional HAWK Zone Kiosk visual strobe at blind corner. Mandate speed governor threshold 8 km/h in Sector B.'}
                </p>
              </div>
            </div>

            <div style={styles.modalFooterRow}>
              <button style={styles.modalPrimaryBtn} onClick={() => setAnalysisModalIncident(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// STYLES OBJECT — PIXEL PERFECT REPRODUCTION OF THE UPLOADED DESIGN        //
// =========================================================================
const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    minHeight: '100vh',
    height: '100%',
    backgroundColor: '#f0f4f9',
    color: '#0f172a',
    fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    overflowY: 'auto',
    overflowX: 'hidden',
    boxSizing: 'border-box',
    userSelect: 'none',
  },

  // -----------------------------------------------------------------------
  // TOP NAVBAR STYLES
  // -----------------------------------------------------------------------
  navBar: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 24px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
    flexShrink: 0,
    height: '62px',
    boxSizing: 'border-box',
    gap: '16px',
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  hawkLogo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: '21px',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.5px',
  },
  brandTagline: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#64748b',
    marginLeft: '6px',
    letterSpacing: '-0.1px',
  },
  sitePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '6px 14px',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  siteTextCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  siteName: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#0f172a',
    lineHeight: '1.2',
  },
  siteSub: {
    fontSize: '10px',
    color: '#64748b',
    lineHeight: '1.2',
  },

  // Center Controls
  navCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  scenarioBar: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: '3px',
    borderRadius: '24px',
    gap: '3px',
    border: '1px solid #e2e8f0',
  },
  scenarioBtn: {
    padding: '5px 12px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#475569',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '18px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  },
  scenarioBtnActive: {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.2)',
  },
  scenarioUtilityBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#64748b',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  // Right Nav Items
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  soundToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  weatherWidget: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  weatherCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  weatherTemp: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#0f172a',
    lineHeight: '1.2',
  },
  weatherCondition: {
    fontSize: '10px',
    color: '#64748b',
    lineHeight: '1.2',
  },
  clockCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    minWidth: '78px',
  },
  clockDate: {
    fontSize: '10px',
    color: '#64748b',
    lineHeight: '1.2',
  },
  clockTime: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.3px',
    lineHeight: '1.2',
  },
  bellBtn: {
    position: 'relative',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  bellBadge: {
    position: 'absolute',
    top: '-3px',
    right: '-3px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: '9px',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #ffffff',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px 4px 4px',
    borderRadius: '24px',
    cursor: 'pointer',
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#64748b',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  userName: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#0f172a',
    lineHeight: '1.2',
  },
  userRole: {
    fontSize: '10px',
    color: '#64748b',
    lineHeight: '1.2',
  },

  // -----------------------------------------------------------------------
  // MAIN WORKSPACE LAYOUT
  // -----------------------------------------------------------------------
  mainContent: {
    display: 'flex',
    flex: 1,
    padding: '14px 24px 30px 24px',
    gap: '20px',
    overflow: 'visible',
    boxSizing: 'border-box',
  },

  // -----------------------------------------------------------------------
  // LEFT COLUMN: LIVE MONITORING
  // -----------------------------------------------------------------------
  leftCol: {
    flex: '1.5',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  liveMonitoringHeader: {
    marginBottom: '10px',
  },
  liveHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  liveHeading: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.4px',
    margin: 0,
  },
  systemsOnlinePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#10b981',
    fontSize: '12px',
    fontWeight: 600,
  },
  greenPulseDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 8px #10b981',
  },
  liveSubheading: {
    fontSize: '12px',
    color: '#64748b',
    margin: '2px 0 0 0',
  },

  camsStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  camCard: {
    position: 'relative',
    height: '350px',
    minHeight: '350px',
    backgroundColor: '#090d16',
    borderRadius: '18px',
    overflow: 'hidden',
    boxShadow: '0 4px 18px rgba(0, 0, 0, 0.08)',
    border: '1px solid rgba(226, 232, 240, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },

  // Camera Overlays
  camTopLeftPill: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '10px',
    padding: '5px 12px',
    color: '#ffffff',
    fontSize: '12px',
    zIndex: 2,
  },
  camNumBold: {
    fontWeight: 700,
  },
  camLocText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: 500,
  },
  camLiveBadge: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: '#10b981',
    borderRadius: '6px',
    padding: '4px 10px',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.5px',
    boxShadow: '0 2px 6px rgba(16, 185, 129, 0.4)',
    zIndex: 2,
  },
  whiteDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
  },
  camBottomTimePill: {
    position: 'absolute',
    bottom: '12px',
    left: '12px',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    backdropFilter: 'blur(6px)',
    borderRadius: '6px',
    padding: '4px 8px',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: 600,
    fontFamily: 'monospace',
    zIndex: 2,
  },
  camBottomRightControls: {
    position: 'absolute',
    bottom: '12px',
    right: '12px',
    display: 'flex',
    gap: '8px',
    zIndex: 2,
  },
  camIconBtn: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },

  // -----------------------------------------------------------------------
  // RIGHT COLUMN: 3 CARDS STACKED
  // -----------------------------------------------------------------------
  rightCol: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    minWidth: '380px',
    maxWidth: '520px',
  },

  // CARD 1: ACTIVE INCIDENT
  incidentCard: {
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '16px 20px',
    border: '1px solid rgba(226, 232, 240, 0.8)',
    boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  incidentCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  incidentHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  incidentIconWrap: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    backgroundColor: '#fee2e2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incidentBadgeTitle: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#ef4444',
    letterSpacing: '0.4px',
  },
  etaPill: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '12px',
    padding: '3px 10px',
    fontSize: '11px',
    fontWeight: 700,
  },
  incidentContentRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '14px',
  },
  incidentTextCol: {
    flex: 1,
  },
  incidentHeading: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#0f172a',
    margin: '0 0 4px 0',
    lineHeight: '1.25',
    letterSpacing: '-0.3px',
  },
  incidentDescriptionText: {
    fontSize: '11.5px',
    color: '#475569',
    lineHeight: '1.45',
    margin: 0,
  },
  incidentThumbBox: {
    width: '64px',
    height: '64px',
    borderRadius: '12px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  incidentThumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  incidentMetaRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '6px',
    borderTop: '1px solid #f1f5f9',
  },
  incidentMetaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  incidentMetaDark: {
    fontSize: '11.5px',
    fontWeight: 700,
    color: '#0f172a',
  },
  incidentMetaMuted: {
    fontSize: '11.5px',
    fontWeight: 500,
    color: '#64748b',
  },
  incidentRiskPill: {
    borderRadius: '8px',
    padding: '3px 8px',
    fontSize: '10.5px',
    fontWeight: 800,
    letterSpacing: '0.2px',
  },
  incidentActionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '2px',
  },
  viewDetailsBtn: {
    flex: 1,
    padding: '8px 14px',
    borderRadius: '12px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    color: '#1e293b',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
    textAlign: 'center',
    transition: 'background-color 0.15s ease',
  },
  autoDispatchedBadge: {
    flex: '1.2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: '12px',
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
    color: '#047857',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.01em',
  },
  replayAudioBtn: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  // CARD 2: SITE MAP
  siteMapCard: {
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '14px 18px',
    border: '1px solid rgba(226, 232, 240, 0.8)',
    boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  siteMapHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  siteMapTitle: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
  },
  zonesDropdownWrap: {
    position: 'relative',
  },
  zonesDropdownBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
  },
  zonesDropdownMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '4px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
    zIndex: 10,
    minWidth: '140px',
    overflow: 'hidden',
  },
  zonesDropdownItem: {
    padding: '7px 12px',
    fontSize: '11.5px',
    color: '#1e293b',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  siteMapCanvasContainer: {
    position: 'relative',
    width: '100%',
    height: '145px',
    borderRadius: '14px',
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  siteMapImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  mapHeatmapGlow: {
    position: 'absolute',
    top: '25%',
    left: '42%',
    width: '120px',
    height: '80px',
    borderRadius: '50%',
    filter: 'blur(12px)',
    pointerEvents: 'none',
    transition: 'background 0.5s ease',
  },
  floatingCamBadge: {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    backdropFilter: 'blur(6px)',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '3px 8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  floatingCamTextCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  floatingCamName: {
    fontSize: '9.5px',
    fontWeight: 800,
    color: '#0f172a',
    lineHeight: '1.1',
  },
  floatingCamLoc: {
    fontSize: '8.5px',
    color: '#64748b',
    lineHeight: '1.1',
  },
  mapLegendBox: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(6px)',
    borderRadius: '8px',
    padding: '4px 8px',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '9px',
    fontWeight: 600,
    color: '#334155',
  },
  legendDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  compassBox: {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    color: '#1e3a8a',
  },
  compassArrow: {
    fontSize: '12px',
    lineHeight: '1',
  },
  compassLetter: {
    fontSize: '9px',
    fontWeight: 800,
    lineHeight: '1',
  },

  // CARD 3: RECENT ALERTS
  recentAlertsCard: {
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '14px 18px',
    border: '1px solid rgba(226, 232, 240, 0.8)',
    boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
  },
  recentAlertsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentAlertsTitle: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
  },
  viewAllBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#2563eb',
    fontSize: '11.5px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
  },
  alertList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  alertItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 0',
    borderBottom: '1px solid #f8fafc',
  },
  alertIconCircle: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  alertItemMiddle: {
    flex: 1,
  },
  alertItemTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#0f172a',
    lineHeight: '1.25',
  },
  alertItemSubtitle: {
    fontSize: '10.5px',
    color: '#64748b',
    lineHeight: '1.25',
  },
  alertItemRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '3px',
  },
  alertTimeText: {
    fontSize: '10px',
    color: '#94a3b8',
  },
  alertSevBadge: {
    fontSize: '9.5px',
    fontWeight: 800,
    borderRadius: '5px',
    padding: '2px 6px',
    letterSpacing: '0.2px',
  },

  // -----------------------------------------------------------------------
  // MINIMAL FOOTER
  // -----------------------------------------------------------------------
  footerBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 24px',
    borderTop: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    flexShrink: 0,
    height: '34px',
    boxSizing: 'border-box',
  },
  footerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  footerBrand: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#0f172a',
  },
  footerTagline: {
    fontSize: '11px',
    color: '#64748b',
  },
  footerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  footerPulseDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
  },
  footerStatusText: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#64748b',
  },

  // -----------------------------------------------------------------------
  // MODALS
  // -----------------------------------------------------------------------
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  detailsModalBox: {
    width: '680px',
    maxWidth: '92vw',
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 20px 50px rgba(15, 23, 42, 0.15)',
    border: '1px solid #e2e8f0',
  },
  footageModalBox: {
    width: '500px',
    maxWidth: '92vw',
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 20px 50px rgba(15, 23, 42, 0.15)',
    border: '1px solid #e2e8f0',
  },
  modalHeaderRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '14px',
  },
  modalHeading: {
    fontSize: '17px',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
  },
  modalSubheading: {
    fontSize: '12px',
    color: '#64748b',
    margin: '4px 0 0 0',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
  },
  modalBodyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '14px',
    marginTop: '16px',
  },
  telemetryCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '12px',
  },
  telemetryCardTitle: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#1e293b',
    margin: '0 0 10px 0',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '6px',
  },
  telemetryRow: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '8px',
  },
  telemetryLabel: {
    fontSize: '10.5px',
    color: '#64748b',
  },
  telemetryValue: {
    fontSize: '11.5px',
    fontWeight: 700,
    color: '#0f172a',
  },
  modalFooterRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
    paddingTop: '14px',
    borderTop: '1px solid #f1f5f9',
  },
  modalSecondaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '10px',
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
    color: '#1e293b',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalPrimaryBtn: {
    padding: '8px 18px',
    borderRadius: '10px',
    backgroundColor: '#0f172a',
    border: 'none',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  inputLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 700,
    color: '#334155',
    marginBottom: '6px',
  },
  selectInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    fontSize: '12px',
    color: '#0f172a',
    boxSizing: 'border-box',
  },
};
