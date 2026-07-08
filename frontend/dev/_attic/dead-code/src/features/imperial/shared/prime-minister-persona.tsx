'use client';

export function PrimeMinisterPersona({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const dim = size === 'lg' ? 92 : 38;
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 92 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="pm-hat" x1="20" y1="10" x2="72" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F6D57D" />
          <stop offset="1" stopColor="#A67722" />
        </linearGradient>
        <linearGradient id="pm-robe" x1="20" y1="44" x2="72" y2="82" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E8C364" />
          <stop offset="1" stopColor="#6C4E1D" />
        </linearGradient>
      </defs>

      <path d="M20 24L34 12H58L72 24L64 32H28L20 24Z" fill="url(#pm-hat)" stroke="#F3D48A" strokeWidth="2" />
      <path d="M28 33H64V38C64 41.3 61.3 44 58 44H34C30.7 44 28 41.3 28 38V33Z" fill="#20180D" stroke="#C99B3A" strokeWidth="1.5" />
      <circle cx="46" cy="46" r="16" fill="#F1D7A1" stroke="#D3A453" strokeWidth="2" />
      <path d="M38 42C39.8 40.5 42 39.8 44.5 39.8H47.5C50 39.8 52.2 40.5 54 42" stroke="#6F4C22" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 50C42.4 52.3 49.6 52.3 52 50" stroke="#6F4C22" strokeWidth="2" strokeLinecap="round" />
      <path d="M34 64C36.5 58 55.5 58 58 64V67H34V64Z" fill="#F4E0B8" />
      <path d="M24 84C24 72.4 33.4 63 45 63H47C58.6 63 68 72.4 68 84V86H24V84Z" fill="url(#pm-robe)" stroke="#D3A453" strokeWidth="2" />
      <path d="M46 66L50 74L46 80L42 74L46 66Z" fill="#22190E" stroke="#F3D48A" strokeWidth="1.5" />
    </svg>
  );
}
