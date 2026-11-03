import React from 'react';

export default function MetricCard({ icon: Icon, label, value, unit, color = 'blue', subtitle }) {
  const colorClasses = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  };

  const classes = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`rounded-xl border p-5 ${classes}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-400">{label}</span>
        {Icon && <Icon className="w-5 h-5 opacity-70" />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold">{value ?? '—'}</span>
        {unit && <span className="text-sm text-slate-400">{unit}</span>}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      )}
    </div>
  );
}
