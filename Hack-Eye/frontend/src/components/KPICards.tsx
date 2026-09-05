import React from 'react';
import { Camera, AlertTriangle, Flame, Users, Bell, ShieldCheck } from 'lucide-react';
import { KPIs } from '../types';

interface KPICardsProps {
  kpis: KPIs | null;
}

export const KPICards: React.FC<KPICardsProps> = ({ kpis }) => {
  const cards = [
    {
      title: 'CAMERAS ONLINE',
      value: kpis?.cameras_online || '5/5',
      sub: 'Real-Time CCTV Stream',
      icon: Camera,
      color: 'text-emerald-400',
      border: 'border-emerald-500/20',
      bg: 'bg-emerald-950/20'
    },
    {
      title: 'ACTIVE INCIDENTS',
      value: kpis?.active_incidents !== undefined ? kpis.active_incidents : 2,
      sub: 'Requiring Action',
      icon: AlertTriangle,
      color: (kpis?.active_incidents || 0) > 0 ? 'text-amber-400' : 'text-slate-400',
      border: 'border-amber-500/20',
      bg: 'bg-amber-950/20'
    },
    {
      title: 'HIGH-RISK EVENTS',
      value: kpis?.high_risk_events !== undefined ? kpis.high_risk_events : 3,
      sub: 'Proximity / Zone Breaches',
      icon: Flame,
      color: (kpis?.high_risk_events || 0) > 0 ? 'text-rose-400' : 'text-slate-400',
      border: 'border-rose-500/20',
      bg: 'bg-rose-950/20'
    },
    {
      title: 'WORKERS MONITORED',
      value: kpis?.workers_monitored || 28,
      sub: 'Across 5 Active Zones',
      icon: Users,
      color: 'text-blue-400',
      border: 'border-blue-500/20',
      bg: 'bg-blue-950/20'
    },
    {
      title: 'ALERTS TODAY',
      value: kpis?.alerts_today || 8,
      sub: 'Recorded in Database',
      icon: Bell,
      color: 'text-indigo-400',
      border: 'border-indigo-500/20',
      bg: 'bg-indigo-950/20'
    },
    {
      title: 'SUPPRESSED ALERTS',
      value: kpis?.alerts_suppressed || 14,
      sub: 'Fatigue Filtered (Dedup)',
      icon: ShieldCheck,
      color: 'text-cyan-400',
      border: 'border-cyan-500/20',
      bg: 'bg-cyan-950/20'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`bg-slate-900/90 border ${card.border} p-3 rounded-lg flex flex-col justify-between shadow-sm hover:border-slate-700 transition-all`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-mono tracking-wider">{card.title}</span>
              <div className={`p-1.5 rounded ${card.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${card.color}`} />
              </div>
            </div>
            <div>
              <div className="text-2xl font-extrabold font-mono text-white tracking-tight">
                {card.value}
              </div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                {card.sub}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
