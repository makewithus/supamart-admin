import React from 'react';

export default function BrandMark({ reversed = false, prominent = false, layout = 'horizontal' }) {
  if (layout === 'sidebar' || layout === 'compact') {
    return (
      <div className="flex items-center gap-2.5">
        <img
          src={`/branding/ms-traders-horizontal-${reversed ? 'reversed' : 'colour'}.svg`}
          alt="MS Traders"
          className="h-7 w-auto object-contain"
        />
        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
          reversed
            ? 'bg-white/10 text-emerald-200 border border-white/20'
            : 'bg-[#E6F4EA] text-[#0A7C47] border border-[#0A7C47]/20'
        }`}>
          Admin
        </span>
      </div>
    );
  }

  return (
    <span className="inline-flex shrink-0 p-1.5 items-center">
      <img
        src={`/branding/ms-traders-horizontal-${reversed ? 'reversed' : 'colour'}.svg`}
        alt="MS Traders"
        className={`block h-auto object-contain ${prominent ? 'w-[150px] md:w-[180px]' : 'w-[136px]'}`}
      />
    </span>
  );
}
