import React from 'react';

export default function Input({ label, icon: Icon, error, className = '', wrapperClassName = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
      {label && (
        <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">{label}</label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
            <Icon size={16} strokeWidth={2} />
          </div>
        )}
        <input
          className={`w-full bg-neutral-50 border border-neutral-200 text-primary-900 rounded-md py-3 pr-4 text-sm font-medium
            placeholder:text-neutral-400 focus:outline-none focus:border-primary-900 focus:ring-2 focus:ring-primary-900/10
            transition-all duration-150 ${Icon ? 'pl-10' : 'pl-4'} ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}
