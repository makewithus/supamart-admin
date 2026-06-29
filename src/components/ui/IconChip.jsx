import React from 'react';

const colors = {
  secondary: 'bg-secondary-100 text-secondary-700',
  tertiary:  'bg-tertiary-100 text-tertiary-700',
  primary:   'bg-primary-100 text-primary-700',
  neutral:   'bg-neutral-100 text-neutral-500',
  amber:     'bg-amber-100 text-amber-700',
  red:       'bg-red-100 text-red-600',
};

const sizes = {
  sm: 'w-8 h-8',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
};

export default function IconChip({ icon: Icon, color = 'secondary', size = 'md', iconSize, className = '' }) {
  const defaultIconSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;
  return (
    <div className={`rounded-full flex items-center justify-center flex-shrink-0 ${colors[color]} ${sizes[size]} ${className}`}>
      <Icon size={iconSize ?? defaultIconSize} strokeWidth={1.75} />
    </div>
  );
}
