import React from 'react';
import IconChip from './IconChip';

export default function StatCard({ icon, color = 'secondary', label, value, sub, trend, style }) {
  return (
    <div
      className="bg-white rounded-2xl shadow-card p-6 animate-fade-up opacity-0-init"
      style={style}
    >
      <div className="flex items-start justify-between mb-5">
        <IconChip icon={icon} color={color} size="md" />
        {trend !== undefined && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-secondary-100 text-secondary-700' : 'bg-red-100 text-red-600'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-1">{label}</p>
      <p className="text-3xl font-bold text-primary-900 leading-none">{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-2">{sub}</p>}
    </div>
  );
}
