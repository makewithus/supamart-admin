import React from 'react';

export default function Input({ label, icon: Icon, error, className = '', wrapperClassName = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
      {label && (
        <label className="text-xs font-bold text-gray-700">{label}</label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Icon size={16} strokeWidth={2} />
          </div>
        )}
        <input
          className={`w-full bg-white border border-gray-200 text-gray-900 rounded-xl py-2.5 pr-4 text-xs font-medium
            placeholder:text-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10
            transition-all duration-150 ${Icon ? 'pl-10' : 'pl-3.5'} ${error ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}
    </div>
  );
}
