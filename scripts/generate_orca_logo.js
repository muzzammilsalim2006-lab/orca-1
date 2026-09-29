import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

function buildLogoSvg({ transparent = false } = {}) {
  const size = 512;
  const cx = 256;
  const cy = 256;

  // Generate nautical rope diagonal slashes around the circumference
  const numRopeSegments = 84;
  const ropeInnerR = 210;
  const ropeOuterR = 236;
  const ropeElements = [];

  for (let i = 0; i < numRopeSegments; i++) {
    const angleRad = (i / numRopeSegments) * 2 * Math.PI;
    const nextAngleRad = ((i + 1) / numRopeSegments) * 2 * Math.PI;
    const tilt = 0.055; // diagonal twist angle offset

    const x1 = cx + ropeInnerR * Math.cos(angleRad - tilt);
    const y1 = cy + ropeInnerR * Math.sin(angleRad - tilt);
    const x2 = cx + ropeOuterR * Math.cos(angleRad + tilt);
    const y2 = cy + ropeOuterR * Math.sin(angleRad + tilt);
    const x3 = cx + ropeOuterR * Math.cos(nextAngleRad + tilt);
    const y3 = cy + ropeOuterR * Math.sin(nextAngleRad + tilt);
    const x4 = cx + ropeInnerR * Math.cos(nextAngleRad - tilt);
    const y4 = cy + ropeInnerR * Math.sin(nextAngleRad - tilt);

    // Alternate subtle shading on rope coils for realistic 3D twist
    const shade = i % 2 === 0 ? 'url(#goldRopeLight)' : 'url(#goldRopeDark)';
    ropeElements.push(
      `<polygon points="${x1.toFixed(2)},${y1.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)} ${x3.toFixed(2)},${y3.toFixed(2)} ${x4.toFixed(2)},${y4.toFixed(2)}" fill="${shade}" />`
    );
  }

  // Generate bottom beaded dots arc (lining the lower inner rim)
  const dotElements = [];
  const dotRadius = 186;
  const numDots = 38;
  const startDotAngle = (50 * Math.PI) / 180;
  const endDotAngle = (130 * Math.PI) / 180;

  for (let i = 0; i < numDots; i++) {
    const frac = i / (numDots - 1);
    const a = startDotAngle + frac * (endDotAngle - startDotAngle);
    // around bottom: x = cx + r*cos(a), y = cy + r*sin(a)
    const dx = cx - dotRadius * Math.cos(a);
    const dy = cy + dotRadius * Math.sin(a);
    dotElements.push(`<circle cx="${dx.toFixed(2)}" cy="${dy.toFixed(2)}" r="1.8" fill="url(#goldGrad)" />`);
  }

  const bgRect = transparent
    ? ''
    : `<rect width="${size}" height="${size}" fill="#020202" />`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <!-- Rich Maritime Gold Gradients -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCEBA0" />
      <stop offset="25%" stop-color="#E5C365" />
      <stop offset="60%" stop-color="#C59B27" />
      <stop offset="85%" stop-color="#E2C269" />
      <stop offset="100%" stop-color="#9E7616" />
    </linearGradient>

    <linearGradient id="goldLight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFF2B8" />
      <stop offset="50%" stop-color="#E1BF62" />
      <stop offset="100%" stop-color="#B88A1B" />
    </linearGradient>

    <linearGradient id="goldRopeLight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDF0AE" />
      <stop offset="50%" stop-color="#E0BC5B" />
      <stop offset="100%" stop-color="#B88C20" />
    </linearGradient>

    <linearGradient id="goldRopeDark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#D6A730" />
      <stop offset="60%" stop-color="#A87B14" />
      <stop offset="100%" stop-color="#735208" />
    </linearGradient>

    <!-- Curvature paths for upper and lower text -->
    <!-- Top arc for ORCA: clockwise over the top -->
    <path id="pathOrca" d="M 115,242 A 148,148 0 0,1 397,242" fill="none" />

    <!-- Bottom arc for SAFER SEAS: clockwise along bottom -->
    <path id="pathMotto" d="M 98,242 A 166,166 0 0,0 414,242" fill="none" />
  </defs>

  ${bgRect}

  <!-- Circular Outer Badge Base -->
  <circle cx="${cx}" cy="${cy}" r="244" fill="#020202" />

  <!-- Outer Gold Rope Ring -->
  <circle cx="${cx}" cy="${cy}" r="${ropeOuterR}" fill="none" stroke="url(#goldGrad)" stroke-width="3" />
  <circle cx="${cx}" cy="${cy}" r="${ropeInnerR}" fill="none" stroke="url(#goldGrad)" stroke-width="2.5" />

  <!-- Rope Segments -->
  <g>
    ${ropeElements.join('\n    ')}
  </g>

  <!-- Inner Badge Dark Field -->
  <circle cx="${cx}" cy="${cy}" r="208" fill="#000000" />

  <!-- Concentric Inner Gold Hairline Ring -->
  <circle cx="${cx}" cy="${cy}" r="196" fill="none" stroke="url(#goldGrad)" stroke-width="2" />

  <!-- Beaded Dots Arc along bottom -->
  <g>
    ${dotElements.join('\n    ')}
  </g>

  <!-- TOP TEXT: ORCA in Classic Serif Typography -->
  <text font-family="'Times New Roman', 'Playfair Display', Georgia, serif" font-weight="900" font-size="44" fill="url(#goldLight)" letter-spacing="14">
    <textPath href="#pathOrca" startOffset="50%" text-anchor="middle">ORCA</textPath>
  </text>

  <!-- CENTER EMBLEM: MARITIME ANCHOR -->
  <g fill="url(#goldGrad)" stroke="url(#goldGrad)" stroke-linejoin="round">
    <!-- Top Ring / Shackle -->
    <circle cx="256" cy="180" r="16" fill="none" stroke="url(#goldLight)" stroke-width="5" />
    <circle cx="256" cy="180" r="7.5" fill="#000000" />

    <!-- Horizontal Stock (Crossbar) with End Knobs -->
    <rect x="214" y="200" width="84" height="6.5" rx="2" fill="url(#goldLight)" stroke="none" />
    <circle cx="214" cy="203.25" r="5.5" fill="url(#goldLight)" stroke="none" />
    <circle cx="298" cy="203.25" r="5.5" fill="url(#goldLight)" stroke="none" />

    <!-- Vertical Shank -->
    <path d="M 252,206.5 L 252,284 L 260,284 L 260,206.5 Z" fill="url(#goldLight)" stroke="none" />

    <!-- Curved Arms & Flukes -->
    <path d="
      M 256,306
      C 238,306 214,295 198,266
      C 197,264 200,263 203,264
      L 207,266
      L 201,250
      L 217,258
      L 213,262
      C 225,282 242,289 252,289
      L 252,306
      Z"
      fill="url(#goldLight)" stroke="none" />

    <path d="
      M 256,306
      C 274,306 298,295 314,266
      C 315,264 312,263 309,264
      L 305,266
      L 311,250
      L 295,258
      L 299,262
      C 287,282 270,289 260,289
      L 260,306
      Z"
      fill="url(#goldLight)" stroke="none" />

    <!-- Pointed Crown at Base -->
    <polygon points="252,286 260,286 256,306" fill="url(#goldLight)" stroke="none" />
  </g>

  <!-- OCEAN WAVES (Beneath Anchor) -->
  <g fill="none" stroke="url(#goldLight)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
    <!-- Wave 1 (Top) -->
    <path d="
      M 174,324
      C 194,316 210,316 230,324
      C 250,332 266,332 286,324
      C 304,316 320,316 338,324" />

    <!-- Wave 2 (Middle) -->
    <path d="
      M 174,342
      C 194,334 210,334 230,342
      C 250,350 266,350 286,342
      C 304,334 320,334 338,342" />

    <!-- Wave 3 (Bottom) -->
    <path d="
      M 174,360
      C 194,352 210,352 230,360
      C 250,368 266,368 286,360
      C 304,352 320,352 338,360" />
  </g>

  <!-- BOTTOM MOTTO: SAFER SEAS • SMARTER DECISIONS -->
  <text font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-weight="800" font-size="14.5" fill="url(#goldGrad)" letter-spacing="4.5">
    <textPath href="#pathMotto" startOffset="50%" text-anchor="middle">SAFER SEAS • SMARTER DECISIONS</textPath>
  </text>
</svg>
  `.trim();
}

async function generateAll() {
  console.log('Generating official ORCA Brand Logo assets...');

  const svgBlack = buildLogoSvg({ transparent: false });
  const svgTransparent = buildLogoSvg({ transparent: true });

  const targetDirs = [
    path.resolve('src/assets/images'),
    path.resolve('public'),
    path.resolve('public/assets/images'),
  ];

  for (const dir of targetDirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 1. High-resolution 512x512 with official black background
  await sharp(Buffer.from(svgBlack))
    .png({ compressionLevel: 9 })
    .toFile(path.resolve('src/assets/images/orca-logo.png'));
  
  await sharp(Buffer.from(svgBlack))
    .png({ compressionLevel: 9 })
    .toFile(path.resolve('public/orca-logo.png'));
  
  await sharp(Buffer.from(svgBlack))
    .png({ compressionLevel: 9 })
    .toFile(path.resolve('public/assets/images/orca-logo.png'));

  // 2. High-resolution 512x512 with transparent background
  await sharp(Buffer.from(svgTransparent))
    .png({ compressionLevel: 9 })
    .toFile(path.resolve('src/assets/images/orca-logo-transparent.png'));

  await sharp(Buffer.from(svgTransparent))
    .png({ compressionLevel: 9 })
    .toFile(path.resolve('public/orca-logo-transparent.png'));

  await sharp(Buffer.from(svgTransparent))
    .png({ compressionLevel: 9 })
    .toFile(path.resolve('public/assets/images/orca-logo-transparent.png'));

  // 3. Compact 128x128 mobile icons
  await sharp(Buffer.from(svgBlack))
    .resize(128, 128)
    .png({ compressionLevel: 9 })
    .toFile(path.resolve('public/orca-logo-128.png'));

  await sharp(Buffer.from(svgTransparent))
    .resize(128, 128)
    .png({ compressionLevel: 9 })
    .toFile(path.resolve('public/orca-logo-transparent-128.png'));

  // Also save SVG sources
  fs.writeFileSync(path.resolve('src/assets/images/orca-logo.svg'), svgBlack);
  fs.writeFileSync(path.resolve('public/orca-logo.svg'), svgBlack);
  fs.writeFileSync(path.resolve('src/assets/images/orca-logo-transparent.svg'), svgTransparent);

  console.log('✓ All ORCA official brand assets successfully generated!');
}

generateAll().catch((err) => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});
