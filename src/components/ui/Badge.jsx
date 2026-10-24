import React from 'react';

const variants = {
  success: 'bg-[#E7F4EB] text-[#0E6C3B]',
  info:    'bg-[#EBF5FB] text-[#2471A3]',
  warning: 'bg-[#FEF7EC] text-[#D97706]',
  error:   'bg-[#FDF2F2] text-[#E03137]',
  neutral: 'bg-gray-100 text-gray-700',
  dark:    'bg-gray-900 text-white',
};

export default function Badge({ children, variant = 'neutral', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${variants[variant] || variants.neutral} ${className}`}>
      {children}
    </span>
  );
}
