import React, { useState, useEffect, useRef } from 'react';
import { Eye, Shield, Cpu, Activity, CheckCircle2, ChevronRight, Zap } from 'lucide-react';

interface WelcomeIntroProps {
  onComplete: () => void;
}

export const WelcomeIntro: React.FC<WelcomeIntroProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [bootStep, setBootStep] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const hasFinishedRef = useRef(false);

  const bootMessages = [
    { text: 'Connecting Spatial Coordinate Mesh...', icon: Cpu },
    { text: 'Syncing Multi-Camera Vision Agents (CAM 1 & CAM 2)...', icon: Eye },
    { text: 'Arming OSHA Safety Compliance Engine...', icon: Shield },
    { text: 'Calibrating Real-Time Hazard Anticipation Network...', icon: Activity },
    { text: 'HAWK-EYE Autonomous Defense Grid Operational', icon: CheckCircle2 },
  ];

  // Play a soft high-tech cyber chime via Web Audio API
  const playActivationChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.3); // D6

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.65);
    } catch (_) {}
  };

  const finishIntro = () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    playActivationChime();
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 550);
  };

  useEffect(() => {
    // Keyboard listener to skip with Escape or Space
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        finishIntro();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const totalDuration = 2400; // 2.4 seconds for a snappy, impressive feel
    const intervalMs = 25;
    const increment = 100 / (totalDuration / intervalMs);

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(timer);
          setTimeout(() => finishIntro(), 250);
          return 100;
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (progress > 15 && bootStep < 1) setBootStep(1);
    if (progress > 38 && bootStep < 2) setBootStep(2);
    if (progress > 64 && bootStep < 3) setBootStep(3);
    if (progress > 90 && bootStep < 4) setBootStep(4);
  }, [progress, bootStep]);

  return (
    <div
      style={{
        ...styles.overlay,
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(1.04)' : 'scale(1)',
        pointerEvents: isFadingOut ? 'none' : 'auto',
      }}
    >
      <style>{`
        @keyframes radarSweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulseAperture {
          0%, 100% { transform: scale(1); opacity: 0.85; filter: drop-shadow(0 0 16px rgba(56, 189, 248, 0.6)); }
          50% { transform: scale(1.06); opacity: 1; filter: drop-shadow(0 0 32px rgba(56, 189, 248, 0.95)); }
        }
        @keyframes ringSpinRev {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(1000%); }
        }
        @keyframes badgeGlow {
          0%, 100% { box-shadow: 0 0 12px rgba(56, 189, 248, 0.3); }
          50% { box-shadow: 0 0 24px rgba(56, 189, 248, 0.7); }
        }
      `}</style>

      {/* Cyber Grid Background */}
      <div style={styles.gridBg} />

      {/* Ambient Lighting Cones */}
      <div style={styles.glowOrbTop} />
      <div style={styles.glowOrbBottom} />

      {/* Top Bar with Skip Button */}
      <div style={styles.topBar}>
        <div style={styles.liveBadge}>
          <span style={styles.liveDot} />
          <span style={styles.liveText}>SYSTEM INITIALIZATION // V2.0</span>
        </div>
        <button style={styles.skipBtn} onClick={finishIntro} title="Skip to Dashboard (ESC)">
          <span>Skip Intro</span>
          <ChevronRight size={14} color="#94a3b8" />
        </button>
      </div>

      {/* Central Content */}
      <div style={styles.centerContainer}>
        {/* Holographic Radar / Eye Aperture */}
        <div style={styles.apertureContainer}>
          {/* Outer Ring */}
          <div style={styles.outerRing} />
          {/* Reverse Orbit Ring */}
          <div style={styles.revRing} />
          {/* Radar Scanner Line */}
          <div style={styles.radarNeedle} />
          {/* Core Glowing Emblem */}
          <div style={styles.coreEmblem}>
            <Eye size={42} color="#38bdf8" strokeWidth={2.2} />
          </div>
        </div>

        {/* Brand Title */}
        <div style={styles.brandBox}>
          <div style={styles.titleRow}>
            <span style={styles.titlePrefix}>HAWK</span>
            <span style={styles.titleHyphen}>-</span>
            <span style={styles.titleSuffix}>EYE</span>
          </div>
          <div style={styles.brandBadge}>
            <Zap size={11} color="#38bdf8" style={{ marginRight: 5 }} />
            <span>AUTONOMOUS MULTI-CAMERA INCIDENT INTELLIGENCE</span>
          </div>
        </div>

        {/* Futuristic Telemetry Log Terminal */}
        <div style={styles.terminalCard}>
          <div style={styles.terminalHeader}>
            <span style={styles.termDotRed} />
            <span style={styles.termDotYellow} />
            <span style={styles.termDotGreen} />
            <span style={styles.termTitle}>HAWK PERCEPTION BOOT SEQUENCE</span>
          </div>
          <div style={styles.terminalBody}>
            {bootMessages.map((item, index) => {
              const Icon = item.icon;
              const isPassed = index <= bootStep;
              const isCurrent = index === bootStep;
              return (
                <div
                  key={index}
                  style={{
                    ...styles.terminalRow,
                    opacity: isPassed ? 1 : 0.25,
                    color: isCurrent ? '#38bdf8' : isPassed ? '#cbd5e1' : '#475569',
                  }}
                >
                  <Icon
                    size={14}
                    color={isCurrent ? '#38bdf8' : isPassed ? '#10b981' : '#475569'}
                    style={{ marginRight: 8, flexShrink: 0 }}
                  />
                  <span style={styles.terminalText}>{item.text}</span>
                  {isPassed && (
                    <span style={styles.termOkBadge}>{index === 4 ? 'READY' : 'OK'}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress Bar and Indicator */}
        <div style={styles.progressSection}>
          <div style={styles.progressInfoRow}>
            <span style={styles.progressLabel}>
              {progress < 100 ? 'CONNECTING ACTIVE SAFETY SENSORS' : 'ALL PERIMETER DEFENSE ZONES ACTIVE'}
            </span>
            <span style={styles.progressPct}>{Math.min(100, Math.floor(progress))}%</span>
          </div>
          <div style={styles.progressBarTrack}>
            <div
              style={{
                ...styles.progressBarFill,
                width: `${progress}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div style={styles.footerNote}>
        <span>PRESS <kbd style={styles.kbd}>ESC</kbd> OR CLICK ANYWHERE TO ENTER DIRECTLY</span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 99999,
    backgroundColor: '#020617',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 32px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
  },
  gridBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `
      linear-gradient(to right, rgba(56, 189, 248, 0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(56, 189, 248, 0.05) 1px, transparent 1px)
    `,
    backgroundSize: '48px 48px',
    pointerEvents: 'none',
  },
  glowOrbTop: {
    position: 'absolute',
    top: '-15%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '600px',
    height: '600px',
    background: 'radial-gradient(circle, rgba(37, 99, 235, 0.22) 0%, rgba(56, 189, 248, 0.08) 40%, transparent 70%)',
    pointerEvents: 'none',
    filter: 'blur(40px)',
  },
  glowOrbBottom: {
    position: 'absolute',
    bottom: '-20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '700px',
    height: '500px',
    background: 'radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, transparent 65%)',
    pointerEvents: 'none',
    filter: 'blur(50px)',
  },
  topBar: {
    width: '100%',
    maxWidth: '860px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  liveBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    borderRadius: '20px',
    padding: '6px 14px',
    backdropFilter: 'blur(8px)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: '#38bdf8',
    boxShadow: '0 0 8px #38bdf8',
  },
  liveText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '1px',
  },
  skipBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: '20px',
    padding: '6px 14px',
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  centerContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 10,
    width: '100%',
    maxWidth: '560px',
  },
  apertureContainer: {
    position: 'relative',
    width: '124px',
    height: '124px',
    marginBottom: '28px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: '2px dashed rgba(56, 189, 248, 0.45)',
    animation: 'radarSweep 12s linear infinite',
  },
  revRing: {
    position: 'absolute',
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    border: '1px solid rgba(14, 165, 233, 0.35)',
    borderTopColor: '#38bdf8',
    borderRightColor: 'transparent',
    animation: 'ringSpinRev 5s linear infinite',
  },
  radarNeedle: {
    position: 'absolute',
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    background: 'conic-gradient(from 0deg, rgba(56, 189, 248, 0.25) 0deg, transparent 60deg, transparent 360deg)',
    animation: 'radarSweep 3s linear infinite',
  },
  coreEmblem: {
    width: '74px',
    height: '74px',
    borderRadius: '50%',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    border: '2px solid #38bdf8',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    animation: 'pulseAperture 3s ease-in-out infinite',
    boxShadow: '0 0 24px rgba(56, 189, 248, 0.5)',
  },
  brandBox: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    fontSize: 38,
    fontWeight: 900,
    letterSpacing: '3px',
    lineHeight: 1.1,
  },
  titlePrefix: {
    color: '#ffffff',
  },
  titleHyphen: {
    color: '#38bdf8',
  },
  titleSuffix: {
    background: 'linear-gradient(135deg, #38bdf8 0%, #60a5fa 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  brandBadge: {
    marginTop: 8,
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    borderRadius: '6px',
    padding: '4px 12px',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '1.4px',
    color: '#38bdf8',
  },
  terminalCard: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    border: '1px solid rgba(56, 189, 248, 0.2)',
    borderRadius: '12px',
    overflow: 'hidden',
    backdropFilter: 'blur(12px)',
    marginBottom: '24px',
    boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.5)',
  },
  terminalHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
    gap: 6,
  },
  termDotRed: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#ef4444',
  },
  termDotYellow: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#f59e0b',
  },
  termDotGreen: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#10b981',
  },
  termTitle: {
    marginLeft: 8,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#64748b',
    fontFamily: 'monospace',
  },
  terminalBody: {
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  terminalRow: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 12,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
    transition: 'all 0.3s ease',
  },
  terminalText: {
    flex: 1,
    letterSpacing: '0.3px',
  },
  termOkBadge: {
    fontSize: 10,
    fontWeight: 800,
    padding: '1px 6px',
    borderRadius: '4px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    letterSpacing: '0.8px',
  },
  progressSection: {
    width: '100%',
  },
  progressInfoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.8px',
    color: '#94a3b8',
  },
  progressPct: {
    fontSize: 13,
    fontWeight: 800,
    color: '#38bdf8',
    fontFamily: 'monospace',
  },
  progressBarTrack: {
    width: '100%',
    height: '6px',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: '999px',
    overflow: 'hidden',
    border: '1px solid rgba(56, 189, 248, 0.15)',
  },
  progressBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #2563eb 0%, #38bdf8 60%, #60a5fa 100%)',
    borderRadius: '999px',
    boxShadow: '0 0 12px rgba(56, 189, 248, 0.7)',
    transition: 'width 0.08s ease-out',
  },
  footerNote: {
    zIndex: 10,
    fontSize: 11,
    color: '#64748b',
    fontWeight: 600,
    letterSpacing: '1px',
    textAlign: 'center',
  },
  kbd: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: 10,
    color: '#cbd5e1',
    fontFamily: 'monospace',
    margin: '0 4px',
  },
};
