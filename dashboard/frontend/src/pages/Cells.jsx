import React, { useState, useEffect } from 'react';
import api from '../api';
import MapView from '../components/MapView';
import { Radio, Plus, Upload, Trash2, MapPin, Info } from 'lucide-react';

export default function Cells() {
  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    site_id: 'LAB_SITE_E',
    technology: 'NR',
    latitude: 19.0720,
    longitude: 72.8850,
    description: 'Fictional lab micro site E',
    tac: '0001',
  });

  const fetchCells = async () => {
    try {
      setLoading(true);
      const res = await api.get('/cells');
      setCells(res.data.items || []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch cell sites');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCells();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/cells', form);
      setShowModal(false);
      fetchCells();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create cell site');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this cell site from catalogue?')) return;
    try {
      await api.delete(`/cells/${id}`);
      fetchCells();
    } catch (err) {
      setError('Failed to delete cell');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/cells/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchCells();
    } catch (err) {
      setError('Failed to upload CSV: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Convert cells into map markers
  const mapMarkers = cells.map((c) => ({
    id: c.site_id,
    lat: c.latitude,
    lng: c.longitude,
    tech: c.technology,
    label: c.site_id,
    description: `${c.technology} | TAC ${c.tac} — ${c.description || 'Lab Node'}`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Radio className="w-6 h-6 text-blue-400" />
            Cell-Site Catalogue
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Fictional base stations (gNB, eNodeB, BTS) providing simulated radio coverage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer transition">
            <Upload className="w-4 h-4 text-slate-400" />
            Import CSV
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            Add Cell Site
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Interactive Map */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg p-3">
        <div className="flex items-center justify-between px-2 pb-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-blue-400" /> Topology Coverage Map
          </span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> 5G NR
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 4G LTE
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> 2G GSM
            </span>
          </div>
        </div>
        <MapView
          center={cells.length > 0 ? [cells[0].latitude, cells[0].longitude] : [19.076, 72.877]}
          zoom={13}
          markers={mapMarkers}
          height="360px"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/50 text-xs uppercase text-slate-400 border-b border-slate-700">
              <tr>
                <th className="px-5 py-3">Site ID</th>
                <th className="px-5 py-3">Technology</th>
                <th className="px-5 py-3">Latitude</th>
                <th className="px-5 py-3">Longitude</th>
                <th className="px-5 py-3">TAC</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">
                    Loading cell sites...
                  </td>
                </tr>
              ) : cells.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">
                    No cell sites configured.
                  </td>
                </tr>
              ) : (
                cells.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-700/30 transition">
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-white">
                      {c.site_id}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          c.technology === 'NR'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : c.technology === 'LTE'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        }`}
                      >
                        {c.technology}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-300">{c.latitude.toFixed(6)}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-300">{c.longitude.toFixed(6)}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{c.tac}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-400 max-w-xs truncate">{c.description}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Radio className="w-5 h-5 text-blue-400" />
              Add Synthetic Cell Site
            </h3>
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-300 mb-1 font-medium text-xs">Site Identifier</label>
                <input
                  type="text"
                  required
                  value={form.site_id}
                  onChange={(e) => setForm({ ...form, site_id: e.target.value })}
                  placeholder="LAB_SITE_A"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium text-xs">Radio Access Technology</label>
                <select
                  value={form.technology}
                  onChange={(e) => setForm({ ...form, technology: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="NR">5G NR (New Radio)</option>
                  <option value="LTE">4G LTE (E-UTRA)</option>
                  <option value="GSM">2G GSM</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium text-xs">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium text-xs">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium text-xs">Tracking Area Code (TAC)</label>
                <input
                  type="text"
                  required
                  value={form.tac}
                  onChange={(e) => setForm({ ...form, tac: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium text-xs">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
                >
                  Save Cell Site
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
