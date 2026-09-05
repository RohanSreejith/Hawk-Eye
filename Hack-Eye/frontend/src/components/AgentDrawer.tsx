import React from 'react';
import { Cpu, Terminal, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { AgentLog } from '../types';

interface AgentDrawerProps {
  logs: AgentLog[];
  isOpen: boolean;
  onToggle: () => void;
}

export const AgentDrawer: React.FC<AgentDrawerProps> = ({ logs, isOpen, onToggle }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-md mb-4">
      {/* Header Bar */}
      <button
        onClick={onToggle}
        className="w-full bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800 text-left hover:bg-slate-900 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-blue-950 border border-blue-500/30 text-blue-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wider">
                AI RESPONSE PIPELINE & AGENT TRANSPARENCY
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-400">
                5 AGENTS ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Perception ➔ Safety ➔ Risk ➔ Analyst ➔ Response Orchestrator
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>{isOpen ? 'Collapse Log' : 'Expand Live Decisions'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="p-4 bg-slate-950/90 font-mono text-xs max-h-72 overflow-y-auto space-y-2">
          {logs.length === 0 ? (
            <div className="text-slate-500 py-3 text-center">
              Awaiting real-time CV events or demo triggers...
            </div>
          ) : (
            logs.map((log, index) => {
              const colorClass = 
                log.severity === 'critical' ? 'text-rose-400 border-rose-500/40 bg-rose-950/20' :
                log.severity === 'high' ? 'text-orange-400 border-orange-500/40 bg-orange-950/20' :
                log.severity === 'warning' ? 'text-amber-400 border-amber-500/40 bg-amber-950/20' :
                'text-blue-300 border-blue-500/30 bg-blue-950/20';

              return (
                <div
                  key={index}
                  className={`p-2 rounded border flex flex-col md:flex-row items-start md:items-center justify-between gap-2 ${colorClass}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-400 text-[10px]">{log.timestamp}</span>
                    <span className="font-bold text-white px-1.5 py-0.5 bg-slate-900 rounded text-[11px]">
                      {log.agent_name}
                    </span>
                    <span className="font-semibold text-slate-200">
                      {log.action}:
                    </span>
                    <span className="text-slate-300 font-normal">
                      {log.detail}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">
                    {log.severity}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
