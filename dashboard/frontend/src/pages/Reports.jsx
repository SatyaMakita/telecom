import React, { useState, useEffect } from 'react';
import api from '../api';
import { FileDown, Download, BarChart2, ShieldAlert, CheckCircle2, BookOpen } from 'lucide-react';

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [selectedExp, setSelectedExp] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const [sumRes, expRes] = await Promise.all([
        api.get('/reports/summary'),
        api.get('/positioning/experiments'),
      ]);
      setSummary(sumRes.data);
      setExperiments(expRes.data.items || []);
      if (expRes.data.items?.length > 0) {
        setSelectedExp(expRes.data.items[0].id);
        fetchReport(expRes.data.items[0].id);
      }
      setError(null);
    } catch (err) {
      setError('Failed to fetch summary data');
    } finally {
      setLoading(false);
    }
  };

  const fetchReport = async (expId) => {
    if (!expId) return;
    try {
      const res = await api.get(`/reports/export/${expId}`);
      setReportData(res.data);
    } catch (err) {
      setError('Failed to load report export');
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleSelectExp = (id) => {
    setSelectedExp(id);
    fetchReport(id);
  };

  const handleDownload = () => {
    if (!reportData) return;
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telecom_experiment_${reportData.experiment_id}_report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileDown className="w-6 h-6 text-blue-400" />
            Report Export & Lab Synthesis
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Compile structured laboratory findings, simulation parameters, and mathematical error metrics.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Lab Summary Statistics */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-400 block mb-1">Subscribers</span>
            <span className="text-2xl font-bold font-mono text-white">{summary.subscribers}</span>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-400 block mb-1">Cell Sites</span>
            <span className="text-2xl font-bold font-mono text-white">{summary.cells}</span>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-400 block mb-1">Positioning Runs</span>
            <span className="text-2xl font-bold font-mono text-white">{summary.experiments}</span>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-400 block mb-1">Mobility Events</span>
            <span className="text-2xl font-bold font-mono text-white">{summary.mobility_events}</span>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-400 block mb-1">Audit Records</span>
            <span className="text-2xl font-bold font-mono text-white">{summary.audit_events}</span>
          </div>
        </div>
      )}

      {/* Export Section */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-300">Choose Experiment:</label>
            <select
              value={selectedExp}
              onChange={(e) => handleSelectExp(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none"
            >
              {experiments.map((exp) => (
                <option key={exp.id} value={exp.id}>
                  #{exp.id} — {exp.name} ({exp.method}, {exp.num_trials} trials)
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleDownload}
            disabled={!reportData}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4" />
            Download JSON Report
          </button>
        </div>

        {reportData && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-5 space-y-4 font-mono text-xs text-slate-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-blue-400 font-bold">{reportData.report_type}</span>
                <span className="text-slate-500">{reportData.created_at}</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
                <div>
                  <span className="text-slate-500 block">Method:</span>
                  <span className="font-semibold text-white">{reportData.method}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Trials:</span>
                  <span className="font-semibold text-white">{reportData.num_trials}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Noise Sigma:</span>
                  <span className="font-semibold text-white">{reportData.noise_sigma_meters} m</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Mean Error:</span>
                  <span className="font-semibold text-emerald-400">
                    {reportData.metrics?.mean_error_meters} m
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block font-sans mb-1">Key Metrics:</span>
                <div className="bg-slate-950 p-3 rounded-lg text-[11px] grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>CEP50: {reportData.metrics?.cep50_meters} m</div>
                  <div>CEP95: {reportData.metrics?.cep95_meters} m</div>
                  <div>Min Error: {reportData.metrics?.min_error_meters} m</div>
                  <div>Max Error: {reportData.metrics?.max_error_meters} m</div>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block font-sans mb-1">Model Assumptions:</span>
                <p className="font-sans text-slate-300 bg-slate-950/60 p-2.5 rounded border border-slate-800">
                  {reportData.assumptions}
                </p>
              </div>

              <div className="text-[10px] text-amber-400/80 pt-2 border-t border-slate-800">
                ⚠ {reportData.disclaimer}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
