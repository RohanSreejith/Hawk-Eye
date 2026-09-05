import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Video, CheckCircle, Film, Play, AlertTriangle } from 'lucide-react';
import { fetchVideos, uploadVideo, selectVideo, triggerDemoScenario } from '../services/api';
import { VideoItem } from '../types';

interface VideoSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoSelected?: (filename: string) => void;
}

export const VideoSourceModal: React.FC<VideoSourceModalProps> = ({ isOpen, onClose, onVideoSelected }) => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const list = await fetchVideos();
      setVideos(list);
    } catch (e) {
      console.error('Failed loading video list', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadVideos();
      setStatusMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = async (filename: string) => {
    try {
      await selectVideo(filename);
      setVideos(prev => prev.map(v => ({ ...v, is_active: v.filename === filename })));
      setStatusMsg({ type: 'success', text: `Switched stream feed to: ${filename}` });
      if (onVideoSelected) {
        onVideoSelected(filename);
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Failed selecting video: ' + err.message });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatusMsg(null);
    try {
      const res = await uploadVideo(file);
      setStatusMsg({ type: 'success', text: `Uploaded and activated: ${res.filename}` });
      await loadVideos();
      if (onVideoSelected) {
        onVideoSelected(res.filename);
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Upload failed: ' + err.message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleQuickTrigger = async (scenario: string, label: string) => {
    try {
      await triggerDemoScenario(scenario);
      setStatusMsg({ type: 'success', text: `Triggered scenario: ${label}` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Failed triggering scenario: ' + err.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wide text-white">Video Source & Detection Inputs</h2>
              <p className="text-xs text-slate-400 font-mono">Select or upload construction CCTV demo videos for real YOLO inference</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {statusMsg && (
            <div
              className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-mono font-medium ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/40 text-rose-300'
              }`}
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Upload Box */}
          <div className="p-5 rounded-xl bg-slate-950 border-2 border-dashed border-slate-700 hover:border-sky-500/70 transition-colors text-center">
            <input
              type="file"
              ref={fileInputRef}
              accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
              onChange={handleFileUpload}
              className="hidden"
              id="kiosk-video-upload-input"
            />
            <label
              htmlFor="kiosk-video-upload-input"
              className="cursor-pointer flex flex-col items-center justify-center gap-2"
            >
              <div className="p-3 rounded-full bg-sky-500/10 text-sky-400">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <span className="text-sm font-semibold text-white block">
                  {uploading ? 'Uploading and activating video...' : 'Click to Upload Custom CCTV Video'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Supports MP4, MOV, AVI, WEBM. The video will loop and run real-time CV detection.
                </span>
              </div>
            </label>
          </div>

          {/* Video List */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-2">
              <Video className="w-4 h-4" /> Available Demonstration Feeds
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {videos.map(v => (
                <div
                  key={v.filename}
                  onClick={() => handleSelect(v.filename)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    v.is_active
                      ? 'bg-sky-950/40 border-sky-500/60 shadow-lg shadow-sky-500/10'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`p-2 rounded-lg ${v.is_active ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                      <Play className="w-4 h-4 fill-current" />
                    </div>
                    <div className="truncate">
                      <span className="text-sm font-medium text-white block truncate">{v.filename}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{v.size_mb} MB • Active Loop</span>
                    </div>
                  </div>

                  {v.is_active && (
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/40">
                      LIVE
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Simulation Trigger for Demo */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Instant Demo Scenario Triggers
            </h3>
            <p className="text-xs text-slate-400">
              Immediately dispatch a real violation through the full multi-agent pipeline and kiosk screen:
            </p>

            <div className="flex flex-wrap gap-2 pt-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => handleQuickTrigger('no_helmet', 'No Helmet Detected')}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors"
              >
                ⛑️ No Helmet Warning
              </button>
              <button
                type="button"
                onClick={() => handleQuickTrigger('vehicle_proximity', 'Vehicle Proximity')}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-colors"
              >
                🚛 Vehicle Proximity Hazard
              </button>
              <button
                type="button"
                onClick={() => handleQuickTrigger('zone_breach', 'Crane Zone Breach')}
                className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 transition-colors"
              >
                🚷 Crane Zone Breach
              </button>
              <button
                type="button"
                onClick={() => handleQuickTrigger('no_harness', 'Heights Fall Hazard')}
                className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 transition-colors"
              >
                🧗 Heights Fall Hazard
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>HACK-EYE Video Inference Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
