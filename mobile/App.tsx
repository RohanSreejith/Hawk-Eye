import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  Image,
  Vibration,
  SafeAreaView,
  StatusBar,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Incident {
  id: number;
  event_id: string;
  camera_id: string;
  event_type: string;
  severity: string;
  description: string;
  zone: string;
  timestamp: string;
  status: string;
  snapshot_url?: string;
  clip_url?: string;
  worker_id?: string;
  equipment_id?: string;
}

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

interface IncidentAnalysis {
  incident_id: number;
  event_id: string;
  event_type: string;
  zone: string;
  camera_id: string;
  severity: string;
  timestamp: string;
  summary: string;
  clip_url: string;
  alt_clip_url?: string;
  sync_clip_url?: string;
  timeline: { time: string; step: string; detail: string }[];
  root_cause: string;
  osha_regulation: string;
  corrective_actions: string[];
  analyzed_by: string;
}

export default function App() {
  const [hostIp, setHostIp] = useState('10.0.21.250');
  const [port, setPort] = useState('8001');
  const [isConnected, setIsConnected] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [hawkState, setHawkState] = useState<HawkState | null>(null);
  const [activeAlert, setActiveAlert] = useState<Incident | null>(null);
  const [selectedIncidentAnalysis, setSelectedIncidentAnalysis] = useState<IncidentAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFootageModalOpen, setIsFootageModalOpen] = useState(false);
  const [availableVideos, setAvailableVideos] = useState<string[]>([]);
  const [selectedCamA, setSelectedCamA] = useState('');
  const [selectedCamB, setSelectedCamB] = useState('');
  const [tempIp, setTempIp] = useState(hostIp);
  const [streamVersion, setStreamVersion] = useState(0);

  const activeAlertRef = useRef<Incident | null>(null);
  const dismissedAlertsRef = useRef<Set<string>>(new Set());
  const seenIncidentIdsRef = useRef<Set<number | string>>(new Set());
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const apiBase = `http://${hostIp}:${port}/api`;
  const wsUrl = `ws://${hostIp}:${port}/ws`;

  const setAlert = (inc: Incident | null, shouldVibrate = true) => {
    if (inc) {
      // If supervisor explicitly dismissed this alert, do not re-alert
      if (dismissedAlertsRef.current.has(inc.event_id)) {
        return;
      }
      // If already active with this same event, ignore repeated spam
      if (activeAlertRef.current?.event_id === inc.event_id) {
        return;
      }
    }

    activeAlertRef.current = inc;
    setActiveAlert(inc);

    if (inc && inc.status !== 'resolved' && shouldVibrate) {
      try {
        Vibration.vibrate([0, 500, 200, 500]);
      } catch (e) {}
    } else if (!inc) {
      try {
        Vibration.cancel();
      } catch (e) {}
    }
  };

  const dismissAlert = () => {
    if (activeAlertRef.current) {
      dismissedAlertsRef.current.add(activeAlertRef.current.event_id);
    }
    setAlert(null, false);
  };

  useEffect(() => {
    connectWebSocket();
    fetchInitialData();
    fetchHawkState();
    fetchAvailableVideos();

    const interval = setInterval(() => {
      fetchHawkState();
      syncIncidents();
    }, 2500);

    return () => {
      clearInterval(interval);
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [hostIp, port]);

  const connectWebSocket = () => {
    try {
      if (socketRef.current) socketRef.current.close();
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'hawk_state_updated') {
            setHawkState(data.hawk_state);
            const kiosk = data.hawk_state?.safety_kiosk;
            if (kiosk?.active) {
              const kioskEventId = `HAWK-KIOSK-${kiosk.title || 'ALERT'}`;
              if (!dismissedAlertsRef.current.has(kioskEventId)) {
                setAlert({
                  id: 999999,
                  event_id: kioskEventId,
                  camera_id: 'CAM_B',
                  event_type: kiosk.title || 'Safety Alert',
                  severity: kiosk.severity || 'critical',
                  description: `${kiosk.message}. ${kiosk.subtext || ''}`,
                  zone: kiosk.zone || 'Zone B',
                  timestamp: kiosk.timestamp || new Date().toLocaleTimeString(),
                  status: 'active',
                }, true);
              }
            } else if (kiosk && !kiosk.active) {
              const current = activeAlertRef.current;
              if (current && current.event_id?.startsWith('HAWK-KIOSK-')) {
                setAlert(null, false);
              }
            }
          } else if (data.type === 'incident_created') {
            if (data.incident) {
              const inc: Incident = data.incident;
              if (!seenIncidentIdsRef.current.has(inc.id)) {
                seenIncidentIdsRef.current.add(inc.id);
                setIncidents((prev) => [inc, ...prev.filter((i) => i.id !== inc.id)].slice(0, 20));
                setAlert(inc, true);
              }
            }
          } else if (data.type === 'incident_updated') {
            const { incident_id, status } = data;
            setIncidents((prev) =>
              prev.map((i) => (i.id === incident_id ? { ...i, status } : i))
            );
            const current = activeAlertRef.current;
            if (current && current.id === incident_id) {
              if (status === 'resolved') {
                setAlert(null, false);
              } else {
                setAlert({ ...current, status }, false);
              }
            }
          }
        } catch (e) {}
      };

      ws.onerror = () => setIsConnected(false);
      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      };
      socketRef.current = ws;
    } catch (e) {
      setIsConnected(false);
    }
  };

  const fetchHawkState = async () => {
    try {
      const res = await fetch(`${apiBase}/hawk/state`);
      if (res.ok) {
        const data = await res.json();
        setHawkState(data);
        if (data.safety_kiosk?.active) {
          const kiosk = data.safety_kiosk;
          const kioskEventId = `HAWK-KIOSK-${kiosk.title || 'ALERT'}`;
          if (!dismissedAlertsRef.current.has(kioskEventId)) {
            setAlert({
              id: 999999,
              event_id: kioskEventId,
              camera_id: 'CAM_B',
              event_type: kiosk.title || 'Safety Alert',
              severity: kiosk.severity || 'critical',
              description: `${kiosk.message}. ${kiosk.subtext || ''}`,
              zone: kiosk.zone || 'Zone B',
              timestamp: kiosk.timestamp || new Date().toLocaleTimeString(),
              status: 'active',
            }, true);
          }
        } else if (data.safety_kiosk && !data.safety_kiosk.active) {
          const current = activeAlertRef.current;
          if (current && current.event_id?.startsWith('HAWK-KIOSK-')) {
            setAlert(null, false);
          }
        }
      }
    } catch (e) {}
  };

  const fetchAvailableVideos = async () => {
    try {
      const res = await fetch(`${apiBase}/hawk/videos`);
      if (res.ok) {
        const data = await res.json();
        setAvailableVideos(data.videos || []);
        if (data.current_camera_a) setSelectedCamA(data.current_camera_a);
        if (data.current_camera_b) setSelectedCamB(data.current_camera_b);
      }
    } catch (e) {}
  };

  const fetchInitialData = async () => {
    try {
      const incRes = await fetch(`${apiBase}/incidents?limit=15`);
      if (incRes.ok) {
        const data = await incRes.json();
        if (Array.isArray(data)) {
          // Mark all existing historical incidents as seen so they never trigger alert notifications
          data.forEach((i: Incident) => seenIncidentIdsRef.current.add(i.id));
          setIncidents(data.slice(0, 15));
        }
      }
    } catch (e) {}
  };

  const syncIncidents = async () => {
    try {
      const incRes = await fetch(`${apiBase}/incidents?limit=15`);
      if (incRes.ok) {
        const data = await incRes.json();
        if (Array.isArray(data)) {
          setIncidents(data.slice(0, 15));
          // Only alert if a genuinely new live incident arrives
          const brandNew = data.find(
            (i: Incident) => !seenIncidentIdsRef.current.has(i.id) && i.status !== 'resolved'
          );
          if (brandNew) {
            seenIncidentIdsRef.current.add(brandNew.id);
            setAlert(brandNew, true);
          }
        }
      }
    } catch (e) {}
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await syncIncidents();
    await fetchHawkState();
    setStreamVersion((v) => v + 1);
    setRefreshing(false);
  };

  const triggerScenarioStep = async (step: number) => {
    // Instant optimistic alert feedback on mobile
    if (step === 3) {
      dismissedAlertsRef.current.delete('HAWK-MACHINERY');
      dismissedAlertsRef.current.delete('HAWK-KIOSK-HEAVY MACHINERY APPROACHING');
      setAlert({
        id: Date.now(),
        event_id: 'HAWK-MACHINERY',
        camera_id: 'CAM_B',
        event_type: 'HEAVY MACHINERY APPROACHING',
        severity: 'warning',
        description: 'Heavy machinery approaching entrance! Move out of the way immediately!',
        zone: 'Entrance Doorway (Zone A -> Zone B)',
        timestamp: new Date().toLocaleTimeString(),
        status: 'active',
      }, true);
    } else if (step === 2 || step === 4) {
      dismissedAlertsRef.current.delete('HAWK-INBOUND');
      setAlert({
        id: Date.now(),
        event_id: 'HAWK-INBOUND',
        camera_id: 'CAM_B',
        event_type: 'VEHICLE APPROACHING',
        severity: 'warning',
        description: 'Vehicle V01 inbound to Zone B. Maintain safe clearance.',
        zone: 'Zone B',
        timestamp: new Date().toLocaleTimeString(),
        status: 'active',
      }, true);
    } else if (step === 5) {
      dismissedAlertsRef.current.delete('HAWK-CRITICAL');
      setAlert({
        id: Date.now(),
        event_id: 'HAWK-CRITICAL',
        camera_id: 'CAM_B',
        event_type: 'COLLISION HAZARD - STOP',
        severity: 'critical',
        description: 'Forklift V01 collision event in Zone B! Emergency brake engaged.',
        zone: 'Zone B',
        timestamp: new Date().toLocaleTimeString(),
        status: 'active',
      }, true);
    } else if (step === 7) {
      dismissedAlertsRef.current.delete('HAWK-FIRE');
      setAlert({
        id: Date.now(),
        event_id: 'HAWK-FIRE',
        camera_id: 'CAM_B',
        event_type: 'FIRE EMERGENCY - EVACUATE',
        severity: 'critical',
        description: 'Active thermal anomaly & fire outbreak in Zone B! Immediate evacuation ordered.',
        zone: 'Zone B',
        timestamp: new Date().toLocaleTimeString(),
        status: 'active',
      }, true);
    } else if (step === 1 || step === 6) {
      dismissAlert();
    }

    try {
      await fetch(`${apiBase}/hawk/trigger-scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      });
      fetchHawkState();
    } catch (e) {}
  };

  const handleApplyFootage = async () => {
    try {
      await fetch(`${apiBase}/hawk/select-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camera_a: selectedCamA,
          camera_b: selectedCamB,
        }),
      });
      setIsFootageModalOpen(false);
      fetchHawkState();
      setStreamVersion((v) => v + 1);
    } catch (e) {}
  };

  const openIncidentAnalysis = async (incident: Incident) => {
    setAnalysisLoading(true);
    try {
      const evParam = encodeURIComponent(incident.event_type || '');
      const res = await fetch(`${apiBase}/hawk/incidents/${incident.id}/analysis?event_type=${evParam}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedIncidentAnalysis(data);
      } else {
        // Domain-accurate scenario reporting matching HAWK AI Safety Engine
        const evType = (incident.event_type || '').toUpperCase();
        const descUpper = (incident.description || '').toUpperCase();
        const combined = `${evType} ${descUpper}`;

        const isFire = combined.includes('FIRE') || combined.includes('THERMAL') || combined.includes('COMBUSTION') || combined.includes('SMOKE');
        const isPPE = combined.includes('HELMET') || combined.includes('PPE') || combined.includes('VEST') || combined.includes('GEAR');
        const isCollision = combined.includes('COLLISION') || combined.includes('BRAKE') || combined.includes('IMPACT');
        const isMachinery = combined.includes('MACHINERY') || combined.includes('ENTRANCE') || combined.includes('DOORWAY') || combined.includes('OUTSIDE');

        let clipUrl = '/videos/worker_at_entrance_inside.mp4';
        let altClipUrl: string | undefined = undefined;
        let syncClipUrl: string | undefined = undefined;
        let timeline: Array<{ time: string; step: string; detail: string }> = [];
        let rootCause = '';
        let oshaReg = '';
        let correctiveActions: string[] = [];

        if (isFire) {
          clipUrl = '/videos/Create_a_photorealistic_–_.mp4';
          altClipUrl = '/videos/fire-rgb-00000/00023b5323028ab83e67_run_6_seed_1486583949.ceiling_00.rgb.mp4';
          timeline = [
            { time: 'T - 6.0s', step: 'Thermal Plume Detected', detail: 'Optical thermal sensor on Ceiling Cam flagged rapid infrared expansion (>65°C) in Bay 4.' },
            { time: 'T - 4.2s', step: 'Smoke Diffusion Verification', detail: 'Computer vision model verified smoke cloud propagation across ceiling rafters and inventory racks.' },
            { time: 'T - 2.0s', step: 'Facility Emergency Strobe', detail: 'HAWK Safety Coordinator tripped emergency sirens, flashing strobes, and automated voice evacuation PA.' },
            { time: 'T + 0.0s', step: 'Fire Suppression Interlock', detail: 'HVAC fire dampers sealed, emergency exit magnetic doors released, and emergency response dispatched.' },
          ];
          rootCause = 'Thermal runaway or electrical short-circuit in adjacent palletized packaging materials generating rapid combustion and aerosolized smoke.';
          oshaReg = 'OSHA Standard 1910.36 & 1910.165 - Means of Egress, Emergency Action Plans and Employee Alarm Systems.';
          correctiveActions = [
            'Immediate evacuation of all Zone B personnel through Emergency Exit 3',
            'Deploy facility emergency response team and verify automated sprinkler actuation',
            'Conduct thermal scan of electrical switchboards and charging docks before zone re-entry',
          ];
        } else if (isPPE) {
          clipUrl = '/videos/worker_no_helmet.mp4';
          timeline = [
            { time: 'T - 4.8s', step: 'Worker Identification', detail: 'Camera B identified Worker P12 entering active loading and racking aisle from administrative vestibule.' },
            { time: 'T - 3.2s', step: 'PPE Compliance Scan', detail: 'Real-time PPE vision model detected absence of ANSI Z89.1 Hard Hat and ANSI/ISEA 107 High-Vis Vest.' },
            { time: 'T - 1.1s', step: 'Kiosk & Audio Directive', detail: "Zone B Safety Kiosk broadcasted localized audio directive: 'Mandatory safety gear required. Secure head & body protection.'" },
            { time: 'T + 0.0s', step: 'Compliance Ticket Dispatched', detail: 'Supervisor mobile terminal alerted; compliance infraction recorded to shift safety log.' },
          ];
          rootCause = 'Worker entered designated high-risk material handling and racking zone without donning required Type 1 hardhat and high-visibility reflective vest.';
          oshaReg = 'OSHA Standard 1910.132(a) & 1910.135(a)(1) - Personal Protective Equipment & Head Protection in Industrial Operating Zones.';
          correctiveActions = [
            'Position mandatory PPE checkpoint signage and optical scan gate at Zone B portal entrance',
            'Issue worker safety compliance reminder via supervisor terminal',
            'Verify stock of replacement hardhats and vests at entrance staging rack',
          ];
        } else if (isCollision) {
          clipUrl = '/videos/05761a14cf211fdb7562_run_21_seed_742094177.eye_00.rgb.mp4';
          altClipUrl = '/videos/05761a14cf211fdb7562_run_21_seed_742094177.ceiling_01.rgb.mp4';
          timeline = [
            { time: 'T - 4.1s', step: 'Trajectory Conflict Lock', detail: 'Eye-level and ceiling cameras detected Forklift V01 on direct intercept path with pedestrian workspace.' },
            { time: 'T - 2.8s', step: 'Hazard Escalation Alarm', detail: 'Time-to-impact calculated at < 2.0s; zone hazard level escalated to CRITICAL.' },
            { time: 'T - 1.2s', step: 'Emergency Brake Broadcast', detail: 'Telemetry interlock command dispatched to vehicle; high-intensity strobe and klaxon activated.' },
            { time: 'T + 0.0s', step: 'Autonomous Interlock Halt', detail: 'Vehicle autonomous braking arrested momentum within 0.3m standoff of worker; impact averted.' },
          ];
          rootCause = 'Operator forward line-of-sight obstructed by elevated pallet load combined with delayed pedestrian recognition of vehicle approach path.';
          oshaReg = 'OSHA Standard 1910.178(n)(6) & 1910.178(o)(1) - Safe Forklift Loading, Obstructed Forward Visibility & Autonomous Stop Interlocks.';
          correctiveActions = [
            'Perform immediate mechanical and electronic lockout/tagout (LOTO) inspection on Forklift V01',
            'Re-train material handling operators on mandatory reverse travel when carrying vision-obscuring loads',
            'Require supervisor physical inspection and clearance sign-off prior to releasing zone',
          ];
        } else if (isMachinery) {
          clipUrl = '/videos/worker_at_entrance_inside.mp4';
          altClipUrl = '/videos/forklift_approaching_entrance.mp4';
          syncClipUrl = '/videos/machinery_warn_evidence_sync.mp4';
          timeline = [
            { time: 'T - 5.2s', step: 'Entrance Detection', detail: 'Outside Camera identified Forklift V01 accelerating in transit toward entrance doorway.' },
            { time: 'T - 3.8s', step: 'Perception Broadcast', detail: 'Inbound trajectory published across multi-agent shared state to interior camera.' },
            { time: 'T - 2.5s', step: 'Proactive Hazard Anticipation', detail: 'Agent B received inbound telemetry while vehicle was obscured behind wall, correlating presence of Worker P12.' },
            { time: 'T - 1.1s', step: 'Doorway Clearance Warning', detail: 'Safety Kiosk and mobile alert issued to worker standing at doorway threshold.' },
            { time: 'T + 0.0s', step: 'Safe Standoff Established', detail: 'Worker stepped back behind yellow clearance line; collision averted.' },
          ];
          rootCause = 'Blind corner doorway entrance connecting exterior yard to warehouse corridor with lack of audible early approach beacon on heavy equipment.';
          oshaReg = 'OSHA Standard 1910.178(n)(4) - Powered Industrial Trucks Safe Navigation, Blind Intersections & Horn Standoff.';
          correctiveActions = [
            'Direct personnel away from entrance apron during active vehicle transit cycles',
            'Deploy blue floor projection spotlight and acoustic threshold horn at blind doorway',
          ];
        } else {
          // General vehicle-person proximity / nearmiss
          clipUrl = '/videos/nearmiss-rgb-00000/001e53453441935632ae_run_1_seed_1288693302.ceiling_01.rgb.mp4';
          altClipUrl = '/videos/nearmiss-rgb-00000/001e53453441935632ae_run_1_seed_1288693302.ceiling_00.rgb.mp4';
          timeline = [
            { time: 'T - 5.0s', step: 'Trajectory Tracking', detail: 'Overhead Camera detected Forklift V01 advancing down central aisle with cargo.' },
            { time: 'T - 3.4s', step: 'Spatial Convergence', detail: 'Distance vector to Worker P12 rapidly narrowed to less than 2.0 meters.' },
            { time: 'T - 1.8s', step: 'Hazard Proximity Alert', detail: 'HAWK Safety Engine calculated 88% collision probability; kiosk flashed caution strobe.' },
            { time: 'T + 0.0s', step: 'Standoff Intervention', detail: 'Vehicle operator alerted via audio chime and reduced velocity; clearance restored.' },
          ];
          rootCause = 'Shared pedestrian and powered industrial equipment corridor with partial sightline obstruction from stacked pallet shelving.';
          oshaReg = 'OSHA Standard 1910.178(m)(2) - Powered Industrial Trucks Clearance & Pedestrian Standoff in Shared Aisles.';
          correctiveActions = [
            'Install wide-angle parabolic dome mirrors at Zone A/B portal entrance',
            'Verify floor laser line projection defining pedestrian safe walking zones',
            'Equip high-traffic loading aisles with active optical sensor gates',
          ];
        }

        setSelectedIncidentAnalysis({
          incident_id: incident.id,
          event_id: incident.event_id,
          event_type: incident.event_type,
          zone: incident.zone || 'Entrance Doorway (Zone A -> Zone B)',
          camera_id: incident.camera_id || 'CAM_B',
          severity: incident.severity || 'warning',
          timestamp: incident.timestamp || '10:24:17',
          summary: incident.description,
          clip_url: clipUrl,
          alt_clip_url: altClipUrl,
          sync_clip_url: syncClipUrl,
          timeline,
          root_cause: rootCause,
          osha_regulation: oshaReg,
          corrective_actions: correctiveActions,
          analyzed_by: 'HAWK AI Safety Officer',
        });
      }
    } catch (e) {
      console.warn('Failed to load analysis:', e);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await fetch(`${apiBase}/incidents/${id}/resolve`, { method: 'POST' });
      setAlert(null);
      if (selectedIncidentAnalysis?.incident_id === id) {
        setSelectedIncidentAnalysis(null);
      }
      fetchInitialData();
      triggerScenarioStep(1);
    } catch (e) {}
  };

  const risk = hawkState?.risk_assessment;
  const kiosk = hawkState?.safety_kiosk;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Top Supervisor Header — Clean Light Theme */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.badgeIcon}>
            <MaterialCommunityIcons name="shield-check" size={20} color="#2563eb" />
          </View>
          <View>
            <Text style={styles.brandTitle}>HAWK SUPERVISOR</Text>
            <Text style={styles.brandSubtitle}>PORTABLE SAFETY KIOSK & MULTI-AGENT TERMINAL</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <View
            style={[
              styles.connectionPill,
              { backgroundColor: isConnected ? '#ecfdf5' : '#fee2e2' },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: isConnected ? '#10b981' : '#ef4444' }]} />
            <Text style={[styles.connectionText, { color: isConnected ? '#047857' : '#b91c1c' }]}>
              {isConnected ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => {
              setTempIp(hostIp);
              setIsSettingsOpen(true);
            }}
          >
            <Feather name="settings" size={17} color="#475569" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ======================================================== */}
      {/* REAL-TIME SAFETY KIOSK ALERT BANNER (Matching Kiosk UI)   */}
      {/* ======================================================== */}
      {activeAlert && activeAlert.status !== 'resolved' ? (
        <View
          style={[
            styles.kioskAlertBanner,
            activeAlert.severity === 'critical'
              ? styles.kioskAlertCritical
              : activeAlert.event_type.toUpperCase().includes('FIRE')
              ? styles.kioskAlertFire
              : styles.kioskAlertWarning,
          ]}
        >
          <View style={styles.kioskAlertTopRow}>
            <View style={styles.kioskIconBadge}>
              <MaterialCommunityIcons
                name={
                  activeAlert.event_type.toUpperCase().includes('FIRE')
                    ? 'fire-alert'
                    : 'alert-octagon'
                }
                size={22}
                color="#ffffff"
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.kioskPillsRow}>
                <View style={styles.kioskTypePill}>
                  <Text style={styles.kioskTypePillText}>
                    {activeAlert.severity === 'critical' ? 'CRITICAL HAZARD' : 'PROACTIVE WARNING'}
                  </Text>
                </View>
                <View style={styles.kioskAutoPill}>
                  <Feather name="radio" size={11} color="#059669" />
                  <Text style={styles.kioskAutoPillText}>Auto-Dispatched</Text>
                </View>
              </View>
              <Text style={styles.kioskAlertTitle}>{activeAlert.event_type}</Text>
            </View>
            <TouchableOpacity onPress={() => dismissAlert()} style={styles.kioskDismissBtn}>
              <Ionicons name="close" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          <Text style={styles.kioskAlertDesc}>{activeAlert.description}</Text>

          <View style={styles.kioskAlertBottomRow}>
            <View style={styles.kioskZoneTag}>
              <Feather name="map-pin" size={12} color="#475569" />
              <Text style={styles.kioskZoneTagText}>{activeAlert.zone || 'Zone B (Loading Area)'}</Text>
            </View>

            <View style={styles.kioskActionBtns}>
              <TouchableOpacity
                style={styles.kioskInspectBtn}
                onPress={() => openIncidentAnalysis(activeAlert)}
              >
                <Feather name="play-circle" size={13} color="#2563eb" />
                <Text style={styles.kioskInspectBtnText}>View Clip & Analysis</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.kioskClearBtn}
                onPress={() => {
                  dismissAlert();
                  triggerScenarioStep(1);
                }}
              >
                <Feather name="check" size={13} color="#ffffff" />
                <Text style={styles.kioskClearBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.kioskAllClearBanner}>
          <View style={styles.kioskClearIconWrap}>
            <Feather name="check-circle" size={20} color="#10b981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kioskClearTitle}>SAFETY KIOSK ALL CLEAR</Text>
            <Text style={styles.kioskClearSub}>All zones compliant • Multi-Agent radar active</Text>
          </View>
          <View style={styles.kioskClearTag}>
            <Text style={styles.kioskClearTagText}>NORMAL OPERATIONS</Text>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563eb"
            colors={['#2563eb']}
            progressBackgroundColor="#ffffff"
          />
        }
      >


        {/* Live Multi-Camera Stream Cards */}
        <View style={styles.cardContainer}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="video" size={15} color="#2563eb" />
              <Text style={styles.cardHeaderTitle}>LIVE MULTI-CAMERA STREAM</Text>
            </View>
            <TouchableOpacity
              style={styles.footagePickerLink}
              onPress={() => setIsFootageModalOpen(true)}
            >
              <Text style={styles.footagePickerLinkText}>Assign Videos</Text>
              <Feather name="chevron-right" size={13} color="#2563eb" />
            </TouchableOpacity>
          </View>

          <View style={styles.camsRow}>
            {/* Camera A Stream Card */}
            <View style={styles.camCard}>
              <View style={styles.camCardHeader}>
                <Text style={styles.camCardTitle}>Cam 1 (Entrance)</Text>
                <View style={styles.liveTagGreen}>
                  <Text style={styles.liveTagGreenText}>LIVE</Text>
                </View>
              </View>
              <View style={styles.camImageWrapper}>
                <Image
                  source={{ uri: `${apiBase}/hawk/camera/a/frame?v=${streamVersion}_${Date.now()}` }}
                  style={styles.camFeedImg}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.camFooterCaption} numberOfLines={1}>
                {hawkState?.cameras?.camera_a?.caption || 'Exterior Yard Approach'}
              </Text>
            </View>

            {/* Camera B Stream Card */}
            <View style={styles.camCard}>
              <View style={styles.camCardHeader}>
                <Text style={styles.camCardTitle}>Cam 2 (Aisle 4)</Text>
                <View style={styles.liveTagGreen}>
                  <Text style={styles.liveTagGreenText}>LIVE</Text>
                </View>
              </View>
              <View style={styles.camImageWrapper}>
                <Image
                  source={{ uri: `${apiBase}/hawk/camera/b/frame?v=${streamVersion}_${Date.now()}` }}
                  style={styles.camFeedImg}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.camFooterCaption} numberOfLines={1}>
                {hawkState?.cameras?.camera_b?.caption || 'Entrance Doorway Interior'}
              </Text>
            </View>
          </View>
        </View>

        {/* Telemetry & Risk Assessment Card */}
        <View style={styles.cardContainer}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeaderTitle}>HAWK SITUATIONAL ASSESSMENT</Text>
            <View
              style={[
                styles.riskLevelTag,
                {
                  backgroundColor:
                    risk?.overall_risk === 'CRITICAL'
                      ? '#fee2e2'
                      : risk?.overall_risk === 'HIGH'
                      ? '#ffedd5'
                      : '#ecfdf5',
                },
              ]}
            >
              <Text
                style={[
                  styles.riskLevelTagText,
                  {
                    color:
                      risk?.overall_risk === 'CRITICAL'
                        ? '#dc2626'
                        : risk?.overall_risk === 'HIGH'
                        ? '#ea580c'
                        : '#059669',
                  },
                ]}
              >
                {risk?.overall_risk || 'LOW RISK'}
              </Text>
            </View>
          </View>

          <View style={styles.telemetryRow}>
            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>PROXIMITY</Text>
              <Text style={styles.telemetryValue}>{risk?.vehicle_worker_proximity || 'Clear (>8m)'}</Text>
            </View>

            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>ZONE CONFLICT</Text>
              <Text style={styles.telemetryValue}>{risk?.zone_conflict || 'None'}</Text>
            </View>

            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>RISK SCORE</Text>
              <Text
                style={[
                  styles.telemetryValue,
                  { color: (risk?.risk_score || 0) > 60 ? '#dc2626' : '#16a34a', fontWeight: '900' },
                ]}
              >
                {risk?.risk_score || 12}/100
              </Text>
            </View>
          </View>
        </View>

        {/* Incident Logs Feed with Clip & Deep Analysis */}
        <View style={styles.cardContainer}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="shield" size={15} color="#2563eb" />
              <Text style={styles.cardHeaderTitle}>AUTO-DISPATCHED INCIDENTS</Text>
            </View>
            <Text style={styles.incidentCounter}>{incidents.length} logs</Text>
          </View>

          {incidents.map((item) => {
            const isCritical = item.severity === 'critical';
            const isResolved = item.status === 'resolved';

            return (
              <TouchableOpacity
                key={`${item.id}-${item.event_id}`}
                style={[
                  styles.incidentRowCard,
                  isCritical && !isResolved && styles.incidentRowCritical,
                ]}
                onPress={() => openIncidentAnalysis(item)}
              >
                <View style={styles.incidentRowTop}>
                  <View style={styles.incidentSeverityBadge}>
                    <Text
                      style={[
                        styles.incidentSeverityText,
                        { color: isResolved ? '#059669' : isCritical ? '#dc2626' : '#d97706' },
                      ]}
                    >
                      {isResolved ? 'RESOLVED' : item.severity.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.incidentIdText}>{item.event_id}</Text>
                  <Text style={styles.incidentTimeText}>{item.timestamp || 'Just now'}</Text>
                </View>

                <Text style={styles.incidentCardTitle}>{item.event_type.replace(/_/g, ' ')}</Text>
                <Text style={styles.incidentCardDesc} numberOfLines={2}>
                  {item.description}
                </Text>

                <View style={styles.incidentCardFooter}>
                  <View style={styles.playHint}>
                    <Feather name="play-circle" size={13} color="#2563eb" />
                    <Text style={styles.playHintText}>Tap to inspect clip & LLM analysis</Text>
                  </View>

                  {!isResolved && (
                    <TouchableOpacity
                      style={styles.resolveInlineBtn}
                      onPress={() => handleResolve(item.id)}
                    >
                      <Text style={styles.resolveInlineBtnText}>Resolve</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* FORENSIC INCIDENT ANALYSIS & VIDEO CLIP MODAL            */}
      {/* ======================================================== */}
      <Modal
        visible={selectedIncidentAnalysis !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedIncidentAnalysis(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.analysisModalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeaderLight}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="file-document-edit-outline" size={20} color="#2563eb" />
                <Text style={styles.analysisModalTitle}>Incident Forensic Investigation</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedIncidentAnalysis(null)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.analysisScrollBody}>
              {/* Visual Forensic Evidence Preview & Clip Launcher */}
              <View style={styles.videoPlayerContainer}>
                <Image
                  source={{
                    uri: `http://${hostIp}:${port}/api/hawk/camera/b/frame?v=${streamVersion}`,
                  }}
                  style={styles.evidenceImagePreview}
                  resizeMode="cover"
                />
                <View style={styles.videoOverlayShade} />

                <View style={styles.videoBadgeOverlay}>
                  <Text style={styles.videoBadgeText}>EVIDENCE ARCHIVE • 1080P CAPTURE</Text>
                </View>

                {/* Big HD Play Button Overlay */}
                <TouchableOpacity
                  style={styles.playClipFloatingBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (selectedIncidentAnalysis?.clip_url) {
                      const fullUrl = selectedIncidentAnalysis.clip_url.startsWith('http')
                        ? selectedIncidentAnalysis.clip_url
                        : `http://${hostIp}:${port}${selectedIncidentAnalysis.clip_url}`;
                      Linking.openURL(fullUrl).catch((err) =>
                        console.warn('Cannot open video clip:', err)
                      );
                    }
                  }}
                >
                  <View style={styles.playIconCircle}>
                    <Feather name="play" size={24} color="#ffffff" style={{ marginLeft: 3 }} />
                  </View>
                  <Text style={styles.playClipBtnLabel}>PLAY EVIDENCE CLIP</Text>
                </TouchableOpacity>
              </View>

              {/* Multi-Angle Incident Clip Selectors */}
              <View style={styles.multiClipRow}>
                <TouchableOpacity
                  style={[styles.clipAngleBtn, styles.clipAngleBtnActive]}
                  onPress={() => {
                    const fullUrl = selectedIncidentAnalysis?.clip_url?.startsWith('http')
                      ? selectedIncidentAnalysis.clip_url
                      : `http://${hostIp}:${port}${selectedIncidentAnalysis?.clip_url}`;
                    Linking.openURL(fullUrl).catch((err) => console.warn(err));
                  }}
                >
                  <Feather name="video" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.clipAngleBtnText}>
                    {selectedIncidentAnalysis?.event_type?.toUpperCase().includes('MACHINERY')
                      ? 'Inside Cam (Worker)'
                      : 'Primary Cam Clip'}
                  </Text>
                </TouchableOpacity>

                {selectedIncidentAnalysis?.alt_clip_url && (
                  <TouchableOpacity
                    style={styles.clipAngleBtnSecondary}
                    onPress={() => {
                      const fullUrl = selectedIncidentAnalysis.alt_clip_url!.startsWith('http')
                        ? selectedIncidentAnalysis.alt_clip_url!
                        : `http://${hostIp}:${port}${selectedIncidentAnalysis.alt_clip_url}`;
                      Linking.openURL(fullUrl).catch((err) => console.warn(err));
                    }}
                  >
                    <Feather name="video" size={12} color="#2563eb" style={{ marginRight: 4 }} />
                    <Text style={styles.clipAngleBtnSecondaryText}>
                      {selectedIncidentAnalysis?.event_type?.toUpperCase().includes('MACHINERY')
                        ? 'Outside Cam (Forklift)'
                        : 'Alt Camera Clip'}
                    </Text>
                  </TouchableOpacity>
                )}

                {selectedIncidentAnalysis?.sync_clip_url && (
                  <TouchableOpacity
                    style={styles.clipAngleBtnSync}
                    onPress={() => {
                      const fullUrl = selectedIncidentAnalysis.sync_clip_url!.startsWith('http')
                        ? selectedIncidentAnalysis.sync_clip_url!
                        : `http://${hostIp}:${port}${selectedIncidentAnalysis.sync_clip_url}`;
                      Linking.openURL(fullUrl).catch((err) => console.warn(err));
                    }}
                  >
                    <Feather name="layers" size={12} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={styles.clipAngleBtnSyncText}>Dual-Cam Sync</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* AI Safety Officer Summary */}
              <View style={styles.aiSummaryCard}>
                <View style={styles.aiOfficerTag}>
                  <Feather name="cpu" size={12} color="#2563eb" style={{ marginRight: 4 }} />
                  <Text style={styles.aiOfficerText}>AI SAFETY OFFICER SUMMARY</Text>
                </View>
                <Text style={styles.aiSummaryBodyText}>{selectedIncidentAnalysis?.summary}</Text>
              </View>

              {/* Multi-Agent Anticipation Timeline */}
              <View style={styles.analysisBlock}>
                <Text style={styles.blockTitle}>MULTI-AGENT COLLABORATIVE TIMELINE</Text>
                {selectedIncidentAnalysis?.timeline?.map((t, idx) => (
                  <View key={idx} style={styles.timelineRow}>
                    <Text style={styles.timelineTimeText}>{t.time}</Text>
                    <View style={styles.timelineCircle} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timelineStepText}>{t.step}</Text>
                      <Text style={styles.timelineDetailText}>{t.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Root Cause & OSHA Standards */}
              <View style={styles.analysisBlock}>
                <Text style={styles.blockTitle}>ROOT CAUSE ANALYSIS</Text>
                <Text style={styles.blockParagraph}>{selectedIncidentAnalysis?.root_cause}</Text>
              </View>

              <View style={styles.analysisBlock}>
                <Text style={styles.blockTitle}>OSHA REGULATORY STANDARD</Text>
                <Text style={[styles.blockParagraph, { color: '#d97706', fontWeight: '700' }]}>
                  {selectedIncidentAnalysis?.osha_regulation}
                </Text>
              </View>

              {/* Corrective Actions */}
              <View style={styles.analysisBlock}>
                <Text style={styles.blockTitle}>CORRECTIVE ACTION DIRECTIVES</Text>
                {selectedIncidentAnalysis?.corrective_actions?.map((act, i) => (
                  <View key={i} style={styles.actionRowItem}>
                    <Feather name="check-circle" size={13} color="#10b981" style={{ marginRight: 6 }} />
                    <Text style={styles.actionRowText}>{act}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.analysisFooterActions}>
              <TouchableOpacity
                style={styles.closeAnalysisBtn}
                onPress={() => setSelectedIncidentAnalysis(null)}
              >
                <Text style={styles.closeAnalysisBtnText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resolveAnalysisBtn}
                onPress={() =>
                  selectedIncidentAnalysis && handleResolve(selectedIncidentAnalysis.incident_id)
                }
              >
                <Feather name="check" size={15} color="#fff" />
                <Text style={styles.resolveAnalysisBtnText}>Resolve Hazard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Footage Selector Modal */}
      <Modal visible={isFootageModalOpen} animationType="fade" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.settingsModal}>
            <Text style={styles.settingsTitle}>Assign Multi-Camera Footage</Text>
            <Text style={styles.settingsSubtitle}>
              Select recordings to stream across Camera 1 and Camera 2.
            </Text>

            <Text style={styles.inputLabel}>Camera A (Entrance):</Text>
            <ScrollView style={{ maxHeight: 110, marginBottom: 10 }}>
              {availableVideos.map((v) => (
                <TouchableOpacity
                  key={`a-${v}`}
                  style={[styles.videoOption, selectedCamA === v && styles.videoOptionActive]}
                  onPress={() => setSelectedCamA(v)}
                >
                  <Text
                    style={[
                      styles.videoOptionText,
                      selectedCamA === v && styles.videoOptionTextActive,
                    ]}
                  >
                    {v}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Camera B (Loading Area):</Text>
            <ScrollView style={{ maxHeight: 110, marginBottom: 12 }}>
              {availableVideos.map((v) => (
                <TouchableOpacity
                  key={`b-${v}`}
                  style={[styles.videoOption, selectedCamB === v && styles.videoOptionActive]}
                  onPress={() => setSelectedCamB(v)}
                >
                  <Text
                    style={[
                      styles.videoOptionText,
                      selectedCamB === v && styles.videoOptionTextActive,
                    ]}
                  >
                    {v}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.settingsActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsFootageModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={handleApplyFootage}>
                <Text style={styles.saveBtnText}>Apply Feeds</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings / Host IP Modal */}
      <Modal visible={isSettingsOpen} animationType="fade" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.settingsModal}>
            <Text style={styles.settingsTitle}>Backend Server Configuration</Text>
            <Text style={styles.settingsSubtitle}>
              Connect mobile supervisor app to the Hack-Eye server.
            </Text>

            <Text style={styles.inputLabel}>Backend IPv4 Address:</Text>
            <TextInput
              style={styles.inputField}
              value={tempIp}
              onChangeText={setTempIp}
              placeholder="e.g. 10.0.21.250"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
            />

            <View style={styles.settingsActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsSettingsOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => {
                  setHostIp(tempIp.trim());
                  setIsSettingsOpen(false);
                }}
              >
                <Text style={styles.saveBtnText}>Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.8,
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2563eb',
    letterSpacing: 0.4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  connectionText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  settingsBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 14,
  },
  scrollContentContainer: {
    paddingBottom: 120,
    paddingTop: 10,
  },

  // Kiosk Alert Banner (Matching Kiosk Light/Vibrant Design)
  kioskAlertBanner: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  kioskAlertCritical: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  kioskAlertWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  kioskAlertFire: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  kioskAlertTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  kioskIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kioskPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  kioskTypePill: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kioskTypePillText: {
    color: '#b91c1c',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  kioskAutoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kioskAutoPillText: {
    color: '#059669',
    fontSize: 9,
    fontWeight: '700',
  },
  kioskDismissBtn: {
    padding: 4,
  },
  kioskAlertTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.2,
  },
  kioskAlertDesc: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 10,
  },
  kioskAlertBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  kioskZoneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kioskZoneTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  kioskActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kioskInspectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  kioskInspectBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  kioskClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  kioskClearBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Kiosk All Clear Banner
  kioskAllClearBanner: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kioskClearIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kioskClearTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.4,
  },
  kioskClearSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  kioskClearTag: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  kioskClearTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },

  // Card Container Styles
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.6,
  },
  cardHeaderSub: {
    fontSize: 10,
    color: '#64748b',
  },
  scenarioButtonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  scenBtn1: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  scenBtn2: {
    flex: 1.2,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  scenBtn3: {
    flex: 1,
    backgroundColor: '#eff6ff',
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  scenBtn4: {
    flex: 1,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  scenBtn5: {
    flex: 1,
    backgroundColor: '#fee2e2',
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  scenBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1e293b',
  },
  footagePickerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  footagePickerLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },

  // Cams Row
  camsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  camCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
  },
  camCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  camCardTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a',
  },
  liveTagGreen: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  liveTagGreenText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#059669',
  },
  camImageWrapper: {
    height: 95,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 4,
  },
  camFeedImg: {
    width: '100%',
    height: '100%',
  },
  camFooterCaption: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
  },

  // Telemetry
  riskLevelTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  riskLevelTagText: {
    fontSize: 10,
    fontWeight: '900',
  },
  telemetryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  telemetryCol: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  telemetryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.4,
  },
  telemetryValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 3,
  },

  // Incident Row
  incidentCounter: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  incidentRowCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 8,
  },
  incidentRowCritical: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5',
  },
  incidentRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  incidentSeverityBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  incidentSeverityText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  incidentIdText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    flex: 1,
  },
  incidentTimeText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  incidentCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 3,
  },
  incidentCardDesc: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 8,
  },
  incidentCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  playHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playHintText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
  },
  resolveInlineBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  resolveInlineBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },

  // Analysis Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  analysisModalCard: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeaderLight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  analysisModalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginLeft: 8,
  },
  analysisScrollBody: {
    padding: 16,
  },
  videoPlayerContainer: {
    height: 195,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  evidenceImagePreview: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0f172a',
  },
  videoOverlayShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  playClipFloatingBtn: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.92)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#60a5fa',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  playIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  playClipBtnLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  playClipBtnSub: {
    color: '#bfdbfe',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  multiClipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  clipAngleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  clipAngleBtnActive: {
    backgroundColor: '#2563eb',
  },
  clipAngleBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  clipAngleBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  clipAngleBtnSecondaryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563eb',
  },
  clipAngleBtnSync: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  clipAngleBtnSyncText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  videoBadgeOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  videoBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#38bdf8',
    letterSpacing: 0.5,
  },
  aiSummaryCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  aiOfficerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  aiOfficerText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#2563eb',
    letterSpacing: 0.6,
  },
  aiSummaryBodyText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  analysisBlock: {
    marginBottom: 12,
  },
  blockTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  blockParagraph: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  timelineTimeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563eb',
    width: 60,
  },
  timelineCircle: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563eb',
    marginTop: 4,
    marginRight: 8,
  },
  timelineStepText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  timelineDetailText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  actionRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionRowText: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
  },
  analysisFooterActions: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  closeAnalysisBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  closeAnalysisBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 12,
  },
  resolveAnalysisBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#10b981',
    borderRadius: 8,
    gap: 6,
  },
  resolveAnalysisBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },

  // Settings Modals
  settingsModal: {
    width: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 3,
  },
  settingsSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 5,
  },
  inputField: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#0f172a',
    fontSize: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  videoOption: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  videoOptionActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  videoOptionText: {
    fontSize: 11,
    color: '#475569',
  },
  videoOptionTextActive: {
    color: '#2563eb',
    fontWeight: '800',
  },
  settingsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 6,
  },
  cancelBtnText: {
    color: '#64748b',
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
