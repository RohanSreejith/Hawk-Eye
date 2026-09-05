# SAHAYI REST & WebSocket API Reference

The backend operates on `http://localhost:8000`. Interactive OpenAPI documentation is accessible at `/docs`.

## System & Telemetry
- `GET /api/health` — Basic service liveness check.
- `GET /api/system/status` — Comprehensive status including active vision engine mode, YOLO model name, device (CPU/GPU), database, notification router, and privacy disclosure.
- `GET /api/agents/logs` — Real-time operational decision logs across the 5 agents.

## Incident Management
- `GET /api/incidents` — List recent safety incidents. Query params: `status` (`open`, `acknowledged`, `resolved`), `severity` (`low`, `warning`, `high`, `critical`).
- `GET /api/incidents/{id}` — Full forensic detail of a specific incident, including video evidence path, audit timeline, and AI summary.
- `POST /api/incidents/{id}/acknowledge` — Marks incident as acknowledged by supervisor and broadcasts status over WebSockets.
- `POST /api/incidents/{id}/resolve` — Marks incident as resolved and updates safety metrics.

## Camera Feeds & Danger Zones
- `GET /api/cameras` — List all registered camera nodes.
- `GET /api/cameras/{id}` — Single camera detail and zone association.
- `GET /api/cameras/{id}/stream` — Live MJPEG multipart video stream with dynamic bounding box annotations.
- `GET /api/zones` — List all site zones with normalized polygon coordinates and required PPE mandates.

## Analytics & Risk Heatmap
- `GET /api/analytics` — Distribution of incidents by type, severity breakdown, hourly trend, and alert suppression stats.
- `GET /api/analytics/kpis` — Real-time dashboard KPI cards.
- `GET /api/heatmap` — Zone-by-zone calculated risk index, high-risk incident counts, top hazards, and recent event timestamps.

## Demo Engine Controls
- `POST /api/demo/trigger?scenario={id}` — Immediately dispatches a full end-to-end safety event through the coordinator.
  - Supported scenarios: `no_helmet`, `vehicle_proximity`, `zone_breach`, `no_harness`, `compound_ppe`.
- `POST /api/demo/start` — Starts sequential automated simulation loop.
- `POST /api/demo/stop` — Pauses automated simulation loop.
- `POST /api/demo/clear` — Clears historical incident records from the database.

## WebSocket Bus
- `WS /ws` — Real-time bidirectional event bus.
  - Broadcasts `incident_created`, `incident_updated`, `agent_step`, `camera_status`.
