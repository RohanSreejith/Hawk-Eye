import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Send, User, Phone, Shield, Bell, Save } from 'lucide-react';
import { fetchSettings, updateSettings, sendTestAlert } from '../services/api';
import { SupervisorSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated?: (settings: SupervisorSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSettingsUpdated }) => {
  const [formData, setFormData] = useState<SupervisorSettings>({
    supervisor_name: 'Vikram Sharma',
    supervisor_role: 'Chief EHS Safety Steward',
    phone_number: '+91 98765 43210',
    delivery_channel: 'sms',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_from_number: '',
    alert_on_warning: true,
    alert_on_critical: true
  });

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSettings()
        .then(data => {
          if (data) {
            setFormData(prev => ({ ...prev, ...data }));
          }
        })
        .catch(err => console.error('Failed to load settings', err));
      setStatusMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof SupervisorSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      const updated = await updateSettings(formData);
      setStatusMsg({ type: 'success', text: 'Supervisor settings saved successfully!' });
      if (onSettingsUpdated) {
        onSettingsUpdated(updated);
      }
      setTimeout(() => {
        setStatusMsg(null);
      }, 3500);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Failed to save settings: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTestAlert = async () => {
    setTesting(true);
    setStatusMsg(null);
    try {
      const res = await sendTestAlert();
      const details = res.dispatch_details;
      const isReal = details?.dispatched_real_sms;
      const msg = isReal
        ? `Real SMS dispatched via Twilio to ${details.phone_number}!`
        : `Test alert dispatched to ${details.supervisor} (${details.phone_number})!`;
      setStatusMsg({ type: 'success', text: msg });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Failed sending test alert: ' + err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wide text-white">Supervisor & Alert Dispatch Settings</h2>
              <p className="text-xs text-slate-400 font-mono">Configure who receives real-time safety alerts & SMS notifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {statusMsg && (
            <div
              className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-mono font-medium ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/40 text-rose-300'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Supervisor Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-2">
              <User className="w-4 h-4" /> Primary Site Supervisor
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">Supervisor Full Name</label>
                <input
                  type="text"
                  value={formData.supervisor_name}
                  onChange={e => handleChange('supervisor_name', e.target.value)}
                  placeholder="e.g. Vikram Sharma"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm focus:border-amber-400 focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">EHS Role / Title</label>
                <input
                  type="text"
                  value={formData.supervisor_role}
                  onChange={e => handleChange('supervisor_role', e.target.value)}
                  placeholder="e.g. Chief EHS Safety Steward"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm focus:border-amber-400 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                Alert Phone Number (Receives Instant SMS)
              </label>
              <input
                type="text"
                value={formData.phone_number}
                onChange={e => handleChange('phone_number', e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm font-mono focus:border-amber-400 focus:outline-none transition-colors"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Include country code (e.g. +91 for India, +1 for USA) for cellular SMS alerts.
              </p>
            </div>
          </div>

          {/* Alert Toggles */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4" /> Trigger Thresholds
            </h3>

            <div className="flex flex-col gap-2.5">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={formData.alert_on_warning ?? true}
                  onChange={e => handleChange('alert_on_warning', e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 focus:ring-offset-0 bg-slate-900 border-slate-700"
                />
                <div>
                  <span className="text-sm font-medium text-white block">Alert on Safety Warnings</span>
                  <span className="text-xs text-slate-400">E.g. No Helmet detected, PPE violations, moderate hazard proximity</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={formData.alert_on_critical ?? true}
                  onChange={e => handleChange('alert_on_critical', e.target.checked)}
                  className="w-4 h-4 rounded text-rose-500 focus:ring-0 focus:ring-offset-0 bg-slate-900 border-slate-700"
                />
                <div>
                  <span className="text-sm font-medium text-white block">Alert on High & Critical Emergencies</span>
                  <span className="text-xs text-slate-400">E.g. Crane load perimeter breach, reversing vehicle collision hazard</span>
                </div>
              </label>
            </div>
          </div>

          {/* Twilio Integration (Optional) */}
          <details className="pt-2 border-t border-slate-800 text-xs group">
            <summary className="cursor-pointer font-mono text-slate-400 hover:text-slate-200 py-1 select-none flex items-center justify-between">
              <span>Cellular SMS Gateway (Twilio API Integration)</span>
              <span className="text-[10px] text-amber-400/80 uppercase font-bold group-open:hidden">+ Expand</span>
              <span className="text-[10px] text-amber-400/80 uppercase font-bold hidden group-open:inline">- Collapse</span>
            </summary>
            <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono">
              <p className="text-[11px] text-slate-400">
                Optional: Enter Twilio credentials to dispatch real cellular SMS to the supervisor's physical smartphone. If left empty, alerts are tracked and verified locally.
              </p>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Twilio Account SID</label>
                <input
                  type="text"
                  value={formData.twilio_account_sid || ''}
                  onChange={e => handleChange('twilio_account_sid', e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white text-xs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Twilio Auth Token</label>
                  <input
                    type="password"
                    value={formData.twilio_auth_token || ''}
                    onChange={e => handleChange('twilio_auth_token', e.target.value)}
                    placeholder="••••••••••••••••••••"
                    className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Twilio Phone Number</label>
                  <input
                    type="text"
                    value={formData.twilio_from_number || ''}
                    onChange={e => handleChange('twilio_from_number', e.target.value)}
                    placeholder="+1234567890"
                    className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white text-xs"
                  />
                </div>
              </div>
            </div>
          </details>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleTestAlert}
              disabled={testing}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-mono font-bold flex items-center justify-center gap-2 border border-slate-700 transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{testing ? 'DISPATCHING TEST SMS...' : 'SEND TEST ALERT TO PHONE'}</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'SAVING...' : 'SAVE SETTINGS'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
