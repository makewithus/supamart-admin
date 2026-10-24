import React from 'react';

const base = 'inline-flex items-center justify-center gap-2 font-bold text-xs sm:text-sm rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none';

const variants = {
  primary:     'bg-[#0E6C3B] text-white hover:bg-[#09522C] active:scale-[0.98] focus:ring-[#0E6C3B]/30 shadow-2xs',
  secondary:   'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-[0.98] focus:ring-gray-300 shadow-2xs',
  outlined:    'border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 active:scale-[0.98] focus:ring-gray-300 shadow-2xs',
  ghost:       'text-gray-700 bg-transparent hover:bg-gray-100 active:scale-[0.98] focus:ring-gray-200',
  destructive: 'border border-red-200 text-[#E03137] bg-white hover:bg-red-50 active:scale-[0.98] focus:ring-red-300 shadow-2xs',
  dangerSolid: 'bg-[#E03137] text-white hover:bg-red-700 active:scale-[0.98] focus:ring-red-300 shadow-2xs',
};

const sizes = {
  sm: 'px-3.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-xs sm:text-sm',
  lg: 'px-6 py-2.5 text-sm sm:text-base',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  ...props
}) {
  return (
    <button
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {children}
    </button>
  );
}
