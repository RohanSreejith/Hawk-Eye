export interface Incident {
  id: number;
  event_id: string;
  camera_id: string;
  site_id: string;
  zone: string;
  event_type: string;
  severity: 'low' | 'warning' | 'high' | 'critical';
  confidence: number;
  risk_score: number;
  timestamp: string;
  description: string;
  recommended_action: string;
  ai_summary?: string;
  status: 'open' | 'acknowledged' | 'resolved';
  acknowledged_at?: string;
  resolved_at?: string;
  evidence_clip_path?: string;
}

export interface Camera {
  id: string;
  name: string;
  zone: string;
  status: 'online' | 'offline';
  stream_url: string;
}

export interface Zone {
  id: string;
  site_id: string;
  name: string;
  type: string;
  polygon: { x: number; y: number }[];
  risk_level: string;
  required_ppe: string[];
}

export interface HeatmapZone {
  zone_id: string;
  name: string;
  type: string;
  risk_level: string;
  polygon: { x: number; y: number }[];
  required_ppe: string[];
  total_incidents: number;
  high_risk_incidents: number;
  risk_index: number;
  top_hazard: string;
  recent_incident: string;
}

export interface KPIs {
  system_status: string;
  cameras_online: string;
  active_incidents: number;
  high_risk_events: number;
  workers_monitored: number;
  alerts_today: number;
  alerts_suppressed: number;
  avg_response_sec: number;
  data_mode: string;
}

export interface AgentLog {
  agent_name: string;
  action: string;
  detail: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'high' | 'critical';
}

export interface SystemStatus {
  system_status: string;
  vision_engine: string;
  vision_mode: string;
  model_name: string;
  device: string;
  event_engine: string;
  agent_coordinator: string;
  database: string;
  notification_service: string;
  cameras_online: string;
  llm_service: string;
  privacy_policy: string;
}

export interface SupervisorSettings {
  supervisor_name: string;
  supervisor_role: string;
  phone_number: string;
  delivery_channel: 'sms' | 'whatsapp' | 'webhook';
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_from_number?: string;
  webhook_url?: string;
  alert_on_warning?: boolean;
  alert_on_critical?: boolean;
}

export interface VideoItem {
  filename: string;
  size_mb: number;
  path: string;
  is_active: boolean;
}
