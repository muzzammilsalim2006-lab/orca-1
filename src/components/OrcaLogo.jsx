import React from 'react';

/**
 * Official ORCA Brand Logo Component
 * 
 * Uses the official brand logo asset:
 * - Nautical circular gold badge
 * - Twisted rope outer border
 * - Top curved serif "ORCA"
 * - Maritime anchor & 3 ocean waves
 * - Lower motto: "SAFER SEAS • SMARTER DECISIONS"
 * 
 * @param {'original' | 'transparent'} variant - 'original' includes the black badge background, 'transparent' is cutout
 * @param {'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'} size - Preset sizing
 * @param {string} className - Additional CSS classes
 * @param {boolean} showTagline - Optional display of textual subtitle below
 */
export default function OrcaLogo({
  variant = 'original',
  size = 'md',
  className = '',
  showTagline = false,
  taglineText = 'SAFER SEAS • SMARTER DECISIONS',
}) {
  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    '2xl': 'w-32 h-32',
  };

  const dimClass = sizeMap[size] || size;
  const imageSrc = variant === 'transparent'
    ? '/orca-logo-transparent.png'
    : '/orca-logo.png';

  return (
    <div className={`inline-flex flex-col items-center justify-center ${className}`}>
      <img
        src={imageSrc}
        alt="ORCA Official Brand Logo"
        referrerPolicy="no-referrer"
        className={`${dimClass} object-contain select-none shrink-0 drop-shadow-sm`}
        loading="eager"
      />
      {showTagline && (
        <span className="mt-1 text-[10px] font-bold tracking-widest text-amber-700/90 uppercase font-mono">
          {taglineText}
        </span>
      )}
    </div>
  );
}
