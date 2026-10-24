import React from 'react';

export default function BrandMark({ reversed = false, prominent = false, layout = 'horizontal' }) {
  if (layout === 'sidebar' || layout === 'compact') {
    return (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-[#0E6C3B]">
          <img
            src="/branding/ms-traders-symbol-small-colour.svg"
            alt="MS Traders"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-gray-900 leading-tight">MS Traders</span>
          <span className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5">Store admin</span>
        </div>
      </div>
    );
  }

  return (
    <span className="inline-flex shrink-0 p-1.5">
      <img
        src={`/branding/ms-traders-horizontal-${reversed ? 'reversed' : 'colour'}.svg`}
        alt="MS Traders"
        width="136"
        height="42"
        className={`block h-auto object-contain ${prominent ? 'w-[136px] md:w-[160px]' : 'w-[136px]'}`}
      />
    </span>
  );
}
