interface AgentAvatarProps {
  initials: string;
  colorFrom: string;
  colorTo: string;
  gender: 'm' | 'f';
  avatarVariant: number;
  size?: number;
}

const skinTone = '#D4A574';
const skinDark = '#C4956A';
const hairDark = '#3B2507';
const hairMed = '#5C3A1E';

/* Each variant returns an array of rect configs: [x, y, w, h, fill?] */
type Block = [number, number, number, number, string?];

const maleHairVariants: Block[][] = [
  // 0 - short neat
  [[18, 12, 24, 4, hairDark], [18, 10, 24, 3, hairDark], [18, 16, 2, 4, hairDark], [40, 16, 2, 4, hairDark]],
  // 1 - mohawk
  [[27, 4, 6, 4, hairDark], [27, 8, 6, 4, hairDark], [27, 12, 6, 2, hairDark], [18, 12, 24, 3, hairMed]],
  // 2 - flat top
  [[16, 10, 28, 4, hairDark], [18, 14, 24, 2, hairDark], [16, 8, 28, 3, hairDark]],
  // 3 - with glasses
  [[18, 10, 24, 4, hairDark], [18, 14, 24, 2, hairDark]],
  // 4 - cap
  [[14, 10, 32, 4, hairDark], [14, 14, 32, 3, hairMed], [12, 14, 36, 2, hairDark]],
  // 5 - afro blocky
  [[16, 6, 28, 4, hairDark], [14, 10, 32, 4, hairDark], [14, 14, 4, 10, hairDark], [42, 14, 4, 10, hairDark], [16, 14, 28, 2, hairDark]],
];

const femaleHairVariants: Block[][] = [
  // 0 - long straight
  [[18, 10, 24, 4, hairDark], [18, 14, 24, 2, hairDark], [16, 14, 4, 22, hairDark], [40, 14, 4, 22, hairDark]],
  // 1 - ponytail
  [[18, 10, 24, 4, hairDark], [18, 14, 24, 2, hairDark], [42, 14, 4, 4, hairDark], [46, 18, 4, 8, hairDark]],
  // 2 - bun
  [[18, 10, 24, 4, hairDark], [18, 14, 24, 2, hairDark], [24, 4, 12, 6, hairDark], [26, 2, 8, 4, hairDark]],
  // 3 - bangs/fringe
  [[18, 10, 24, 4, hairDark], [18, 14, 24, 2, hairDark], [18, 16, 12, 4, hairDark]],
  // 4 - bob
  [[18, 10, 24, 4, hairDark], [18, 14, 24, 2, hairDark], [16, 14, 4, 14, hairDark], [40, 14, 4, 14, hairDark]],
  // 5 - braids
  [[18, 10, 24, 4, hairDark], [18, 14, 24, 2, hairDark], [16, 16, 3, 20, hairMed], [41, 16, 3, 20, hairMed], [16, 36, 3, 3, '#F59E0B'], [41, 36, 3, 3, '#F59E0B']],
];

/* Glasses blocks for male variant 3 */
const glassesBlocks: Block[] = [
  [21, 24, 6, 5, 'none'], [33, 24, 6, 5, 'none'],
  [29, 25, 2, 2, '#666'],
  // frames
  [21, 24, 6, 1, '#555'], [21, 28, 6, 1, '#555'], [21, 24, 1, 5, '#555'], [26, 24, 1, 5, '#555'],
  [33, 24, 6, 1, '#555'], [33, 28, 6, 1, '#555'], [33, 24, 1, 5, '#555'], [38, 24, 1, 5, '#555'],
  [27, 25, 6, 1, '#555'],
];

/* Earring blocks for female variant 0 & 5 */
const earringBlock = (color: string): Block[] => [
  [15, 26, 2, 2, color], [43, 26, 2, 2, color],
];

export function AgentAvatar({ initials, colorFrom, colorTo, gender, avatarVariant, size = 56 }: AgentAvatarProps) {
  const uid = `av-${initials}-${colorFrom.replace('#', '')}`;
  const variant = Math.abs(avatarVariant) % 6;
  const hairBlocks = gender === 'm' ? maleHairVariants[variant] : femaleHairVariants[variant];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      className="flex-shrink-0"
      role="img"
      aria-label={initials}
      style={{ imageRendering: 'pixelated' }}
    >
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor={colorFrom} />
          <stop offset="1" stopColor={colorTo} />
        </linearGradient>
        <clipPath id={`clip-${uid}`}>
          <rect x="3" y="3" width="54" height="54" rx="4" />
        </clipPath>
      </defs>

      {/* Background */}
      <rect x="2" y="2" width="56" height="56" rx="5" fill={`url(#${uid})`} opacity="0.15" />
      <rect x="3" y="3" width="54" height="54" rx="4" fill={`url(#${uid})`} opacity="0.85" />

      <g clipPath={`url(#clip-${uid})`}>
        {/* Body / shirt */}
        <rect x="16" y="40" width="28" height="20" fill={colorFrom} opacity="0.8" />
        {/* Neck */}
        <rect x="26" y="36" width="8" height="6" fill={skinDark} />

        {/* Head */}
        <rect x="18" y="16" width="24" height="22" fill={skinTone} />

        {/* Eyes — 3x3 squares */}
        <rect x="22" y="24" width="3" height="3" fill="#1a1a1a" />
        <rect x="35" y="24" width="3" height="3" fill="#1a1a1a" />
        {/* Eye highlights */}
        <rect x="23" y="24" width="1" height="1" fill="rgba(255,255,255,0.6)" />
        <rect x="36" y="24" width="1" height="1" fill="rgba(255,255,255,0.6)" />

        {/* Eyebrows */}
        <rect x="22" y="22" width="4" height="1" fill="#4a3520" opacity={gender === 'm' ? 1 : 0.6} />
        <rect x="34" y="22" width="4" height="1" fill="#4a3520" opacity={gender === 'm' ? 1 : 0.6} />

        {/* Nose */}
        <rect x="29" y="28" width="2" height="2" fill={skinDark} />

        {/* Mouth */}
        <rect
          x={variant % 2 === 0 ? 26 : 27}
          y="32"
          width={variant % 2 === 0 ? 8 : 6}
          height="2"
          fill="#B5736A"
        />

        {/* Hair blocks */}
        {hairBlocks.map((b, i) => (
          <rect key={`h-${i}`} x={b[0]} y={b[1]} width={b[2]} height={b[3]} fill={b[4] || hairDark} />
        ))}

        {/* Glasses for male variant 3 */}
        {gender === 'm' && variant === 3 && glassesBlocks.map((b, i) => (
          <rect key={`g-${i}`} x={b[0]} y={b[1]} width={b[2]} height={b[3]}
            fill={b[4] === 'none' ? 'rgba(200,220,255,0.3)' : b[4]}
          />
        ))}

        {/* Earrings for female variants 0 & 5 */}
        {gender === 'f' && (variant === 0 || variant === 5) && earringBlock(colorFrom).map((b, i) => (
          <rect key={`e-${i}`} x={b[0]} y={b[1]} width={b[2]} height={b[3]} fill={b[4]} />
        ))}

        {/* Shirt collar detail */}
        <rect x="26" y="40" width="8" height="3" fill={colorTo} opacity="0.5" />
      </g>
    </svg>
  );
}
