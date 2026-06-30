
export default function MarvelopsLogo({ size = 32 }) {
  const cx = 50, cy = 50;
//   const segments = 16;
  const outerR = 38, innerR = 22;
  const outerW = 10, innerW = 7;
//   const gap = 0.18;
  const color = '#F05A28';

  /* makeRing removed (unused) */

  // Use arc-based approach for cleaner segments
  const makeArcSegments = (r, segHalfThick, count, gapAngle, _rx = 2) => {
    const step = (2 * Math.PI) / count;
    return Array.from({ length: count }, (_, i) => {
      const start = i * step - Math.PI / 2 + gapAngle / 2;
      const end = start + step - gapAngle;
      const r1 = r - segHalfThick;
      const r2 = r + segHalfThick;

      const x1 = cx + r1 * Math.cos(start);
      const y1 = cy + r1 * Math.sin(start);
      const x2 = cx + r2 * Math.cos(start);
      const y2 = cy + r2 * Math.sin(start);
      const x3 = cx + r2 * Math.cos(end);
      const y3 = cy + r2 * Math.sin(end);
      const x4 = cx + r1 * Math.cos(end);
      const y4 = cy + r1 * Math.sin(end);

      const largeArc = (step - gapAngle) > Math.PI ? 1 : 0;

      return (
        <path
          key={i}
          d={`
            M ${x1} ${y1}
            L ${x2} ${y2}
            A ${r2} ${r2} 0 ${largeArc} 1 ${x3} ${y3}
            L ${x4} ${y4}
            A ${r1} ${r1} 0 ${largeArc} 0 ${x1} ${y1}
            Z
          `}
          fill={color}
        />
      );
    });
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      {makeArcSegments(outerR, outerW / 2, 18, 0.22)}
      {makeArcSegments(innerR, innerW / 2, 13, 0.28)}
    </svg>
  );
}