import React from 'react';
import IconChip from './IconChip';

export default function StatCard({ icon, color = 'secondary', label, value, sub, trend, style }) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-2xs min-w-0 p-5 animate-fade-up opacity-0-init"
      style={style}
    >
      <div className="flex items-start justify-between mb-4">
        {icon && <IconChip icon={icon} color={color} size="md" />}
        {trend !== undefined && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-emerald-100 text-[#0E6C3B]' : 'bg-red-100 text-[#E03137]'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-black text-gray-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
