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
  variant = 'transparent',
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
  // Always use the 100% transparent asset so application white background blends seamlessly
  const imageSrc = variant === 'original' ? '/orca-logo.png' : '/orca-logo-transparent.png';

  // Strip any shadow classes that might have been passed down from parent containers
  // to ensure there is NO visible square, rectangle, border, or shadow surrounding the circular logo
  const cleanClassName = (className || '')
    .replace(/\bshadow-[^\s]+/g, '')
    .replace(/\bshadow\b/g, '')
    .replace(/\bdrop-shadow-[^\s]+/g, '')
    .replace(/\bdrop-shadow\b/g, '')
    .trim();

  return (
    <div className={`inline-flex flex-col items-center justify-center bg-transparent ${cleanClassName}`}>
      <img
        src={imageSrc}
        alt="ORCA Official Brand Logo"
        referrerPolicy="no-referrer"
        className={`${dimClass} object-contain select-none shrink-0 bg-transparent`}
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
