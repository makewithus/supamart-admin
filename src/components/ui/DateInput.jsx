import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';

export default function DateInput({ value, onChange, required = false, min, max, className = '', label }) {
  const inputRef = useRef(null);

  const openPicker = () => {
    if (inputRef.current) {
      try { inputRef.current.showPicker(); } catch { inputRef.current.focus(); }
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="datetime-local"
        value={value}
        onChange={onChange}
        required={required}
        min={min}
        max={max}
        style={{ colorScheme: 'light' }}
        className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm text-primary-900
          font-medium focus:outline-none focus:border-primary-900 focus:ring-2 focus:ring-primary-900/10
          hover:border-neutral-400 transition-all duration-150"
      />
      <button
        type="button"
        onClick={openPicker}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-primary-900 transition-colors cursor-pointer"
      >
        <Calendar size={16} />
      </button>
    </div>
  );
}
