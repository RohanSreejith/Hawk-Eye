# SAHAYI Architecture Documentation

"We turn construction CCTV from a recording system into an active safety system."

## High-Level System Architecture

```mermaid
flowchart TD
    subgraph VideoSource["Video Ingestion Layer"]
        CCTV["CCTV / RTSP Feeds"]
        WEBCAM["Physical Laptop Webcam"]
        MP4["Historical MP4 Video Files"]
        DEMO_FEED["Synthetic Industrial CCTV Nodes"]
    end

    subgraph Perception["Edge Perception (Real Computer Vision)"]
        YOLO["YOLO11n / YOLOv8 Object Detection (GPU/CPU)"]
        TRACK["ByteTrack Anonymous Tracker (PERSON_XXX, VEHICLE_XXX)"]
        PPE["Multi-PPE Compliance Engine (Helmet, Vest, Harness, Boots, Gloves, Goggles)"]
        PROX["Spatial Centroid & Bounding Box Proximity Engine"]
        ZONE["Ray-Casting Polygon Danger Zone Engine"]
    end

    subgraph CoreEngine["Deterministic Event & Risk Engines"]
        DEDUP["Debounce & Alert Deduplicator (30s Cooldown / Anti-Fatigue)"]
        RISK["Heuristic Risk Scoring Engine (0-100: Low/Med/High/Critical)"]
    end

    subgraph Agents["Event-Driven Multi-Agent Pipeline"]
        COORD["Agent Coordinator"]
        P_AGENT["Perception Agent (Observation Normalizer)"]
        S_AGENT["Safety Agent (Rule & Zone Boundary Evaluator)"]
        R_AGENT["Risk Agent (Multi-Factor Scoring Matrix)"]
        A_AGENT["Analyst Agent (Local Ollama LLM / Llama 3.1 & Vision Qwen)"]
        RESP_AGENT["Response Agent (Action Dispatcher)"]
    end

    subgraph Interventions["Real-Time Multi-Channel Dispatches"]
        KIOSK["Site Kiosk (/kiosk) - Speech Audio Voice Warning + High-Vis HUD"]
        MOB["Supervisor Mobile Dispatch (/mobile) - Actionable Alert + Push Notification"]
        EVID["Forensic Evidence Generator (10s Pre/Post MP4 Clip + Telemetry HUD)"]
        WS["WebSocket Bus (/ws) - Real-time Dashboard Sync"]
        DB[(SQLite / SQLAlchemy Incident & Audit Store)]
    end

    CCTV & WEBCAM & MP4 & DEMO_FEED --> YOLO
    YOLO --> TRACK
    TRACK --> PPE & PROX & ZONE
    PPE & PROX & ZONE --> DEDUP
    DEDUP --> RISK
    RISK --> COORD
    COORD --> P_AGENT --> S_AGENT --> R_AGENT --> A_AGENT --> RESP_AGENT
    RESP_AGENT --> KIOSK
    RESP_AGENT --> MOB
    RESP_AGENT --> EVID
    RESP_AGENT --> WS
    RESP_AGENT --> DB
```

## Architectural Tenets
1. **Perception $\neq$ Decision**: Computer vision provides perception only (`"YOLO is the eyes, not the brain"`). Safety-critical decisions are governed by deterministic rule thresholds and mathematical hazard models.
2. **No Frame-by-Frame LLMs**: LLMs are never executed per video frame. LLMs (Ollama `llama3.1`) process structured event outputs to generate forensic summaries and executive briefs.
3. **Anti-Fatigue Deduplication**: Continuous CCTV streams debounce repetitive detections through a persistent state cooldown engine, preventing alert fatigue for safety supervisors.
4. **Forensic Evidence Buffering**: High/Critical alerts automatically synthesize a 10-second MP4 video clip (5 seconds pre-event + 5 seconds post-event) with embedded camera name, risk score, and hazard vectors.
