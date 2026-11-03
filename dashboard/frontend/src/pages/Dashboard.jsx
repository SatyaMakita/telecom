import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import { Cpu, MemoryStick, HardDrive, Activity, RefreshCw, Server, Container } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      const [sysRes, srvRes] = await Promise.all([
        api.get('/health'),
        api.get('/health/services'),
      ]);
      setHealth({
        system: sysRes.data,
        services: srvRes.data.services.filter((s) => !s.name.startsWith('docker:')),
        containers: srvRes.data.services
          .filter((s) => s.name.startsWith('docker:'))
          .map((s) => ({
            name: s.name.replace('docker:', ''),
            status: s.running ? 'running' : 'stopped',
          })),
      });
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError('Failed to fetch system health. Backend may be offline.');
      // Provide synthetic fallback data for demo
      setHealth({
        system: { cpu_percent: 42.3, memory_percent: 61.8, disk_percent: 37.5 },
        services: [
          { name: 'amf', status: 'running' },
          { name: 'smf', status: 'running' },
          { name: 'upf', status: 'running' },
          { name: 'nrf', status: 'running' },
          { name: 'ausf', status: 'running' },
          { name: 'udm', status: 'stopped' },
          { name: 'pcf', status: 'running' },
          { name: 'nssf', status: 'unknown' },
        ],
        containers: [
          { name: 'open5gs-amf', status: 'running' },
          { name: 'open5gs-smf', status: 'running' },
          { name: 'open5gs-upf', status: 'running' },
          { name: 'mongodb', status: 'running' },
          { name: 'open5gs-webui', status: 'stopped' },
        ],
      });
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const sys = health?.system || {};
  const services = health?.services || [];
  const containers = health?.containers || [];

  const resourceData = [
    { name: 'CPU', value: sys.cpu_percent || 0, color: '#3b82f6' },
    { name: 'Memory', value: sys.memory_percent || 0, color: '#8b5cf6' },
    { name: 'Disk', value: sys.disk_percent || 0, color: '#22c55e' },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lab Health Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            System metrics and service status — auto-refreshes every 10s
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-slate-500">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-400">
          ⚠ {error} — Showing synthetic fallback data.
        </div>
      )}

      {/* System metrics cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          icon={Cpu}
          label="CPU Usage"
          value={sys.cpu_percent?.toFixed(1)}
          unit="%"
          color={sys.cpu_percent > 80 ? 'red' : sys.cpu_percent > 60 ? 'amber' : 'blue'}
        />
        <MetricCard
          icon={MemoryStick}
          label="Memory Usage"
          value={sys.memory_percent?.toFixed(1)}
          unit="%"
          color={sys.memory_percent > 80 ? 'red' : sys.memory_percent > 60 ? 'amber' : 'purple'}
        />
        <MetricCard
          icon={HardDrive}
          label="Disk Usage"
          value={sys.disk_percent?.toFixed(1)}
          unit="%"
          color={sys.disk_percent > 80 ? 'red' : sys.disk_percent > 60 ? 'amber' : 'emerald'}
        />
      </div>

      {/* Resource usage chart */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Resource Utilization
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={resourceData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} unit="%" />
            <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} width={60} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '0.5rem', color: '#e2e8f0' }}
              formatter={(value) => [`${value.toFixed(1)}%`, 'Usage']}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
              {resourceData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Services and Containers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open5GS Services */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
            <Server className="w-4 h-4" />
            Open5GS Network Functions
          </h3>
          {services.length === 0 ? (
            <p className="text-sm text-slate-500">No services reported</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {services.map((svc) => (
                <div
                  key={svc.name}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-700/50 border border-slate-600/50"
                >
                  <span className="text-sm font-mono text-slate-300 uppercase">{svc.name}</span>
                  <StatusBadge status={svc.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Docker Containers */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
            <Container className="w-4 h-4" />
            Docker Containers
          </h3>
          {containers.length === 0 ? (
            <p className="text-sm text-slate-500">No containers reported</p>
          ) : (
            <div className="space-y-2">
              {containers.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-700/50 border border-slate-600/50"
                >
                  <span className="text-sm font-mono text-slate-300">{c.name}</span>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
