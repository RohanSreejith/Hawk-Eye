import { Incident, Camera, Zone, HeatmapZone, KPIs, SystemStatus, AgentLog } from '../types';

export const API_BASE = '/api';

export async function fetchKPIs(): Promise<KPIs> {
  const res = await fetch(`${API_BASE}/analytics/kpis`);
  return res.json();
}

export async function fetchIncidents(): Promise<Incident[]> {
  const res = await fetch(`${API_BASE}/incidents`);
  return res.json();
}

export async function fetchCameras(): Promise<Camera[]> {
  const res = await fetch(`${API_BASE}/cameras`);
  return res.json();
}

export async function fetchZones(): Promise<Zone[]> {
  const res = await fetch(`${API_BASE}/zones`);
  return res.json();
}

export async function fetchHeatmap(): Promise<HeatmapZone[]> {
  const res = await fetch(`${API_BASE}/heatmap`);
  return res.json();
}

export async function fetchAnalytics(): Promise<any> {
  const res = await fetch(`${API_BASE}/analytics`);
  return res.json();
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_BASE}/system/status`);
  return res.json();
}

export async function fetchAgentLogs(): Promise<AgentLog[]> {
  const res = await fetch(`${API_BASE}/agents/logs`);
  return res.json();
}

export async function acknowledgeIncident(id: number): Promise<void> {
  await fetch(`${API_BASE}/incidents/${id}/acknowledge`, { method: 'POST' });
}

export async function resolveIncident(id: number): Promise<void> {
  await fetch(`${API_BASE}/incidents/${id}/resolve`, { method: 'POST' });
}

export async function triggerDemoScenario(scenario: string): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/trigger?scenario=${scenario}`, { method: 'POST' });
  return res.json();
}

export async function startDemoLoop(): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/start`, { method: 'POST' });
  return res.json();
}

export async function stopDemoLoop(): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/stop`, { method: 'POST' });
  return res.json();
}

export async function clearDemoIncidents(): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/clear`, { method: 'POST' });
  return res.json();
}

export function createWebSocket(onMessage: (data: any) => void): { close: () => void } {
  let isClosed = false;
  let socket: WebSocket | null = null;
  let reconnectTimer: any = null;

  function connect() {
    if (isClosed) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    console.log('[WS SERVICE] Connecting to WebSocket:', wsUrl);
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('[WS SERVICE] Connected to safety telemetry stream.');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (e) {
        console.error('[WS ERROR] Failed to parse WebSocket message', e);
      }
    };

    socket.onerror = (err) => {
      console.warn('[WS WARNING] WebSocket error:', err);
    };

    socket.onclose = () => {
      if (isClosed) return;
      console.log('[WS SERVICE] Disconnected. Reconnecting in 3 seconds...');
      reconnectTimer = setTimeout(connect, 3000);
    };
  }

  connect();

  return {
    close: () => {
      isClosed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    }
  };
}

export async function fetchSettings(): Promise<any> {
  const res = await fetch(`${API_BASE}/settings`);
  return res.json();
}

export async function updateSettings(data: any): Promise<any> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function sendTestAlert(): Promise<any> {
  const res = await fetch(`${API_BASE}/settings/test-alert`, {
    method: 'POST'
  });
  return res.json();
}

export async function fetchVideos(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/videos`);
  return res.json();
}

export async function uploadVideo(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/videos/upload`, {
    method: 'POST',
    body: formData
  });
  return res.json();
}

export async function selectVideo(filename: string): Promise<any> {
  const res = await fetch(`${API_BASE}/videos/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename })
  });
  return res.json();
}
