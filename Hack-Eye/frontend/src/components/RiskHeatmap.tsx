import React, { useState } from 'react';
import { MapPin, ShieldAlert, AlertTriangle, Layers, Info } from 'lucide-react';
import { HeatmapZone } from '../types';

interface RiskHeatmapProps {
  heatmapZones: HeatmapZone[];
  onSelectZone?: (zone: HeatmapZone) => void;
}

export const RiskHeatmap: React.FC<RiskHeatmapProps> = ({ heatmapZones, onSelectZone }) => {
  const [selectedZone, setSelectedZone] = useState<HeatmapZone | null>(null);

  // Fallback zones if database is loading
  const zones: HeatmapZone[] = heatmapZones.length > 0 ? heatmapZones : [
    { zone_id: 'ZONE_GATE', name: 'Main Gate', type: 'standard', risk_level: 'low', polygon: [], required_ppe: ['helmet', 'vest'], total_incidents: 4, high_risk_incidents: 0, risk_index: 24, top_hazard: 'No Helmet', recent_incident: '10:45:12' },
    { zone_id: 'ZONE_LOADING', name: 'Loading Zone', type: 'loading', risk_level: 'high', polygon: [], required_ppe: ['helmet', 'vest', 'boots'], total_incidents: 12, high_risk_incidents: 5, risk_index: 82, top_hazard: 'Vehicle Proximity', recent_incident: '11:32:14' },
    { zone_id: 'ZONE_FLOOR1', name: 'Floor 1', type: 'height', risk_level: 'high', polygon: [], required_ppe: ['helmet', 'vest', 'harness', 'boots'], total_incidents: 6, high_risk_incidents: 3, risk_index: 68, top_hazard: 'No Harness', recent_incident: '11:15:30' },
    { zone_id: 'ZONE_CRANE', name: 'Crane Area', type: 'restricted', risk_level: 'critical', polygon: [], required_ppe: ['helmet', 'vest', 'harness', 'eye_protection'], total_incidents: 7, high_risk_incidents: 4, risk_index: 91, top_hazard: 'Zone Breach', recent_incident: '11:27:04' },
    { zone_id: 'ZONE_MATERIAL', name: 'Material Storage', type: 'standard', risk_level: 'medium', polygon: [], required_ppe: ['helmet', 'vest', 'gloves', 'boots'], total_incidents: 5, high_risk_incidents: 1, risk_index: 44, top_hazard: 'No Gloves', recent_incident: '10:55:00' },
    { zone_id: 'ZONE_EXCAVATION', name: 'Excavation Area', type: 'restricted', risk_level: 'critical', polygon: [], required_ppe: ['helmet', 'vest', 'boots'], total_incidents: 8, high_risk_incidents: 3, risk_index: 76, top_hazard: 'Proximity to Edge', recent_incident: '11:02:45' },
  ];

  const activeZone = selectedZone || zones[1]; // default to Loading Zone

  const getRiskColor = (score: number) => {
    if (score >= 75) return { fill: '#ef4444', text: 'text-rose-400', border: 'border-rose-500' };
    if (score >= 50) return { fill: '#f97316', text: 'text-orange-400', border: 'border-orange-500' };
    if (score >= 25) return { fill: '#f59e0b', text: 'text-amber-400', border: 'border-amber-500' };
    return { fill: '#10b981', text: 'text-emerald-400', border: 'border-emerald-500' };
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-md mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-bold tracking-wider text-slate-200">
            SITE RISK HEATMAP (DYNAMIC SPATIAL HAZARDS)
          </h2>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500" /> Low (0-24)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500" /> Warning (25-49)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-500" /> High (50-74)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-rose-500" /> Critical (75-100)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Custom Interactive SVG Site Map (8 cols) */}
        <div className="lg:col-span-8 bg-slate-950 rounded-lg p-3 border border-slate-800 flex items-center justify-center relative min-h-[300px]">
          <svg viewBox="0 0 800 450" className="w-full h-auto select-none">
            {/* Background Site Grid */}
            <defs>
              <pattern id="siteGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1c2533" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="800" height="450" fill="url(#siteGrid)" />

            {/* Perimeter Fence Line */}
            <rect x="20" y="20" width="760" height="410" fill="none" stroke="#2a384c" strokeWidth="2" strokeDasharray="6 4" />
            <text x="35" y="42" fill="#475569" fontSize="11" fontFamily="monospace">PERIMETER BOUNDARY • SECTOR 42</text>

            {/* Zone 1: Main Gate (Top Left) */}
            <g
              onClick={() => setSelectedZone(zones.find(z => z.name.includes('Gate')) || zones[0])}
              className="cursor-pointer group"
            >
              <rect
                x="40" y="60" width="200" height="150" rx="8"
                fill="#10b981" fillOpacity="0.25"
                stroke="#10b981" strokeWidth={activeZone.name.includes('Gate') ? "3" : "1.5"}
                className="transition-all hover:fill-opacity-40"
              />
              <text x="55" y="90" fill="#10b981" fontSize="13" fontWeight="bold" fontFamily="monospace">MAIN GATE</text>
              <text x="55" y="115" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">Checkpoint & Ingress</text>
              <text x="55" y="180" fill="#cbd5e1" fontSize="11" fontFamily="monospace">RISK: 24/100</text>
            </g>

            {/* Zone 2: Loading Zone (Center Top - Active Hazard) */}
            <g
              onClick={() => setSelectedZone(zones.find(z => z.name.includes('Loading')) || zones[1])}
              className="cursor-pointer group"
            >
              <rect
                x="260" y="60" width="280" height="180" rx="8"
                fill="#ef4444" fillOpacity="0.35"
                stroke="#ef4444" strokeWidth={activeZone.name.includes('Loading') ? "3.5" : "2"}
                className="transition-all hover:fill-opacity-50"
              />
              <text x="275" y="90" fill="#fca5a5" fontSize="13" fontWeight="bold" fontFamily="monospace">LOADING ZONE</text>
              <text x="275" y="115" fill="#e2e8f0" fontSize="10">Heavy Trucks & Forklifts</text>
              {/* Alert Badge */}
              <rect x="440" y="70" width="90" height="20" rx="4" fill="#ef4444" />
              <text x="448" y="84" fill="#ffffff" fontSize="9" fontWeight="bold">HIGH VEHICLE RISK</text>
              <text x="275" y="215" fill="#fee2e2" fontSize="12" fontWeight="bold" fontFamily="monospace">RISK INDEX: 82/100</text>
            </g>

            {/* Zone 3: Crane Area (Top Right) */}
            <g
              onClick={() => setSelectedZone(zones.find(z => z.name.includes('Crane')) || zones[3])}
              className="cursor-pointer group"
            >
              <rect
                x="560" y="60" width="200" height="180" rx="8"
                fill="#f97316" fillOpacity="0.30"
                stroke="#f97316" strokeWidth={activeZone.name.includes('Crane') ? "3" : "1.5"}
                className="transition-all hover:fill-opacity-45"
              />
              <circle cx="660" cy="150" r="45" fill="none" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4 2" />
              <text x="575" y="90" fill="#fdba74" fontSize="13" fontWeight="bold" fontFamily="monospace">CRANE AREA</text>
              <text x="575" y="115" fill="#94a3b8" fontSize="10">Overhead Hoist Radius</text>
              <text x="575" y="225" fill="#ffedd5" fontSize="11" fontFamily="monospace">RISK: 91/100</text>
            </g>

            {/* Zone 4: Floor 1 (Bottom Left) */}
            <g
              onClick={() => setSelectedZone(zones.find(z => z.name.includes('Floor')) || zones[2])}
              className="cursor-pointer group"
            >
              <rect
                x="40" y="230" width="240" height="180" rx="8"
                fill="#f59e0b" fillOpacity="0.25"
                stroke="#f59e0b" strokeWidth={activeZone.name.includes('Floor') ? "3" : "1.5"}
                className="transition-all hover:fill-opacity-40"
              />
              <text x="55" y="260" fill="#fcd34d" fontSize="13" fontWeight="bold" fontFamily="monospace">FLOOR 1 SLAB</text>
              <text x="55" y="285" fill="#94a3b8" fontSize="10">Elevated Edge Hazard</text>
              <text x="55" y="385" fill="#fef3c7" fontSize="11" fontFamily="monospace">RISK: 68/100</text>
            </g>

            {/* Zone 5: Material Storage (Center Bottom) */}
            <g
              onClick={() => setSelectedZone(zones.find(z => z.name.includes('Material')) || zones[4])}
              className="cursor-pointer group"
            >
              <rect
                x="300" y="260" width="240" height="150" rx="8"
                fill="#10b981" fillOpacity="0.25"
                stroke="#10b981" strokeWidth={activeZone.name.includes('Material') ? "3" : "1.5"}
                className="transition-all hover:fill-opacity-40"
              />
              <text x="315" y="290" fill="#6ee7b7" fontSize="13" fontWeight="bold" fontFamily="monospace">MATERIAL STORAGE</text>
              <text x="315" y="315" fill="#94a3b8" fontSize="10">Rebar & Steel Framing</text>
              <text x="315" y="385" fill="#d1fae5" fontSize="11" fontFamily="monospace">RISK: 44/100</text>
            </g>

            {/* Zone 6: Excavation Area (Bottom Right) */}
            <g
              onClick={() => setSelectedZone(zones.find(z => z.name.includes('Excavation')) || zones[5])}
              className="cursor-pointer group"
            >
              <rect
                x="560" y="260" width="200" height="150" rx="8"
                fill="#f97316" fillOpacity="0.30"
                stroke="#f97316" strokeWidth={activeZone.name.includes('Excavation') ? "3" : "1.5"}
                className="transition-all hover:fill-opacity-45"
              />
              <text x="575" y="290" fill="#fdba74" fontSize="13" fontWeight="bold" fontFamily="monospace">EXCAVATION PIT</text>
              <text x="575" y="315" fill="#94a3b8" fontSize="10">Deep Trench & Shoring</text>
              <text x="575" y="385" fill="#ffedd5" fontSize="11" fontFamily="monospace">RISK: 76/100</text>
            </g>
          </svg>
        </div>

        {/* Selected Zone Deep Dive Panel (4 cols) */}
        <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-400">ZONE INSPECTION</span>
              <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded uppercase ${getRiskColor(activeZone.risk_index).text} bg-slate-900 border ${getRiskColor(activeZone.risk_index).border}`}>
                {activeZone.risk_level} RISK
              </span>
            </div>

            <h3 className="text-lg font-bold text-white mb-1">{activeZone.name}</h3>
            <p className="text-xs text-slate-400 mb-4">Type: {activeZone.type.toUpperCase()}</p>

            {/* Metrics List */}
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-slate-900">
                <span className="text-slate-400">Hazard Risk Index:</span>
                <span className={`font-bold ${getRiskColor(activeZone.risk_index).text}`}>
                  {activeZone.risk_index} / 100
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-900">
                <span className="text-slate-400">Total Incidents:</span>
                <span className="text-white font-bold">{activeZone.total_incidents}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-900">
                <span className="text-slate-400">High-Risk Events:</span>
                <span className="text-rose-400 font-bold">{activeZone.high_risk_incidents}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-900">
                <span className="text-slate-400">Top Detected Hazard:</span>
                <span className="text-amber-300 font-bold">{activeZone.top_hazard}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-900">
                <span className="text-slate-400">Latest Event Time:</span>
                <span className="text-slate-300">{activeZone.recent_incident}</span>
              </div>
            </div>

            {/* Required PPE Mandates */}
            <div className="mt-4">
              <span className="text-[11px] font-mono text-slate-400 block mb-1.5">
                ENFORCED PPE MANDATES:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(activeZone.required_ppe || ['helmet', 'vest']).map((ppe, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-900 border border-slate-700 text-slate-300 uppercase"
                  >
                    ✓ {ppe.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-900 text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Click any zone polygon on the map to inspect real-time safety telemetry.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
