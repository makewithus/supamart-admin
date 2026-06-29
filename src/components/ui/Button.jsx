import React from 'react';

const base = 'inline-flex items-center justify-center gap-2 font-semibold text-sm rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const variants = {
  primary:     'bg-primary-900 text-white hover:bg-primary-700 active:scale-[0.98] focus:ring-primary-900',
  secondary:   'bg-secondary-600 text-white hover:bg-secondary-700 active:scale-[0.98] focus:ring-secondary-600',
  outlined:    'border border-primary-900 text-primary-900 bg-transparent hover:bg-neutral-100 active:scale-[0.98] focus:ring-primary-900',
  ghost:       'text-primary-900 bg-transparent hover:bg-neutral-100 active:scale-[0.98] focus:ring-primary-300',
  destructive: 'border border-red-200 text-red-500 bg-transparent hover:bg-red-50 active:scale-[0.98] focus:ring-red-300',
};

const sizes = {
  sm: 'px-3.5 py-2 text-xs rounded-lg',
  md: 'px-5 py-2.5',
  lg: 'px-6 py-3 text-base',
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
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
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
