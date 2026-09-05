import React, { useState } from 'react';
import { Camera as CameraIcon, Maximize2, Minimize2, Video, AlertCircle } from 'lucide-react';
import { Camera } from '../types';

interface CameraGridProps {
  cameras: Camera[];
  selectedCamId?: string;
  onSelectCamera?: (id: string) => void;
}

export const CameraGrid: React.FC<CameraGridProps> = ({
  cameras,
  selectedCamId,
  onSelectCamera
}) => {
  const [fullscreenCam, setFullscreenCam] = useState<string | null>(null);

  const displayCameras = cameras.length > 0 ? cameras : [
    { id: 'CAM_01', name: 'CAM 01 Main Gate', zone: 'Main Gate', status: 'online' as const, stream_url: '/api/cameras/CAM_01/stream' },
    { id: 'CAM_02', name: 'CAM 02 Loading Zone', zone: 'Loading Zone', status: 'online' as const, stream_url: '/api/cameras/CAM_02/stream' },
    { id: 'CAM_03', name: 'CAM 03 Floor 1', zone: 'Floor 1', status: 'online' as const, stream_url: '/api/cameras/CAM_03/stream' },
    { id: 'CAM_04', name: 'CAM 04 Crane Area', zone: 'Crane Area', status: 'online' as const, stream_url: '/api/cameras/CAM_04/stream' },
    { id: 'CAM_05', name: 'CAM 05 Material Storage', zone: 'Material Storage', status: 'online' as const, stream_url: '/api/cameras/CAM_05/stream' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-md mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CameraIcon className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold tracking-wider text-slate-200">LIVE CCTV MATRIX (5 NODES)</h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            AUTO DETECT & TRACK ACTIVE
          </span>
        </div>
        {fullscreenCam && (
          <button
            onClick={() => setFullscreenCam(null)}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-1 rounded"
          >
            <Minimize2 className="w-3.5 h-3.5" /> Close Zoom
          </button>
        )}
      </div>

      <div className={`grid gap-2.5 ${fullscreenCam ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
        {displayCameras
          .filter(c => !fullscreenCam || c.id === fullscreenCam)
          .map((cam) => {
            const isSelected = selectedCamId === cam.id;
            return (
              <div
                key={cam.id}
                onClick={() => onSelectCamera && onSelectCamera(cam.id)}
                className={`relative rounded-lg overflow-hidden border bg-slate-950 flex flex-col group cursor-pointer transition-all ${
                  isSelected ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-slate-800 hover:border-slate-700'
                } ${fullscreenCam ? 'h-[460px]' : 'h-[210px]'}`}
              >
                {/* Live Stream View */}
                <div className="relative flex-1 w-full bg-slate-950 overflow-hidden flex items-center justify-center">
                  <img
                    src={cam.stream_url}
                    alt={cam.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback if image stream is interrupted
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />

                  {/* Simulated bounding boxes for visual feedback */}
                  <div className="absolute inset-0 pointer-events-none p-2 flex flex-col justify-between">
                    {/* Top HUD */}
                    <div className="flex items-center justify-between bg-slate-950/75 backdrop-blur-xs px-2 py-1 rounded border border-slate-800 text-[10px] font-mono">
                      <div className="flex items-center gap-1.5 text-slate-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                        <span className="font-bold">{cam.id}</span> • {cam.zone}
                      </div>
                      <span className="text-emerald-400 font-semibold">ONLINE (15 FPS)</span>
                    </div>

                    {/* Bottom Bounding Box Labels */}
                    <div className="flex items-center justify-between">
                      <div className="bg-slate-900/80 px-2 py-0.5 rounded text-[9px] font-mono text-slate-400 border border-slate-700/60">
                        {cam.id === 'CAM_02' ? 'ANONYMOUS: PERSON_014, VEHICLE_004' : 'ANONYMOUS: PERSON_012'}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullscreenCam(fullscreenCam === cam.id ? null : cam.id);
                        }}
                        className="bg-slate-900/90 hover:bg-slate-800 text-slate-300 p-1 rounded pointer-events-auto transition-colors"
                        title="Toggle Zoom"
                      >
                        {fullscreenCam === cam.id ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Sub-Bar */}
                <div className="bg-slate-900 px-2.5 py-1.5 flex items-center justify-between border-t border-slate-800 text-xs">
                  <span className="font-medium text-slate-300">{cam.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">ZONE: {cam.zone.toUpperCase()}</span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
