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

    // Alternate subtle shading on rope coils for realistic 3D gold twist
    const shade = i % 2 === 0 ? 'url(#goldRopeLight)' : 'url(#goldRopeDark)';
    ropeElements.push(
      `<polygon points="${x1.toFixed(2)},${y1.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)} ${x3.toFixed(2)},${y3.toFixed(2)} ${x4.toFixed(2)},${y4.toFixed(2)}" fill="${shade}" />`
    );
  }

  // Generate complete beaded dots circle around inner rim
  const dotElements = [];
  const dotRadius = 184;
  const numDots = 64;

  for (let i = 0; i < numDots; i++) {
    const angleRad = (i / numDots) * 2 * Math.PI;
    const dx = cx + dotRadius * Math.cos(angleRad);
    const dy = cy + dotRadius * Math.sin(angleRad);
    dotElements.push(`<circle cx="${dx.toFixed(2)}" cy="${dy.toFixed(2)}" r="1.75" fill="url(#goldGrad)" />`);
  }

  const bgRect = transparent
    ? ''
    : `<rect width="${size}" height="${size}" fill="#FFFFFF" />`;

  const bgCircle = transparent
    ? ''
    : `<circle cx="${cx}" cy="${cy}" r="248" fill="#FFFFFF" />`;

  const innerCircle = transparent
    ? ''
    : `<circle cx="${cx}" cy="${cy}" r="208" fill="#FFFFFF" />`;

  const shackleHole = transparent
    ? ''
    : `<circle cx="256" cy="178" r="7.5" fill="#FFFFFF" />`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <!-- Rich Lustrous Maritime Gold Gradients matching uploaded asset -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCEBA0" />
      <stop offset="25%" stop-color="#E5C365" />
      <stop offset="55%" stop-color="#C59B27" />
      <stop offset="85%" stop-color="#E2C269" />
      <stop offset="100%" stop-color="#A57D18" />
    </linearGradient>

    <linearGradient id="goldLight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FCEBA0" />
      <stop offset="40%" stop-color="#DFBD5D" />
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
      <stop offset="100%" stop-color="#7E5C0A" />
    </linearGradient>

    <!-- Curvature paths for upper and lower text -->
    <!-- Top arc for ORCA: clockwise over the top -->
    <path id="pathOrca" d="M 115,242 A 148,148 0 0,1 397,242" fill="none" />

    <!-- Bottom arc for SAFER SEAS: clockwise along bottom -->
    <path id="pathMotto" d="M 98,242 A 166,166 0 0,0 414,242" fill="none" />
  </defs>

  ${bgRect}
  ${bgCircle}

  <!-- Outer Gold Rope Ring Border -->
  <circle cx="${cx}" cy="${cy}" r="${ropeOuterR}" fill="none" stroke="url(#goldGrad)" stroke-width="3" />
  <circle cx="${cx}" cy="${cy}" r="${ropeInnerR}" fill="none" stroke="url(#goldGrad)" stroke-width="2.5" />

  <!-- Rope Segments -->
  <g>
    ${ropeElements.join('\n    ')}
  </g>

  <!-- Inner Badge Field -->
  ${innerCircle}

  <!-- Concentric Inner Gold Hairline Ring -->
  <circle cx="${cx}" cy="${cy}" r="196" fill="none" stroke="url(#goldGrad)" stroke-width="2" />

  <!-- Beaded Dots Circle -->
  <g>
    ${dotElements.join('\n    ')}
  </g>

  <!-- TOP TEXT: ORCA in Classic Serif Typography with Gold Gradient -->
  <text font-family="'Times New Roman', 'Playfair Display', Georgia, serif" font-weight="900" font-size="44" fill="url(#goldLight)" letter-spacing="14">
    <textPath href="#pathOrca" startOffset="50%" text-anchor="middle">ORCA</textPath>
  </text>

  <!-- CENTER EMBLEM: MARITIME ANCHOR -->
  <g fill="url(#goldGrad)" stroke="url(#goldGrad)" stroke-linejoin="round">
    <!-- Top Ring / Shackle -->
    <circle cx="256" cy="178" r="16" fill="none" stroke="url(#goldLight)" stroke-width="5" />
    ${shackleHole}

    <!-- Horizontal Stock (Crossbar) with End Knobs -->
    <rect x="214" y="198" width="84" height="6.5" rx="2" fill="url(#goldLight)" stroke="none" />
    <circle cx="214" cy="201.25" r="5.5" fill="url(#goldLight)" stroke="none" />
    <circle cx="298" cy="201.25" r="5.5" fill="url(#goldLight)" stroke="none" />

    <!-- Vertical Shank -->
    <path d="M 252,204.5 L 252,282 L 260,282 L 260,204.5 Z" fill="url(#goldLight)" stroke="none" />

    <!-- Curved Arms & Flukes -->
    <path d="
      M 256,304
      C 238,304 214,293 198,264
      C 197,262 200,261 203,262
      L 207,264
      L 201,248
      L 217,256
      L 213,260
      C 225,280 242,287 252,287
      L 252,304
      Z"
      fill="url(#goldLight)" stroke="none" />

    <path d="
      M 256,304
      C 274,304 298,293 314,264
      C 315,262 312,261 309,262
      L 305,264
      L 311,248
      L 295,256
      L 299,260
      C 287,280 270,287 260,287
      L 260,304
      Z"
      fill="url(#goldLight)" stroke="none" />

    <!-- Pointed Crown at Base -->
    <polygon points="252,284 260,284 256,304" fill="url(#goldLight)" stroke="none" />
  </g>

  <!-- OCEAN WAVES (Beneath Anchor) -->
  <g fill="none" stroke="url(#goldLight)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
    <!-- Wave 1 (Top) -->
    <path d="
      M 174,322
      C 194,314 210,314 230,322
      C 250,330 266,330 286,322
      C 304,314 320,314 338,322" />

    <!-- Wave 2 (Middle) -->
    <path d="
      M 174,340
      C 194,332 210,332 230,340
      C 250,348 266,348 286,340
      C 304,332 320,332 338,340" />

    <!-- Wave 3 (Bottom) -->
    <path d="
      M 174,358
      C 194,350 210,350 230,358
      C 250,366 266,366 286,358
      C 304,350 320,350 338,358" />
  </g>

  <!-- BOTTOM MOTTO: SAFER SEAS • SMARTER DECISIONS -->
  <text font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-weight="800" font-size="14.5" fill="url(#goldGrad)" letter-spacing="4.5">
    <textPath href="#pathMotto" startOffset="50%" text-anchor="middle">SAFER SEAS • SMARTER DECISIONS</textPath>
  </text>
</svg>
  `.trim();
}

async function generateAll() {
  console.log('Generating official ORCA Brand Logo assets with 100% seamless transparent background...');

  // Always use 100% transparent background so application white background shows through seamlessly
  // Zero rect, zero bounding box, zero off-white square
  const svgTransparent = buildLogoSvg({ transparent: true });

  const targetDirs = [
    path.resolve('src/assets/images'),
    path.resolve('public'),
    path.resolve('public/assets/images'),
  ];

  for (const dir of targetDirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 1. High-resolution 512x512 transparent PNGs
  const buffer = await sharp(Buffer.from(svgTransparent))
    .png({ compressionLevel: 9 })
    .toBuffer();

  fs.writeFileSync(path.resolve('src/assets/images/orca-logo.png'), buffer);
  fs.writeFileSync(path.resolve('public/orca-logo.png'), buffer);
  fs.writeFileSync(path.resolve('public/assets/images/orca-logo.png'), buffer);

  fs.writeFileSync(path.resolve('src/assets/images/orca-logo-transparent.png'), buffer);
  fs.writeFileSync(path.resolve('public/orca-logo-transparent.png'), buffer);
  fs.writeFileSync(path.resolve('public/assets/images/orca-logo-transparent.png'), buffer);

  // 2. Compact 128x128 mobile icons with transparent background
  const iconBuffer = await sharp(Buffer.from(svgTransparent))
    .resize(128, 128)
    .png({ compressionLevel: 9 })
    .toBuffer();

  fs.writeFileSync(path.resolve('public/orca-logo-128.png'), iconBuffer);
  fs.writeFileSync(path.resolve('public/orca-logo-transparent-128.png'), iconBuffer);

  // 3. SVG vector sources
  fs.writeFileSync(path.resolve('src/assets/images/orca-logo.svg'), svgTransparent);
  fs.writeFileSync(path.resolve('public/orca-logo.svg'), svgTransparent);
  fs.writeFileSync(path.resolve('src/assets/images/orca-logo-transparent.svg'), svgTransparent);

  console.log('✓ All ORCA official brand assets successfully generated with 100% transparent backgrounds!');
}

generateAll().catch((err) => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});
