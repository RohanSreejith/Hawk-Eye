import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HawkDashboard } from './components/HawkDashboard';
import {
  fetchIncidents,
  fetchSettings,
  createWebSocket
} from './services/api';
import { Incident, SupervisorSettings } from './types';

export function App() {
  const [latestIncident, setLatestIncident] = useState<Incident | null>(null);
  const [supervisorSettings, setSupervisorSettings] = useState<SupervisorSettings | null>(null);
  const pendingQueueRef = useRef<Incident[]>([]);
  const latestIncidentRef = useRef<Incident | null>(null);

  // Keep ref synchronized with state for immediate access in event handlers
  useEffect(() => {
    latestIncidentRef.current = latestIncident;
  }, [latestIncident]);

  const loadData = useCallback(async () => {
    try {
      const [incidents, settings] = await Promise.all([
        fetchIncidents(),
        fetchSettings()
      ]);

      if (settings) {
        setSupervisorSettings(settings);
      }

      // If current alert is resolved or null, load next unresolved
      const current = latestIncidentRef.current;
      if (!current || current.status === 'resolved') {
        if (pendingQueueRef.current.length > 0) {
          const nextAlert = pendingQueueRef.current.shift()!;
          setLatestIncident(nextAlert);
        } else if (Array.isArray(incidents)) {
          const unresolved = incidents.filter(i => i.status !== 'resolved');
          if (unresolved.length > 0) {
            setLatestIncident(unresolved[0]);
          } else {
            setLatestIncident(null);
          }
        }
      }
    } catch (e) {
      console.warn('[HACK-EYE] Initial data load pending...', e);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Setup Real-time WebSocket connection for live telemetry
    const socket = createWebSocket((data: any) => {
      console.log('[HACK-EYE WS EVENT]', data);

      if (data.type === 'incident_created') {
        const newInc: Incident = data.incident;
        const current = latestIncidentRef.current;

        // RULE: Do not show the next alert until current alert is resolved!
        if (current && current.status !== 'resolved') {
          console.log('[HACK-EYE] Alert already active on screen. Queuing incoming alert:', newInc.event_type);
          if (!pendingQueueRef.current.some(item => item.id === newInc.id || item.event_id === newInc.event_id)) {
            pendingQueueRef.current.push(newInc);
          }
        } else {
          setLatestIncident(newInc);
        }
      } else if (data.type === 'incident_updated') {
        const { incident_id, status } = data;
        if (status === 'resolved') {
          console.log('[HACK-EYE] Incident resolved:', incident_id);
          const current = latestIncidentRef.current;
          if (current?.id === incident_id) {
            if (pendingQueueRef.current.length > 0) {
              const nextAlert = pendingQueueRef.current.shift()!;
              setLatestIncident(nextAlert);
            } else {
              fetchIncidents().then(incidents => {
                const remaining = Array.isArray(incidents)
                  ? incidents.filter(i => i.status !== 'resolved' && i.id !== incident_id)
                  : [];
                if (remaining.length > 0) {
                  setLatestIncident(remaining[0]);
                } else {
                  setLatestIncident(null);
                }
              }).catch(() => {
                setLatestIncident(null);
              });
            }
          }
        }
      }
    });

    return () => {
      socket.close();
    };
  }, [loadData]);

  const handleResolveAlert = useCallback(async () => {
    const current = latestIncidentRef.current;
    if (!current) return;

    if (pendingQueueRef.current.length > 0) {
      const nextAlert = pendingQueueRef.current.shift()!;
      setLatestIncident(nextAlert);
    } else {
      const incidents = await fetchIncidents().catch(() => []);
      const remaining = Array.isArray(incidents)
        ? incidents.filter(i => i.status !== 'resolved' && i.id !== current.id)
        : [];
      if (remaining.length > 0) {
        setLatestIncident(remaining[0]);
      } else {
        setLatestIncident(null);
      }
    }
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <HawkDashboard />
    </div>
  );
}

export default App;
