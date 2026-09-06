import React, { useState, useEffect, useRef } from 'react';
import { Eye, Shield, Cpu, Activity, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';

interface WelcomeIntroProps {
  onComplete: () => void;
}

export const WelcomeIntro: React.FC<WelcomeIntroProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [bootStep, setBootStep] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const hasFinishedRef = useRef(false);

  const bootMessages = [
    { text: 'Connecting Spatial Coordinate Mesh (Cam 1 ↔ Cam 2)...', icon: Cpu },
    { text: 'Syncing Multi-Camera Vision Agents & YOLO PPE Model...', icon: Eye },
    { text: 'Arming Autonomous Braking & Acoustic Standoff Interlocks...', icon: Shield },
    { text: 'Calibrating Real-Time Hazard Anticipation Network...', icon: Activity },
    { text: 'HAWK AI Operations Grid Online & Fully Synchronized', icon: CheckCircle2 },
  ];

  // Soft high-fidelity activation chime using Web Audio API
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
      gain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (_) {}
  };

  const finishIntro = () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    playActivationChime();
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 450);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        finishIntro();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const totalDuration = 2400; // 2.4 seconds
    const intervalMs = 25;
    const increment = 100 / (totalDuration / intervalMs);

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(timer);
          setTimeout(() => finishIntro(), 200);
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
        transform: isFadingOut ? 'scale(1.02)' : 'scale(1)',
        pointerEvents: isFadingOut ? 'none' : 'auto',
      }}
      onClick={finishIntro}
    >
      <style>{`
        @keyframes orbitSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes orbitSpinRev {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes hawkGlowPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 10px 28px rgba(30, 58, 138, 0.12); }
          50% { transform: scale(1.04); box-shadow: 0 14px 36px rgba(59, 130, 246, 0.22); }
        }
        @keyframes greenPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.15); }
        }
      `}</style>

      {/* Ambient Radial Background */}
      <div style={styles.ambientTop} />
      <div style={styles.ambientBottom} />

      {/* Top Header Row with System Badge and Skip Button */}
      <div style={styles.topBar}>
        <div style={styles.liveBadge}>
          <span style={styles.liveDot} />
          <span style={styles.liveText}>SYSTEM INITIALIZATION // ALL SENSORS ONLINE</span>
        </div>
        <button
          style={styles.skipBtn}
          onClick={(e) => {
            e.stopPropagation();
            finishIntro();
          }}
          title="Skip to Dashboard (ESC)"
        >
          <span>Skip to Dashboard</span>
          <ChevronRight size={14} color="#64748b" />
        </button>
      </div>

      {/* Central Hero Container */}
      <div style={styles.centerContainer} onClick={(e) => e.stopPropagation()}>
        {/* Animated Brand Emblem */}
        <div style={styles.emblemWrapper}>
          <div style={styles.outerRing} />
          <div style={styles.innerRing} />
          <div style={styles.emblemCard}>
            <svg width="44" height="44" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4 14C8 14 12 11 15 7C17 4 20 2 24 2C22 7 24 10 28 13C25 15 22 17 21 21C20 25 18 29 14 30C15 26 14 23 11 20C8 18 5 17 4 14Z"
                fill="#1e3a8a"
              />
              <path
                d="M15 7C17 11 21 13 25 14C21 16 19 19 18 23C16 19 14 16 10 15C12 12 13 9 15 7Z"
                fill="#3b82f6"
              />
            </svg>
          </div>
        </div>

        {/* Brand Typography */}
        <div style={styles.brandBox}>
          <div style={styles.brandTitleRow}>
            <span style={styles.brandName}>HAWK</span>
            <div style={styles.taglinePill}>
              <Sparkles size={11} color="#0284c7" style={{ marginRight: 4 }} />
              <span>AI for a Safer Tomorrow</span>
            </div>
          </div>
          <p style={styles.brandSub}>Autonomous Multi-Agent Workplace Safety & Risk Anticipation</p>
        </div>

        {/* Sequence Status Card */}
        <div style={styles.sequenceCard}>
          <div style={styles.sequenceHeader}>
            <div style={styles.headerDotCol}>
              <span style={{ ...styles.headerDot, backgroundColor: '#cbd5e1' }} />
              <span style={{ ...styles.headerDot, backgroundColor: '#94a3b8' }} />
              <span style={{ ...styles.headerDot, backgroundColor: '#3b82f6' }} />
            </div>
            <span style={styles.sequenceTitle}>MULTI-AGENT BOOT TELEMETRY</span>
          </div>

          <div style={styles.sequenceBody}>
            {bootMessages.map((item, index) => {
              const Icon = item.icon;
              const isPassed = index <= bootStep;
              const isCurrent = index === bootStep;

              return (
                <div
                  key={index}
                  style={{
                    ...styles.sequenceRow,
                    backgroundColor: isCurrent ? '#f0f9ff' : isPassed ? '#f8fafc' : 'transparent',
                    border: isCurrent ? '1px solid #bae6fd' : '1px solid transparent',
                    opacity: isPassed ? 1 : 0.35,
                  }}
                >
                  <div
                    style={{
                      ...styles.rowIconWrapper,
                      backgroundColor: isCurrent ? '#e0f2fe' : isPassed ? '#dcfce7' : '#f1f5f9',
                    }}
                  >
                    <Icon
                      size={14}
                      color={isCurrent ? '#0284c7' : isPassed ? '#16a34a' : '#94a3b8'}
                    />
                  </div>
                  <span
                    style={{
                      ...styles.rowText,
                      color: isCurrent ? '#0369a1' : isPassed ? '#1e293b' : '#64748b',
                      fontWeight: isCurrent ? 700 : isPassed ? 600 : 500,
                    }}
                  >
                    {item.text}
                  </span>
                  {isPassed && (
                    <span
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: index === 4 ? '#dbeafe' : '#dcfce7',
                        color: index === 4 ? '#1d4ed8' : '#15803d',
                        borderColor: index === 4 ? '#bfdbfe' : '#bbf7d0',
                      }}
                    >
                      {index === 4 ? 'READY' : 'OK'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress Bar Container */}
        <div style={styles.progressCard}>
          <div style={styles.progressMeta}>
            <span style={styles.progressLabel}>
              {progress < 100 ? 'SYNCHRONIZING SAFETY NETWORK' : 'ALL SYSTEMS FULLY OPERATIONAL'}
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

      {/* Footer Helper Note */}
      <div style={styles.footerNote}>
        <span>PRESS <kbd style={styles.kbd}>ESC</kbd> OR CLICK TO PROCEED TO DASHBOARD</span>
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
    backgroundColor: '#f0f4f9',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 32px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    transition: 'opacity 0.45s ease, transform 0.45s ease',
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  ambientTop: {
    position: 'absolute',
    top: '-15%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '650px',
    height: '450px',
    background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, rgba(30, 58, 138, 0.04) 50%, transparent 70%)',
    pointerEvents: 'none',
    filter: 'blur(50px)',
  },
  ambientBottom: {
    position: 'absolute',
    bottom: '-15%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '600px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(14, 165, 233, 0.08) 0%, transparent 65%)',
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
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '20px',
    padding: '6px 14px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 8px rgba(16, 185, 129, 0.7)',
    animation: 'greenPulse 1.8s infinite',
  },
  liveText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.6px',
  },
  skipBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '20px',
    padding: '6px 14px',
    color: '#475569',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
    transition: 'all 0.15s ease',
  },
  centerContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 10,
    width: '100%',
    maxWidth: '520px',
    cursor: 'default',
  },
  emblemWrapper: {
    position: 'relative',
    width: '104px',
    height: '104px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: '102px',
    height: '102px',
    borderRadius: '50%',
    border: '2px dashed #bfdbfe',
    animation: 'orbitSpin 16s linear infinite',
  },
  innerRing: {
    position: 'absolute',
    width: '86px',
    height: '86px',
    borderRadius: '50%',
    border: '1px solid #e2e8f0',
    borderTopColor: '#3b82f6',
    animation: 'orbitSpinRev 6s linear infinite',
  },
  emblemCard: {
    width: '70px',
    height: '70px',
    borderRadius: '20px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 10px 24px rgba(30, 58, 138, 0.12)',
    animation: 'hawkGlowPulse 3s ease-in-out infinite',
  },
  brandBox: {
    textAlign: 'center',
    marginBottom: '22px',
  },
  brandTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  brandName: {
    fontSize: '34px',
    fontWeight: 900,
    color: '#0f172a',
    letterSpacing: '-0.6px',
  },
  taglinePill: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '16px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#0284c7',
  },
  brandSub: {
    fontSize: '13px',
    color: '#64748b',
    marginTop: '5px',
    fontWeight: 500,
  },
  sequenceCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03)',
    marginBottom: '18px',
  },
  sequenceHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 14px',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    gap: 8,
  },
  headerDotCol: {
    display: 'flex',
    gap: 5,
  },
  headerDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
  },
  sequenceTitle: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.8px',
    color: '#64748b',
  },
  sequenceBody: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  sequenceRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
  },
  rowIconWrapper: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '10px',
    flexShrink: 0,
  },
  rowText: {
    flex: 1,
    fontSize: '12px',
    lineHeight: '1.3',
  },
  statusBadge: {
    fontSize: '9px',
    fontWeight: 800,
    padding: '2px 7px',
    borderRadius: '6px',
    border: '1px solid',
    letterSpacing: '0.5px',
  },
  progressCard: {
    width: '100%',
  },
  progressMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  progressLabel: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.6px',
    color: '#64748b',
  },
  progressPct: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#1e3a8a',
  },
  progressBarTrack: {
    width: '100%',
    height: '6px',
    backgroundColor: '#e2e8f0',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #1e3a8a 0%, #2563eb 50%, #38bdf8 100%)',
    borderRadius: '999px',
    boxShadow: '0 0 8px rgba(37, 99, 235, 0.4)',
    transition: 'width 0.06s ease-out',
  },
  footerNote: {
    zIndex: 10,
    fontSize: '11px',
    color: '#64748b',
    fontWeight: 600,
    letterSpacing: '0.8px',
    textAlign: 'center',
  },
  kbd: {
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '10px',
    color: '#334155',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    margin: '0 4px',
  },
};
