import React, { useState, useEffect } from 'react';
import api from '../api';
import MapView from '../components/MapView';
import { Move, Play, RefreshCw, Radio, ArrowRight, CheckCircle2, UserCheck, ShieldAlert } from 'lucide-react';

export default function Mobility() {
  const [events, setEvents] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [cells, setCells] = useState([]);
  const [selectedSub, setSelectedSub] = useState('');
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [evRes, subRes, cellRes] = await Promise.all([
        api.get('/mobility', { params: selectedSub ? { subscriber_id: selectedSub } : {} }),
        api.get('/subscribers'),
        api.get('/cells'),
      ]);
      setEvents(evRes.data.items || []);
      setSubscribers(subRes.data.items || []);
      setCells(cellRes.data.items || []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch mobility data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSub]);

  const handleSimulate = async () => {
    try {
      setSimulating(true);
      await api.post('/mobility/simulate', { count: 8 });
      await fetchData();
    } catch (err) {
      setError('Simulation failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSimulating(false);
    }
  };

  const getCellName = (cellId) => {
    const c = cells.find((item) => item.id === cellId);
    return c ? `${c.site_id} (${c.technology})` : `Cell #${cellId}`;
  };

  const getSubName = (subId) => {
    const s = subscribers.find((item) => item.id === subId);
    return s ? `${s.supi} (${s.profile_name})` : `Sub #${subId}`;
  };

  // Build movement polyline from events
  const movementPath = events
    .filter((e) => cells.some((c) => c.id === e.cell_id))
    .map((e) => {
      const c = cells.find((item) => item.id === e.cell_id);
      return [c.latitude, c.longitude];
    });

  const cellMarkers = cells.map((c) => ({
    id: c.site_id,
    lat: c.latitude,
    lng: c.longitude,
    tech: c.technology,
    label: c.site_id,
    description: `${c.technology} cell site`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Move className="w-6 h-6 text-blue-400" />
            Mobility Event Timeline
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Simulated UE cell associations, handovers, and tracking-area registrations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedSub}
            onChange={(e) => setSelectedSub(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none"
          >
            <option value="">All Synthetic Subscribers</option>
            {subscribers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.supi}
              </option>
            ))}
          </select>
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
          >
            <Play className={`w-4 h-4 ${simulating ? 'animate-spin' : ''}`} />
            {simulating ? 'Simulating...' : 'Simulate Events'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Movement Map */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg p-3">
        <h3 className="text-xs font-semibold text-slate-300 px-2 pb-2">
          Cell Traversal & Handover Paths
        </h3>
        <MapView
          center={cells.length > 0 ? [cells[0].latitude, cells[0].longitude] : [19.076, 72.877]}
          zoom={13}
          markers={cellMarkers}
          polyline={movementPath.length > 1 ? movementPath : null}
          height="320px"
        />
      </div>

      {/* Timeline List */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-bold text-white mb-4">Event Sequence</h3>
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-sm">Loading timeline...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No mobility events recorded. Click "Simulate Events" to generate synthetic handovers.
          </div>
        ) : (
          <div className="relative border-l border-slate-700 ml-4 space-y-6">
            {events.map((e) => (
              <div key={e.id} className="relative pl-6">
                {/* Marker icon on timeline */}
                <span
                  className={`absolute -left-3 top-1 w-6 h-6 rounded-full border-2 border-slate-800 flex items-center justify-center text-[10px] ${
                    e.event_type === 'attach'
                      ? 'bg-emerald-500 text-white'
                      : e.event_type === 'handover'
                      ? 'bg-blue-500 text-white'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {e.event_type === 'attach' ? 'A' : e.event_type === 'handover' ? 'H' : 'D'}
                </span>

                <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="font-mono text-slate-300 font-medium">
                      {new Date(e.timestamp).toLocaleTimeString()} ·{' '}
                      {new Date(e.timestamp).toLocaleDateString()}
                    </span>
                    <span
                      className={`uppercase text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        e.event_type === 'attach'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : e.event_type === 'handover'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {e.event_type}
                    </span>
                  </div>
                  <div className="text-slate-200 text-xs">
                    <span className="text-slate-400">Subscriber:</span>{' '}
                    <span className="font-mono text-blue-400">{getSubName(e.subscriber_id)}</span>
                    <span className="mx-2 text-slate-600">→</span>
                    <span className="text-slate-400">Serving Cell:</span>{' '}
                    <span className="font-semibold text-slate-100">{getCellName(e.cell_id)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
