import React, { useState, useEffect } from 'react';
import api from '../api';
import { ClipboardList, Download, RefreshCw, Shield, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Audit() {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAudit = async () => {
    try {
      setLoading(true);
      const res = await api.get('/audit', { params: { skip: page * limit, limit } });
      setEvents(res.data.items || []);
      setTotal(res.data.count || 0);
      setError(null);
    } catch (err) {
      setError('Failed to fetch audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, [page]);

  const handleExport = async () => {
    try {
      const res = await api.get('/audit/export');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `telecom_lab_audit_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export audit log');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-400" />
            Lab Audit & Reproducibility Trail
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Immutable log of simulator actions, configuration edits, and positioning test executions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAudit}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4" />
            Export Audit JSON
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Audit Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/50 text-xs uppercase text-slate-400 border-b border-slate-700">
              <tr>
                <th className="px-5 py-3">Timestamp (UTC)</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Target Resource</th>
                <th className="px-5 py-3">Parameters & Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500">
                    Loading audit trail...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-700/30 transition">
                    <td className="px-5 py-3 font-mono text-slate-400">
                      {new Date(e.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-semibold text-slate-200">{e.actor}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="bg-slate-900 px-2 py-0.5 rounded text-blue-400 font-mono font-medium border border-slate-700">
                        {e.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-300">{e.resource}</td>
                    <td className="px-5 py-3 font-mono text-slate-400 max-w-xs truncate">
                      {e.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900/50 border-t border-slate-700 text-xs text-slate-400">
          <div>
            Showing {events.length > 0 ? page * limit + 1 : 0} to{' '}
            {Math.min((page + 1) * limit, total)} of {total} events
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              disabled={page === 0}
              className="p-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Page {page + 1} of {Math.max(totalPages, 1)}
            </span>
            <button
              onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
              disabled={page + 1 >= totalPages}
              className="p-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
