import React, { useState, useEffect } from 'react';
import api from '../api';
import MapView from '../components/MapView';
import { ScatterPlot, CDFChart } from '../components/ExperimentChart';
import { MapPin, Play, RefreshCw, BarChart3, AlertCircle, Compass } from 'lucide-react';

export default function Positioning() {
  const [experiments, setExperiments] = useState([]);
  const [activeExp, setActiveExp] = useState(null);
  const [cells, setCells] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name: 'Synthetic TDOA Run',
    method: 'TDOA',
    noise_sigma: 15.0,
    num_trials: 50,
    assumptions: 'Flat-earth approximation, Gaussian noise, LOS propagation',
  });

  const fetchInitial = async () => {
    try {
      const [expRes, cellRes] = await Promise.all([
        api.get('/positioning/experiments'),
        api.get('/cells'),
      ]);
      setExperiments(expRes.data.items || []);
      setCells(cellRes.data.items || []);

      if (expRes.data.items?.length > 0) {
        loadExperiment(expRes.data.items[0].id);
      }
    } catch (err) {
      setError('Failed to load initial positioning data');
    }
  };

  useEffect(() => {
    fetchInitial();
  }, []);

  const loadExperiment = async (id) => {
    try {
      const res = await api.get(`/positioning/experiments/${id}`);
      setActiveExp(res.data);
    } catch (err) {
      setError('Failed to load experiment details');
    }
  };

  const handleRun = async (e) => {
    e.preventDefault();
    try {
      setRunning(true);
      setError(null);
      const res = await api.post('/positioning/experiment', form);
      setActiveExp(res.data);
      // Refresh experiment list
      const expRes = await api.get('/positioning/experiments');
      setExperiments(expRes.data.items || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Experiment run failed');
    } finally {
      setRunning(false);
    }
  };

  // Prepare map markers
  const baseMarkers = cells.map((c) => ({
    id: c.site_id,
    lat: c.latitude,
    lng: c.longitude,
    tech: c.technology,
    label: c.site_id,
    description: `${c.technology} Cell Site`,
  }));

  const extraMarkers = [];
  let uncertaintyCircle = null;

  if (activeExp && activeExp.results?.length > 0) {
    const first = activeExp.results[0];
    extraMarkers.push({
      id: 'true_pos',
      lat: first.true_lat,
      lng: first.true_lon,
      label: 'True Device',
      description: `True Simulated Coordinate: (${first.true_lat.toFixed(5)}, ${first.true_lon.toFixed(5)})`,
      special: true,
      color: '#10b981', // green
      size: 16,
    });

    // Add estimated position (mean estimate)
    const avgEstLat =
      activeExp.results.reduce((acc, r) => acc + r.est_lat, 0) / activeExp.results.length;
    const avgEstLon =
      activeExp.results.reduce((acc, r) => acc + r.est_lon, 0) / activeExp.results.length;

    extraMarkers.push({
      id: 'est_pos',
      lat: avgEstLat,
      lng: avgEstLon,
      label: 'Estimated Position',
      description: `Mean Estimate: (${avgEstLat.toFixed(5)}, ${avgEstLon.toFixed(5)})`,
      special: true,
      color: '#ef4444', // red
      size: 14,
    });

    if (activeExp.cep50) {
      uncertaintyCircle = {
        center: [avgEstLat, avgEstLon],
        radius: activeExp.cep50,
        color: '#ef4444',
      };
    }
  }

  // Prepare chart data
  const scatterData = (activeExp?.results || []).map((r) => ({
    x: (r.est_lon - (activeExp.results[0]?.true_lon || 72.88)) * 100000,
    y: (r.est_lat - (activeExp.results[0]?.true_lat || 19.08)) * 100000,
  }));

  // Prepare CDF data
  const sortedErrors = (activeExp?.results || []).map((r) => r.error_meters).sort((a, b) => a - b);
  const cdfData = sortedErrors.map((err, idx) => ({
    error: Math.round(err),
    cdf: parseFloat(((idx + 1) / sortedErrors.length).toFixed(3)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Compass className="w-6 h-6 text-blue-400" />
            Positioning Engineering Playground
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Synthetic TDOA/OTDOA multilateration solver with Monte Carlo noise modeling.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Grid: Config Form & Past Runs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Run Controls */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg lg:col-span-2">
          <h3 className="text-sm font-bold text-white mb-3">Experiment Parameters</h3>
          <form onSubmit={handleRun} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Experiment Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Positioning Method</label>
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="TDOA">5G NR DL-TDOA (Hyperbolic)</option>
                <option value="OTDOA">4G LTE OTDOA</option>
                <option value="E-CID">E-CID (Cell ID + TA)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Noise σ (meters / error)</label>
              <input
                type="number"
                step="1"
                min="0"
                required
                value={form.noise_sigma}
                onChange={(e) => setForm({ ...form, noise_sigma: parseFloat(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Monte Carlo Trials</label>
              <input
                type="number"
                step="5"
                min="5"
                max="500"
                required
                value={form.num_trials}
                onChange={(e) => setForm({ ...form, num_trials: parseInt(e.target.value, 10) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="md:col-span-2 flex items-end">
              <button
                type="submit"
                disabled={running}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-xs flex items-center justify-center gap-2 transition"
              >
                <Play className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
                {running ? 'Solving Non-linear Equations...' : 'Run Simulation'}
              </button>
            </div>
          </form>
        </div>

        {/* Recent Experiments */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-bold text-white mb-2">History</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {experiments.map((exp) => (
              <button
                key={exp.id}
                onClick={() => loadExperiment(exp.id)}
                className={`w-full text-left p-2.5 rounded-lg border text-xs transition ${
                  activeExp?.experiment?.id === exp.id
                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                    : 'bg-slate-900/50 border-slate-700/50 text-slate-300 hover:bg-slate-700/40'
                }`}
              >
                <div className="font-semibold">{exp.name}</div>
                <div className="text-[10px] text-slate-400">
                  {exp.method} · {exp.num_trials} trials · σ={exp.noise_sigma}m
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      {activeExp && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-400 block mb-1">Mean Euclidean Error</span>
            <span className="text-2xl font-bold font-mono text-white">
              {activeExp.mean_error ?? '—'} <span className="text-sm font-normal text-slate-400">m</span>
            </span>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-400 block mb-1">Median Error</span>
            <span className="text-2xl font-bold font-mono text-white">
              {activeExp.median_error ?? '—'} <span className="text-sm font-normal text-slate-400">m</span>
            </span>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-400 block mb-1">CEP50 (50% radius)</span>
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {activeExp.cep50 ?? '—'} <span className="text-sm font-normal text-slate-400">m</span>
            </span>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-400 block mb-1">CEP95 (95% radius)</span>
            <span className="text-2xl font-bold font-mono text-amber-400">
              {activeExp.cep95 ?? '—'} <span className="text-sm font-normal text-slate-400">m</span>
            </span>
          </div>
        </div>
      )}

      {/* Map & Visualisation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg">
          <h3 className="text-xs font-semibold text-slate-300 pb-2">
            Multilateration Map (True vs Estimated & Uncertainty)
          </h3>
          <MapView
            center={cells.length > 0 ? [cells[0].latitude, cells[0].longitude] : [19.076, 72.877]}
            zoom={13}
            markers={[...baseMarkers, ...extraMarkers]}
            circle={uncertaintyCircle}
            height="340px"
          />
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg">
          <h3 className="text-xs font-semibold text-slate-300 pb-2">
            Cumulative Distribution of Position Error (CDF)
          </h3>
          <CDFChart data={cdfData} title="" />
        </div>
      </div>
    </div>
  );
}
