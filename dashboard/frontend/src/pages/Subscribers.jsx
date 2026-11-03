import React, { useState, useEffect } from 'react';
import api from '../api';
import { Users, Plus, Trash2, Eye, EyeOff, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function Subscribers() {
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showKeys, setShowKeys] = useState({});
  const [form, setForm] = useState({
    supi: 'imsi-999700000000002',
    profile_name: 'Synthetic Test Profile 2',
    ki: '5122250214C33E723A5DD523FC145FC0',
    opc: '981D464C7C52EB6E5036234984AD0BCE',
    amf_value: '8000',
  });
  const [error, setError] = useState(null);

  const fetchSubscribers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/subscribers');
      setSubscribers(res.data.items || []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch subscribers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/subscribers', form);
      setShowModal(false);
      fetchSubscribers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create synthetic subscriber');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this synthetic subscriber profile?')) return;
    try {
      await api.delete(`/subscribers/${id}`);
      fetchSubscribers();
    } catch (err) {
      setError('Failed to delete subscriber');
    }
  };

  const toggleKey = (id) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Safety Warning Banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/90 leading-relaxed">
          <p className="font-semibold text-amber-300 mb-0.5">Synthetic Test Credentials Only</p>
          All identities (SUPIs, Ki, OPc) shown here are strictly fabricated for local Open5GS / UERANSIM
          simulations. Never store, transmit, or configure real SIM keys or production carrier identifiers.
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" />
            Synthetic Subscriber Registry
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage simulated 5G Standalone UEs and matching credential parameters.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          Add Subscriber
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/50 text-xs uppercase text-slate-400 border-b border-slate-700">
              <tr>
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">SUPI (IMSI)</th>
                <th className="px-5 py-3">Profile Name</th>
                <th className="px-5 py-3">Key (Ki)</th>
                <th className="px-5 py-3">OPc</th>
                <th className="px-5 py-3">AMF</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">
                    Loading synthetic subscribers...
                  </td>
                </tr>
              ) : subscribers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">
                    No subscribers found. Click "Add Subscriber" to create one.
                  </td>
                </tr>
              ) : (
                subscribers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-700/30 transition">
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{s.id}</td>
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-blue-400">
                      {s.supi}
                    </td>
                    <td className="px-5 py-3.5 text-slate-200 font-medium">{s.profile_name}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                      {showKeys[s.id] ? s.ki : `${s.ki.slice(0, 6)}••••••••${s.ki.slice(-4)}`}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                      {showKeys[s.id] ? s.opc : `${s.opc.slice(0, 6)}••••••••${s.opc.slice(-4)}`}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{s.amf_value}</td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => toggleKey(s.id)}
                        className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-700 transition"
                        title={showKeys[s.id] ? 'Mask keys' : 'Reveal keys'}
                      >
                        {showKeys[s.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Provision Synthetic Subscriber
            </h3>
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-300 mb-1 font-medium text-xs">SUPI (imsi-format)</label>
                <input
                  type="text"
                  required
                  value={form.supi}
                  onChange={(e) => setForm({ ...form, supi: e.target.value })}
                  placeholder="imsi-999700000000001"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium text-xs">Profile Name</label>
                <input
                  type="text"
                  required
                  value={form.profile_name}
                  onChange={(e) => setForm({ ...form, profile_name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium text-xs">Synthetic Key (Ki - 32 hex)</label>
                <input
                  type="text"
                  required
                  value={form.ki}
                  onChange={(e) => setForm({ ...form, ki: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium text-xs">Synthetic OPc (32 hex)</label>
                <input
                  type="text"
                  required
                  value={form.opc}
                  onChange={(e) => setForm({ ...form, opc: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium text-xs">AMF Value</label>
                <input
                  type="text"
                  required
                  value={form.amf_value}
                  onChange={(e) => setForm({ ...form, amf_value: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
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
                  Save Subscriber
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
