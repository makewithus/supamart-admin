// Original SVG lockups preserve the designer's outlined lettering and colours.
export default function BrandMark({ reversed = false, prominent = false }) {
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
