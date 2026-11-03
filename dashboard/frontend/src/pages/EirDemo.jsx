import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  ShieldAlert, ShieldCheck, AlertTriangle, ArrowRight, Play, RefreshCw,
  Terminal, Lock, Ban, Eye, CheckCircle2, XCircle, FileText, Smartphone
} from 'lucide-react';

export default function EirDemo() {
  const [devices, setDevices] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [selectedImei, setSelectedImei] = useState('356938035643803');
  const [selectedSupi, setSelectedSupi] = useState('imsi-999700000000001');
  const [cellId, setCellId] = useState('LAB_SITE_A');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState(null);

  const fetchDevices = async () => {
    try {
      const [devRes, subRes] = await Promise.all([
        api.get('/eir/devices'),
        api.get('/subscribers'),
      ]);
      setDevices(devRes.data || []);
      setSubscribers(subRes.data.items || []);
    } catch (err) {
      setError('Failed to load simulated EIR data');
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleUpdateStatus = async (imei, newStatus) => {
    try {
      await api.post('/eir/update-status', {
        imei,
        status: newStatus,
        fir_reference: newStatus === 'BLACKLISTED' ? 'MUM/THEFT/2026/0491' : null,
      });
      await fetchDevices();
    } catch (err) {
      setError('Failed to update equipment status');
    }
  };

  const handleRunAttachTest = async () => {
    try {
      setTesting(true);
      setError(null);
      const res = await api.post('/eir/check-identity', {
        imei: selectedImei,
        supi: selectedSupi,
        cell_id: cellId,
      });
      setTestResult(res.data);
      setActiveStep(res.data.signalling_flow?.length - 1 || 0);
    } catch (err) {
      setError(err.response?.data?.detail || 'Identity check procedure failed');
    } finally {
      setTesting(false);
    }
  };

  const currentDevice = devices.find((d) => d.imei === selectedImei);

  return (
    <div className="space-y-6">
      {/* Header & Architectural Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Lock className="w-6 h-6 text-blue-400" />
            3GPP 5G Equipment Identity (EIR / CEIR) Demonstration
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            How cellular networks authenticate device hardware (IMEI), enforce theft blacklists, and reject stolen terminals.
          </p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 px-3.5 py-1.5 rounded-lg flex items-center gap-2 text-xs text-blue-300">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>3GPP TS 23.501 & TS 29.511 (N5g-eir Interface)</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm p-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Grid: Test Bench & Device Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Bench Controls */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-400" />
            Network Registration Test Bench
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Select a terminal hardware profile (IMEI) and test network attach behavior against the core EIR.
          </p>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Target Terminal (IMEI)</label>
              <select
                value={selectedImei}
                onChange={(e) => setSelectedImei(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
              >
                {devices.map((d) => (
                  <option key={d.imei} value={d.imei}>
                    {d.imei} — {d.model} ({d.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Inserted SIM (SUPI / IMSI)</label>
              <select
                value={selectedSupi}
                onChange={(e) => setSelectedSupi(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
              >
                {subscribers.map((s) => (
                  <option key={s.id} value={s.supi}>
                    {s.supi} ({s.profile_name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Target Base Station Mast</label>
              <select
                value={cellId}
                onChange={(e) => setCellId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
              >
                <option value="LAB_SITE_A">LAB_SITE_A (5G NR Sector)</option>
                <option value="LAB_SITE_B">LAB_SITE_B (5G NR Sector)</option>
                <option value="LAB_SITE_C">LAB_SITE_C (4G LTE Sector)</option>
                <option value="LAB_SITE_D">LAB_SITE_D (2G GSM Sector)</option>
              </select>
            </div>

            <button
              onClick={handleRunAttachTest}
              disabled={testing}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition shadow-lg"
            >
              <Play className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Performing N5g-eir Identity Check...' : 'Trigger 5G Network Registration'}
            </button>
          </div>

          {/* Quick status indicator */}
          {currentDevice && (
            <div className="pt-3 border-t border-slate-700/80 text-xs space-y-1.5">
              <span className="text-slate-400 block font-semibold text-[11px]">Selected Terminal Status:</span>
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    currentDevice.status === 'WHITELISTED'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : currentDevice.status === 'GREYLISTED'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {currentDevice.status}
                </span>
                <span className="text-slate-400 font-mono text-[10px]">
                  {currentDevice.fir_reference || 'Clean Terminal'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800">
                {currentDevice.notes}
              </p>
            </div>
          )}
        </div>

        {/* Central Equipment Identity Register Table */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Simulated CEIR Equipment Database
            </h3>
            <span className="text-xs text-slate-400">Synchronized with National Police Registry</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/50 uppercase text-[10px] text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="px-4 py-2.5">IMEI</th>
                  <th className="px-4 py-2.5">Model</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">FIR / Case Ref</th>
                  <th className="px-4 py-2.5 text-right">CEIR Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {devices.map((d) => (
                  <tr key={d.imei} className="hover:bg-slate-700/30 transition">
                    <td className="px-4 py-3 font-mono font-semibold text-white">{d.imei}</td>
                    <td className="px-4 py-3 text-slate-300">{d.model}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                          d.status === 'WHITELISTED'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : d.status === 'GREYLISTED'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                      {d.fir_reference || '—'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1.5">
                      {d.status !== 'BLACKLISTED' ? (
                        <button
                          onClick={() => handleUpdateStatus(d.imei, 'BLACKLISTED')}
                          className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 px-2 py-1 rounded text-[10px] font-semibold transition"
                          title="Report Stolen to CEIR"
                        >
                          Mark Stolen
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(d.imei, 'WHITELISTED')}
                          className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-2 py-1 rounded text-[10px] font-semibold transition"
                          title="Whitelist Equipment"
                        >
                          Restore Clean
                        </button>
                      )}
                      {d.status !== 'GREYLISTED' && (
                        <button
                          onClick={() => handleUpdateStatus(d.imei, 'GREYLISTED')}
                          className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 px-2 py-1 rounded text-[10px] font-semibold transition"
                          title="Place under Grey List tracing"
                        >
                          Greylist
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Educational notice */}
          <div className="bg-slate-900/60 border border-slate-700/80 rounded-lg p-3 text-xs text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-200">Network Engineering Rule: </span>
            A phone number (SIM card) is easily thrown away, but a phone's **IMEI** is hardwired into the baseband modem.
            When police or users report a stolen phone to **CEIR (Central Equipment Identity Register)**, the blacklist propagates
            across all operators. The moment a stolen handset connects with <em>any</em> new SIM card, the core AMF queries the EIR
            and executes a registration reject.
          </div>
        </div>
      </div>

      {/* Test Outcome & Protocol Packet Flow */}
      {testResult && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              Live 3GPP Network Attachment & EIR Evaluation Outcome
            </h3>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                testResult.decision === 'BAR_EQUIPMENT'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : testResult.decision === 'TRACE_AND_PERMIT'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              {testResult.decision === 'BAR_EQUIPMENT'
                ? 'CONNECTION BLOCKED: STOLEN ME'
                : testResult.decision === 'TRACE_AND_PERMIT'
                ? 'SURVEILLANCE TRACE ACTIVE'
                : 'REGISTRATION ACCEPTED'}
            </span>
          </div>

          {/* Result Alert Banner */}
          <div
            className={`p-4 rounded-xl border text-xs leading-relaxed flex items-start gap-3 ${
              testResult.decision === 'BAR_EQUIPMENT'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                : testResult.decision === 'TRACE_AND_PERMIT'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
            }`}
          >
            {testResult.decision === 'BAR_EQUIPMENT' ? (
              <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : testResult.decision === 'TRACE_AND_PERMIT' ? (
              <Eye className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold text-sm mb-0.5">
                {testResult.nas_cause_message || '5G Registration Completed'}
              </p>
              <p>{testResult.details}</p>
              {testResult.alert_dispatched && (
                <p className="font-semibold mt-1">
                  🚨 Automated Police / Operator Security Dispatch: Event logged with timestamp, cell ID ({cellId}), and serving coordinates.
                </p>
              )}
            </div>
          </div>

          {/* 3GPP Signalling Sequence Ladder Diagram */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              3GPP Registration & N5g-eir Signalling Sequence (TS 23.502 §4.2.2.2)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-xs font-mono">
              {testResult.signalling_flow.map((step, idx) => (
                <button
                  key={step.step}
                  onClick={() => setActiveStep(idx)}
                  className={`p-3 rounded-lg border text-left transition ${
                    activeStep === idx
                      ? 'bg-blue-600/20 border-blue-500 text-blue-200 shadow-md ring-1 ring-blue-500'
                      : 'bg-slate-900/60 border-slate-700/60 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <div className="text-[10px] text-slate-500 mb-1">Step {step.step}</div>
                  <div className="font-bold truncate text-white mb-0.5">{step.message}</div>
                  <div className="text-[10px] text-slate-400 truncate">{step.interface}</div>
                </button>
              ))}
            </div>

            {/* Selected Step Payload Preview */}
            {testResult.signalling_flow[activeStep] && (
              <div className="mt-3 bg-slate-900 border border-slate-700/80 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-1">
                <div className="text-blue-400 font-bold">
                  Interface: {testResult.signalling_flow[activeStep].interface} ({testResult.signalling_flow[activeStep].protocol})
                </div>
                <div className="text-white font-semibold">
                  Message: {testResult.signalling_flow[activeStep].message}
                </div>
                <div className="text-emerald-400 pt-1 border-t border-slate-800">
                  Payload / Information Elements: {testResult.signalling_flow[activeStep].payload}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
