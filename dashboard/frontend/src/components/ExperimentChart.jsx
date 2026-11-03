import React from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';

export function ScatterPlot({ data, title }) {
  return (
    <div>
      {title && <h4 className="text-sm font-medium text-slate-300 mb-2">{title}</h4>}
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="x"
            type="number"
            name="Easting (m)"
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            label={{ value: 'Easting (m)', position: 'bottom', fill: '#94a3b8', fontSize: 12 }}
          />
          <YAxis
            dataKey="y"
            type="number"
            name="Northing (m)"
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            label={{ value: 'Northing (m)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '0.5rem', color: '#e2e8f0' }}
            formatter={(value) => `${value.toFixed(2)} m`}
          />
          <Scatter name="Estimates" data={data} fill="#3b82f6" fillOpacity={0.6} r={3} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CDFChart({ data, title }) {
  return (
    <div>
      {title && <h4 className="text-sm font-medium text-slate-300 mb-2">{title}</h4>}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="error"
            type="number"
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            label={{ value: 'Position Error (m)', position: 'bottom', fill: '#94a3b8', fontSize: 12 }}
          />
          <YAxis
            dataKey="cdf"
            type="number"
            domain={[0, 1]}
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            label={{ value: 'CDF', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '0.5rem', color: '#e2e8f0' }}
            formatter={(value, name) => [name === 'cdf' ? `${(value * 100).toFixed(1)}%` : `${value.toFixed(2)} m`, name === 'cdf' ? 'Probability' : 'Error']}
          />
          <Legend wrapperStyle={{ color: '#94a3b8' }} />
          <Line
            type="monotone"
            dataKey="cdf"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            name="CDF"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ExperimentChart({ scatterData, cdfData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {scatterData && <ScatterPlot data={scatterData} title="Monte Carlo Scatter" />}
      {cdfData && <CDFChart data={cdfData} title="Error CDF" />}
    </div>
  );
}
