import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function Select({ value, onChange, options = [], placeholder = 'Select…', className = '', disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = options.find((o) => (o.value ?? o) === value);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-md bg-neutral-50 border text-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-900/10 disabled:opacity-50 disabled:cursor-not-allowed
          ${open ? 'border-primary-900 ring-2 ring-primary-900/10' : 'border-neutral-200 hover:border-neutral-400'}
        `}
      >
        <span className={selected ? 'text-primary-900 font-medium' : 'text-neutral-400'}>
          {selected ? (selected.label ?? selected) : placeholder}
        </span>
        <ChevronDown
          size={15}
          className={`ml-2 flex-shrink-0 text-neutral-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1.5 w-full bg-white rounded-md shadow-dropdown border border-neutral-100 py-1.5 overflow-hidden"
          style={{ animation: 'fadeUp 0.15s ease both' }}
        >
          {options.map((opt) => {
            const val = opt.value ?? opt;
            const label = opt.label ?? opt;
            const isSelected = val === value;
            return (
              <button
                key={val}
                type="button"
                onClick={() => { onChange(val); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors hover:bg-neutral-50
                  ${isSelected ? 'text-primary-900 font-semibold bg-secondary-50' : 'text-neutral-700'}
                `}
              >
                {label}
                {isSelected && <Check size={14} className="text-secondary-600 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
