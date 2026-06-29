import React from 'react';

const variants = {
  success: 'bg-secondary-100 text-secondary-700',
  info:    'bg-tertiary-100 text-tertiary-700',
  warning: 'bg-amber-100 text-amber-700',
  error:   'bg-red-100 text-red-600',
  neutral: 'bg-neutral-100 text-neutral-600',
  dark:    'bg-primary-900 text-white',
};

export default function Badge({ children, variant = 'neutral', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
