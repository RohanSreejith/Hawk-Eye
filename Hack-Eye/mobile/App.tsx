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
} from 'react-native';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';

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

  const activeAlertRef = useRef<Incident | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const apiBase = `http://${hostIp}:${port}/api`;
  const wsUrl = `ws://${hostIp}:${port}/ws`;

  const setAlert = (inc: Incident | null) => {
    activeAlertRef.current = inc;
    setActiveAlert(inc);

    if (inc && inc.status !== 'resolved') {
      try {
        Vibration.vibrate([0, 800, 200, 800, 200, 1000]);
      } catch (e) {}
    } else {
      try {
        Vibration.cancel();
      } catch (e) {}
    }
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
              const alertInc: Incident = {
                id: Date.now(),
                event_id: `HAWK-${data.hawk_state?.risk_assessment?.risk_score || 'ALERT'}`,
                camera_id: 'CAM_B',
                event_type: kiosk.title || 'Safety Alert',
                severity: kiosk.severity || 'critical',
                description: `${kiosk.message}. ${kiosk.subtext || ''}`,
                zone: kiosk.zone || 'Zone B',
                timestamp: kiosk.timestamp || new Date().toLocaleTimeString(),
                status: 'active',
              };
              setAlert(alertInc);
            } else if (kiosk && !kiosk.active) {
              setAlert(null);
            }
          } else if (data.type === 'incident_created' || data.kiosk_alert) {
            const inc: Incident = data.incident || {
              id: Date.now(),
              event_id: `EVT-${Math.floor(1000 + Math.random() * 9000)}`,
              camera_id: data.kiosk_alert?.camera_id || 'CAM_B',
              event_type: data.kiosk_alert?.title || 'Safety Alert',
              severity: data.kiosk_alert?.severity || 'critical',
              description: data.kiosk_alert?.message || 'Emergency hazard detected on site',
              zone: data.kiosk_alert?.zone || 'Zone B',
              timestamp: new Date().toLocaleTimeString(),
              status: 'active',
            };
            setIncidents((prev) => [inc, ...prev.filter((i) => i.id !== inc.id)]);
            setAlert(inc);
          } else if (data.type === 'incident_updated') {
            const { incident_id, status } = data;
            setIncidents((prev) =>
              prev.map((i) => (i.id === incident_id ? { ...i, status } : i))
            );
            const current = activeAlertRef.current;
            if (current && current.id === incident_id) {
              if (status === 'resolved') {
                setAlert(null);
              } else {
                setAlert({ ...current, status });
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
          setAlert({
            id: Date.now(),
            event_id: `HAWK-${data.risk_assessment?.risk_score || 'ALERT'}`,
            camera_id: 'CAM_B',
            event_type: kiosk.title || 'Safety Alert',
            severity: kiosk.severity || 'critical',
            description: `${kiosk.message}. ${kiosk.subtext || ''}`,
            zone: kiosk.zone || 'Zone B',
            timestamp: kiosk.timestamp || new Date().toLocaleTimeString(),
            status: 'active',
          });
        } else if (data.safety_kiosk && !data.safety_kiosk.active) {
          const current = activeAlertRef.current;
          if (current && current.event_id?.startsWith('HAWK-')) {
            setAlert(null);
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
      const incRes = await fetch(`${apiBase}/incidents`);
      if (incRes.ok) {
        const data = await incRes.json();
        if (Array.isArray(data)) {
          setIncidents(data);
          const activeUnresolved = data.find((i: Incident) => i.status !== 'resolved');
          if (activeUnresolved) {
            setAlert(activeUnresolved);
          }
        }
      }
    } catch (e) {}
  };

  const syncIncidents = async () => {
    try {
      const incRes = await fetch(`${apiBase}/incidents`);
      if (incRes.ok) {
        const data = await incRes.json();
        if (Array.isArray(data)) {
          setIncidents(data);
          const activeUnresolved = data.find((i: Incident) => i.status !== 'resolved');
          const current = activeAlertRef.current;
          if (activeUnresolved) {
            if (!current || current.id !== activeUnresolved.id) {
              setAlert(activeUnresolved);
            }
          }
        }
      }
    } catch (e) {}
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await syncIncidents();
    await fetchHawkState();
    setRefreshing(false);
  };

  const triggerScenarioStep = async (step: number) => {
    // Instant optimistic alert feedback on mobile
    if (step === 4) {
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
      });
    } else if (step === 5) {
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
      });
    } else if (step === 7) {
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
      });
    } else if (step === 1 || step === 6) {
      setAlert(null);
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
    } catch (e) {}
  };

  const openIncidentAnalysis = async (incident: Incident) => {
    setAnalysisLoading(true);
    try {
      const res = await fetch(`${apiBase}/hawk/incidents/${incident.id}/analysis`);
      if (res.ok) {
        const data = await res.json();
        setSelectedIncidentAnalysis(data);
      } else {
        // Mock fallback
        setSelectedIncidentAnalysis({
          incident_id: incident.id,
          event_id: incident.event_id,
          event_type: incident.event_type,
          zone: incident.zone || 'Zone B - Loading Area',
          camera_id: incident.camera_id || 'CAM_B',
          severity: incident.severity || 'critical',
          timestamp: incident.timestamp || '10:24:17',
          summary: incident.description,
          clip_url: '/clips/evt_veh_84247.mp4',
          timeline: [
            { time: 'T - 5.2s', step: 'Entrance Detection', detail: 'Agent A identified vehicle approaching portal.' },
            { time: 'T - 3.8s', step: 'Shared State Broadcast', detail: 'Agent A published VEHICLE_INBOUND to Zone B.' },
            { time: 'T - 1.5s', step: 'Hazard Anticipation', detail: 'Agent B armed Zone B Kiosk prior to line-of-sight.' },
          ],
          root_cause: 'Blind intersection with stacked racking obstructing forklift operator trajectory.',
          osha_regulation: 'OSHA Standard 1910.178 - Powered Industrial Trucks Safe Navigation.',
          corrective_actions: ['Install parabolic mirrors', 'Enforce zone speed governor'],
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
      <StatusBar barStyle="light-content" backgroundColor="#070b14" />

      {/* Top Supervisor Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.badgeIcon}>
            <MaterialCommunityIcons name="shield-airplane" size={22} color="#00f2fe" />
          </View>
          <View>
            <Text style={styles.brandTitle}>HAWK SUPERVISOR</Text>
            <Text style={styles.brandSubtitle}>MULTI-AGENT COLLABORATIVE HUD</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <View
            style={[
              styles.connectionPill,
              { backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: isConnected ? '#10b981' : '#ef4444' }]} />
            <Text style={[styles.connectionText, { color: isConnected ? '#10b981' : '#ef4444' }]}>
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => {
              setTempIp(hostIp);
              setIsSettingsOpen(true);
            }}
          >
            <Feather name="settings" size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ======================================================== */}
      {/* REAL-TIME SAFETY KIOSK & INCIDENT ALERT POPUP BANNER     */}
      {/* ======================================================== */}
      {activeAlert && activeAlert.status !== 'resolved' && (
        <View
          style={[
            styles.alertBannerContainer,
            activeAlert.severity === 'critical' ? styles.alertBannerCritical : styles.alertBannerWarning,
          ]}
        >
          <View style={styles.alertBannerHeader}>
            <View style={styles.alertBannerBadge}>
              <MaterialCommunityIcons
                name={
                  activeAlert.event_type.toUpperCase().includes('FIRE')
                    ? 'fire-alert'
                    : 'alert-octagon'
                }
                size={22}
                color="#ffffff"
              />
              <Text style={styles.alertBannerBadgeText}>
                {activeAlert.severity === 'critical' ? 'CRITICAL HAZARD' : 'PROACTIVE WARNING'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setAlert(null)} style={styles.alertDismissBtn}>
              <Ionicons name="close" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.alertBannerTitle}>{activeAlert.event_type}</Text>
          <Text style={styles.alertBannerDesc}>{activeAlert.description}</Text>

          <View style={styles.alertBannerFooter}>
            <View style={styles.alertZonePill}>
              <Feather name="map-pin" size={12} color="#ffffff" />
              <Text style={styles.alertZonePillText}>{activeAlert.zone || 'Zone B (Loading Area)'}</Text>
            </View>

            <TouchableOpacity
              style={styles.alertResolveBtn}
              onPress={() => triggerScenarioStep(1)}
            >
              <Feather name="shield" size={14} color="#070b14" />
              <Text style={styles.alertResolveBtnText}>Clear / Return to Baseline</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        bounces={true}
        overScrollMode="always"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00f2fe"
            colors={['#00f2fe']}
            progressBackgroundColor="#0f172a"
          />
        }
      >
        {/* Supervisor Scenario Control Bar */}
        <View style={styles.supervisorControlsCard}>
          <Text style={styles.controlHeaderTitle}>SUPERVISOR MULTI-AGENT CONTROLS</Text>
          <View style={styles.controlButtonRow}>
            <TouchableOpacity style={styles.stepBtn1} onPress={() => triggerScenarioStep(1)}>
              <Text style={styles.stepBtnText}>1. Baseline</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.stepBtn2} onPress={() => triggerScenarioStep(4)}>
              <Text style={styles.stepBtnText}>2. Anticipate</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.stepBtn3} onPress={() => triggerScenarioStep(5)}>
              <Text style={styles.stepBtnText}>3. Conflict</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.stepBtn3, { backgroundColor: '#b91c1c' }]} onPress={() => triggerScenarioStep(7)}>
              <Text style={styles.stepBtnText}>4. Fire</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.footagePickerBtn} onPress={() => setIsFootageModalOpen(true)}>
            <Feather name="video" size={15} color="#00f2fe" />
            <Text style={styles.footagePickerText}>Assign Multi-Camera Footage Feeds</Text>
            <Feather name="chevron-right" size={15} color="#00f2fe" />
          </TouchableOpacity>
        </View>

        {/* HAWK Dual Camera Feeds Strip */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MONITORED BUILDING SECTORS</Text>
          <View style={styles.camsRow}>
            {/* Camera A */}
            <View style={styles.camCard}>
              <View style={styles.camCardHeader}>
                <Text style={styles.camCardTitle}>Camera A (Entrance)</Text>
                <View style={styles.liveBadgeSmall}>
                  <Text style={styles.liveBadgeSmallText}>LIVE</Text>
                </View>
              </View>
              <View style={styles.camPlaceholderBox}>
                <MaterialCommunityIcons name="cctv" size={32} color="#00f2fe" />
                {(hawkState?.cameras?.camera_a?.detections?.[0] || hawkState?.cameras?.camera_a?.detection) && (
                  <View style={styles.mockBboxA}>
                    <Text style={styles.mockBboxText}>
                      {(hawkState?.cameras?.camera_a?.detections?.[0] || hawkState?.cameras?.camera_a?.detection)?.label} [
                      {(hawkState?.cameras?.camera_a?.detections?.[0] || hawkState?.cameras?.camera_a?.detection)?.conf}]
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.camFooterText}>
                {hawkState?.cameras?.camera_a?.caption || 'Zone A – Safe monitoring'}
              </Text>
            </View>

            {/* Camera B */}
            <View style={styles.camCard}>
              <View style={styles.camCardHeader}>
                <Text style={styles.camCardTitle}>Camera B (Loading)</Text>
                <View style={styles.liveBadgeSmall}>
                  <Text style={styles.liveBadgeSmallText}>LIVE</Text>
                </View>
              </View>
              <View style={styles.camPlaceholderBox}>
                <MaterialCommunityIcons name="cctv" size={32} color="#10b981" />
                {(hawkState?.cameras?.camera_b?.detections?.[0] || hawkState?.cameras?.camera_b?.detection) && (
                  <View style={styles.mockBboxB}>
                    <Text style={styles.mockBboxText}>
                      {(hawkState?.cameras?.camera_b?.detections?.[0] || hawkState?.cameras?.camera_b?.detection)?.label} [
                      {(hawkState?.cameras?.camera_b?.detections?.[0] || hawkState?.cameras?.camera_b?.detection)?.conf}]
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{ ...styles.camFooterText, color: '#f59e0b' }}>
                {hawkState?.cameras?.camera_b?.caption || 'Zone B – Safe monitoring'}
              </Text>
            </View>
          </View>
        </View>

        {/* HAWK Shared State & Risk Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HAWK SHARED STATE & RISK ASSESSMENT</Text>
          <View style={styles.sharedStateCard}>
            <View style={styles.sharedStateRow}>
              <View style={styles.ssCol}>
                <Text style={styles.ssLabel}>PROXIMITY</Text>
                <Text style={[styles.ssVal, { color: '#f59e0b' }]}>
                  {risk?.vehicle_worker_proximity || 'Monitoring'}
                </Text>
              </View>
              <View style={styles.ssCol}>
                <Text style={styles.ssLabel}>ZONE CONFLICT</Text>
                <Text style={[styles.ssVal, { color: '#f59e0b' }]}>
                  {risk?.zone_conflict || 'Possible'}
                </Text>
              </View>
              <View style={styles.ssCol}>
                <Text style={styles.ssLabel}>OVERALL RISK</Text>
                <Text style={[styles.ssVal, { color: risk?.overall_risk === 'CRITICAL' ? '#ef4444' : '#f59e0b', fontWeight: '900' }]}>
                  {risk?.overall_risk || 'MEDIUM'}
                </Text>
              </View>
            </View>

            {/* Inbound Event Banner */}
            {hawkState?.active_events && hawkState.active_events.length > 0 && (
              <View style={styles.inboundBanner}>
                <MaterialCommunityIcons name="truck-fast" size={20} color="#090d16" />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={styles.inboundBannerTitle}>VEHICLE_INBOUND DISPATCHED</Text>
                  <Text style={styles.inboundBannerSub}>Forklift V01 en route from Entrance to Loading Zone B</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Incidents Dispatch Feed with LLM & Video Inspection */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>INCIDENTS & FORENSIC REPORTS</Text>
            <Text style={styles.feedCount}>{incidents.length} logs</Text>
          </View>

          {incidents.map((item) => {
            const isCritical = item.severity === 'critical';
            const isResolved = item.status === 'resolved';

            return (
              <TouchableOpacity
                key={`${item.id}-${item.event_id}`}
                style={[styles.incidentCard, isCritical && !isResolved && styles.incidentCardCritical]}
                onPress={() => openIncidentAnalysis(item)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.badgeWrapper}>
                    <View
                      style={[
                        styles.severityTag,
                        {
                          backgroundColor: isResolved
                            ? 'rgba(16, 185, 129, 0.2)'
                            : isCritical
                            ? 'rgba(239, 68, 68, 0.25)'
                            : 'rgba(245, 158, 11, 0.25)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.severityTagText,
                          { color: isResolved ? '#10b981' : isCritical ? '#ef4444' : '#f59e0b' },
                        ]}
                      >
                        {isResolved ? 'RESOLVED' : item.severity.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.cardEventId}>{item.event_id}</Text>
                  </View>
                  <Text style={styles.cardTime}>{item.timestamp || 'Just now'}</Text>
                </View>

                <Text style={styles.cardTitle}>
                  {item.event_type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </Text>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.description}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.inspectHint}>
                    <Feather name="play-circle" size={14} color="#00f2fe" />
                    <Text style={styles.inspectHintText}>Tap to Play Video Clip & AI Analysis</Text>
                  </View>

                  {!isResolved && (
                    <TouchableOpacity style={styles.resolveSmallBtn} onPress={() => handleResolve(item.id)}>
                      <Text style={styles.resolveSmallBtnText}>Resolve</Text>
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
            <View style={styles.modalHeaderDark}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="file-document-edit-outline" size={22} color="#00f2fe" />
                <Text style={styles.analysisModalTitle}>HAWK Forensic Report</Text>
              </View>
            <TouchableOpacity onPress={() => setSelectedIncidentAnalysis(null)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.analysisScrollBody}>
              {/* Forensic Video Evidence Display */}
              <View style={styles.videoPlayerContainer}>
                <View style={{ width: '100%', height: '100%', backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="cctv" size={48} color="#00f2fe" style={{ opacity: 0.8, marginBottom: 8 }} />
                  <Text style={{ color: '#f8fafc', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>
                    HAWK EVIDENCE REPOSITORY
                  </Text>
                  <Text style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>
                    {selectedIncidentAnalysis?.clip_url ? selectedIncidentAnalysis.clip_url.split('/').pop() : 'evt_evidence.mp4'} • 1080p 30fps
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: 'rgba(0, 242, 254, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Feather name="shield" size={12} color="#00f2fe" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#00f2fe', fontSize: 10, fontWeight: '700' }}>VERIFIED MULTI-AGENT RECORDING</Text>
                  </View>
                </View>
                <View style={styles.videoBadgeOverlay}>
                  <Text style={styles.videoBadgeText}>RECORDED EVIDENCE ARCHIVE</Text>
                </View>
              </View>

              {/* AI Executive Summary */}
              <View style={styles.aiSummaryCard}>
                <View style={styles.aiOfficerTag}>
                  <Feather name="cpu" size={12} color="#00f2fe" style={{ marginRight: 4 }} />
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
                <Text style={[styles.blockParagraph, { color: '#f59e0b', fontWeight: '700' }]}>
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
                <Text style={styles.closeAnalysisBtnText}>Close Report</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resolveAnalysisBtn}
                onPress={() => selectedIncidentAnalysis && handleResolve(selectedIncidentAnalysis.incident_id)}
              >
                <Feather name="check" size={16} color="#fff" />
                <Text style={styles.resolveAnalysisBtnText}>Resolve Hazard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* FOOTAGE SELECTION MODAL                                  */}
      {/* ======================================================== */}
      <Modal visible={isFootageModalOpen} animationType="fade" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.settingsModal}>
            <Text style={styles.settingsTitle}>Assign Multi-Camera Footage</Text>
            <Text style={styles.settingsSubtitle}>
              Select video recordings to process across Camera A and Camera B.
            </Text>

            <Text style={styles.inputLabel}>Camera A (Entrance):</Text>
            <ScrollView style={{ maxHeight: 120, marginBottom: 12 }}>
              {availableVideos.map((v) => (
                <TouchableOpacity
                  key={`a-${v}`}
                  style={[styles.videoOption, selectedCamA === v && styles.videoOptionActive]}
                  onPress={() => setSelectedCamA(v)}
                >
                  <Text style={[styles.videoOptionText, selectedCamA === v && styles.videoOptionTextActive]}>
                    {v}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Camera B (Loading Area):</Text>
            <ScrollView style={{ maxHeight: 120, marginBottom: 12 }}>
              {availableVideos.map((v) => (
                <TouchableOpacity
                  key={`b-${v}`}
                  style={[styles.videoOption, selectedCamB === v && styles.videoOptionActive]}
                  onPress={() => setSelectedCamB(v)}
                >
                  <Text style={[styles.videoOptionText, selectedCamB === v && styles.videoOptionTextActive]}>
                    {v}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.settingsActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsFootageModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={handleApplyFootage}>
                <Text style={styles.saveBtnText}>Apply Feeds</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* SETTINGS / HOST IP MODAL                                 */}
      {/* ======================================================== */}
      <Modal visible={isSettingsOpen} animationType="fade" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.settingsModal}>
            <Text style={styles.settingsTitle}>Server Connection Settings</Text>
            <Text style={styles.settingsSubtitle}>
              Connect mobile app to the Hack-Eye backend server running on your computer.
            </Text>

            <Text style={styles.inputLabel}>Backend IPv4 Address:</Text>
            <TextInput
              style={styles.inputField}
              value={tempIp}
              onChangeText={setTempIp}
              placeholder="e.g. 10.0.21.250"
              placeholderTextColor="#64748b"
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
    backgroundColor: '#070b14',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2b45',
    backgroundColor: '#0a0f1d',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#f8fafc',
    letterSpacing: 1.2,
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00f2fe',
    letterSpacing: 0.8,
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
    marginRight: 6,
  },
  connectionText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  settingsBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#131c31',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContentContainer: {
    paddingBottom: 160,
    flexGrow: 1,
  },

  // Real-Time Alert Banner Styles
  alertBannerContainer: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  alertBannerCritical: {
    backgroundColor: '#991b1b',
    borderColor: '#ef4444',
  },
  alertBannerWarning: {
    backgroundColor: '#92400e',
    borderColor: '#f59e0b',
  },
  alertBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertBannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertBannerBadgeText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  alertDismissBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  alertBannerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  alertBannerDesc: {
    color: '#f8fafc',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  alertBannerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertZonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  alertZonePillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  alertResolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00f2fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  alertResolveBtnText: {
    color: '#070b14',
    fontSize: 12,
    fontWeight: '800',
  },

  // Supervisor Controls Card
  supervisorControlsCard: {
    backgroundColor: '#0d1527',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e2b45',
    padding: 14,
    marginTop: 14,
  },
  controlHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  controlButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  stepBtn1: {
    flex: 1,
    backgroundColor: '#0284c7',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  stepBtn2: {
    flex: 1,
    backgroundColor: '#d97706',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  stepBtn3: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  stepBtn4: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  stepBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  footagePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    backgroundColor: '#131d33',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e2b45',
  },
  footagePickerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00f2fe',
    flex: 1,
    marginLeft: 8,
  },

  // Dual Cams
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 8,
  },
  camsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  camCard: {
    flex: 1,
    backgroundColor: '#0d1527',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e2b45',
    padding: 10,
  },
  camCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  camCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f8fafc',
  },
  liveBadgeSmall: {
    backgroundColor: '#10b981',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  liveBadgeSmallText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#090d16',
  },
  camPlaceholderBox: {
    height: 80,
    backgroundColor: '#020617',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  mockBboxA: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#ea580c',
    padding: 2,
    borderRadius: 3,
    backgroundColor: 'rgba(234, 88, 12, 0.2)',
  },
  mockBboxB: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#22c55e',
    padding: 2,
    borderRadius: 3,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  mockBboxText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#fff',
  },
  camFooterText: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 4,
  },

  // Shared State Card
  sharedStateCard: {
    backgroundColor: '#0d1527',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e2b45',
    padding: 14,
  },
  sharedStateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ssCol: {
    flex: 1,
    alignItems: 'center',
  },
  ssLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  ssVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  inboundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 6,
    padding: 8,
    marginTop: 12,
  },
  inboundBannerTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#090d16',
  },
  inboundBannerSub: {
    fontSize: 10,
    color: '#1e293b',
    marginTop: 1,
  },

  // Incident Feed
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedCount: {
    fontSize: 11,
    color: '#475569',
  },
  incidentCard: {
    backgroundColor: '#0d1527',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e2b45',
    padding: 14,
    marginBottom: 10,
  },
  incidentCardCritical: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  severityTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardEventId: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  cardTime: {
    fontSize: 11,
    color: '#64748b',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e2b45',
  },
  inspectHint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inspectHintText: {
    fontSize: 11,
    color: '#00f2fe',
    fontWeight: '600',
    marginLeft: 6,
  },
  resolveSmallBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  resolveSmallBtnText: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '700',
  },

  // Analysis Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  analysisModalCard: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#0a0f1d',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e2b45',
    overflow: 'hidden',
  },
  modalHeaderDark: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#0d1527',
    borderBottomWidth: 1,
    borderBottomColor: '#1e2b45',
  },
  analysisModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f8fafc',
    marginLeft: 8,
  },
  analysisScrollBody: {
    padding: 16,
  },
  videoPlayerContainer: {
    height: 190,
    backgroundColor: '#020617',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1e2b45',
    position: 'relative',
  },
  expoVideoPlayer: {
    width: '100%',
    height: '100%',
  },
  videoBadgeOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(9, 13, 22, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  videoBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#00f2fe',
    letterSpacing: 0.5,
  },
  aiSummaryCard: {
    backgroundColor: '#101a30',
    borderWidth: 1,
    borderColor: '#1e2b45',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  aiOfficerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  aiOfficerText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#00f2fe',
    letterSpacing: 0.8,
  },
  aiSummaryBodyText: {
    fontSize: 12,
    color: '#e2e8f0',
    lineHeight: 18,
  },
  analysisBlock: {
    marginBottom: 14,
  },
  blockTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  blockParagraph: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 18,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  timelineTimeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00f2fe',
    width: 60,
  },
  timelineCircle: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00f2fe',
    marginTop: 4,
    marginRight: 8,
  },
  timelineStepText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f8fafc',
  },
  timelineDetailText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  actionRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionRowText: {
    fontSize: 11,
    color: '#e2e8f0',
    flex: 1,
  },
  analysisFooterActions: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#0d1527',
    borderTopWidth: 1,
    borderTopColor: '#1e2b45',
    gap: 8,
  },
  closeAnalysisBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  closeAnalysisBtnText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 12,
  },
  resolveAnalysisBtn: {
    flex: 1.5,
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

  // Settings & Footage Modals
  settingsModal: {
    width: '90%',
    backgroundColor: '#0d1527',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e2b45',
    padding: 20,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 4,
  },
  settingsSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 14,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  inputField: {
    backgroundColor: '#131c31',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1e2b45',
  },
  videoOption: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#101a30',
    marginBottom: 4,
  },
  videoOptionActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderWidth: 1,
    borderColor: '#00f2fe',
  },
  videoOptionText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  videoOptionTextActive: {
    color: '#00f2fe',
    fontWeight: '700',
  },
  settingsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#00f2fe',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveBtnText: {
    color: '#090d16',
    fontWeight: '800',
  },
});
