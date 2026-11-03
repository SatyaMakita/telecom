import React from 'react';

const colorMap = {
  running: 'bg-emerald-500',
  up: 'bg-emerald-500',
  active: 'bg-emerald-500',
  healthy: 'bg-emerald-500',
  stopped: 'bg-red-500',
  down: 'bg-red-500',
  error: 'bg-red-500',
  inactive: 'bg-red-500',
  unknown: 'bg-amber-500',
  warning: 'bg-amber-500',
  pending: 'bg-amber-500',
};

const labelMap = {
  running: 'Running',
  up: 'Up',
  active: 'Active',
  healthy: 'Healthy',
  stopped: 'Stopped',
  down: 'Down',
  error: 'Error',
  inactive: 'Inactive',
  unknown: 'Unknown',
  warning: 'Warning',
  pending: 'Pending',
};

export default function StatusBadge({ status }) {
  const key = (status || 'unknown').toLowerCase();
  const dotColor = colorMap[key] || 'bg-gray-500';
  const label = labelMap[key] || status || 'Unknown';

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700/50 text-slate-200">
      <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse-dot`} />
      {label}
    </span>
  );
}
